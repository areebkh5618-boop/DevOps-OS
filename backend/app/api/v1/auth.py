from datetime import datetime, timezone
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import httpx
import secrets
import logging

from app.db.session import get_db
from app.models.user import User, AuditLog
from app.schemas.user import (
    UserCreate, UserLogin, UserResponse, Token,
    PasswordResetRequest, UserUpdate, UserPasswordUpdate
)
from app.core.security import (
    get_password_hash, verify_password, create_access_token,
    create_refresh_token, get_current_user, decode_token
)
from app.core.config import settings
from app.utils.redis_client import get_redis, redis_available
import json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory state store fallback for OAuth CSRF (use Redis in production)
_oauth_states: dict[str, dict] = {}


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, request: Request, db: Session = Depends(get_db)):
    existing = db.query(User).filter(
        (User.email == user_in.email) | (User.username == user_in.username)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already registered",
        )
    
    user = User(
        email=user_in.email,
        username=user_in.username,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role.value if hasattr(user_in.role, "value") else str(user_in.role),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    audit = AuditLog(
        user_id=user.id,
        action="user.register",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    db.commit()
    return user


@router.post("/login", response_model=Token)
async def login(user_in: UserLogin, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not user.hashed_password or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    audit = AuditLog(
        user_id=user.id,
        action="user.login",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    db.commit()
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_token: str = Query(...), db: Session = Depends(get_db)):
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return Token(
        access_token=create_access_token(subject=user.id),
        refresh_token=create_refresh_token(subject=user.id),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user_in.email is not None:
        current_user.email = user_in.email
    if user_in.username is not None:
        current_user.username = user_in.username
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name
    if user_in.avatar_url is not None:
        current_user.avatar_url = user_in.avatar_url
    if user_in.github_token is not None:
        current_user.github_token = user_in.github_token
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
async def change_password(
    data: UserPasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.hashed_password or not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.post("/forgot-password")
async def forgot_password(data: PasswordResetRequest, db: Session = Depends(get_db)):
    return {"message": "If the email exists, a reset link has been sent"}


# ─── GitHub OAuth ───────────────────────────────────────────

@router.get("/github")
async def github_oauth_start(
    request: Request,
    connect: bool = Query(False, description="If true, connect to existing logged-in user"),
    token: str = Query(None, description="JWT of logged-in user when connecting"),
):
    """
    Redirect user to GitHub OAuth authorize page.
    - connect=false → full login (create/find user, issue JWT)
    - connect=true  → attach GitHub token to existing user (pass JWT as token=)
    """
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env",
        )

    state = secrets.token_urlsafe(32)
    meta = {
        "connect": connect,
        "user_token": token,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Prefer Redis-backed state so restarts or multi-process setups work.
    if redis_available():
        try:
            rd = await get_redis()
            await rd.set(f"oauth:state:{state}", json.dumps(meta), ex=300)
        except Exception:
            _oauth_states[state] = meta
    else:
        _oauth_states[state] = meta

    # Omit `redirect_uri` to let GitHub use the OAuth App's configured callback.
    # This avoids a mismatch when the registered redirect on GitHub differs
    # (e.g. missing API prefix or different host/port). If you prefer to
    # enforce a specific callback, set it in the GitHub OAuth app settings
    # and in `GITHUB_REDIRECT_URI`.
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "scope": "read:user user:email repo workflow",
        "state": state,
        "allow_signup": "true",
    }
    url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    return RedirectResponse(url)


@router.get("/github/callback")
async def github_oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    db: Session = Depends(get_db),
):
    """GitHub redirects here after user authorizes."""
    frontend = settings.FRONTEND_URL.rstrip("/")

    if error:
        return RedirectResponse(f"{frontend}/login?error={error}")

    # Retrieve state metadata from Redis if available, otherwise fall back
    # to the in-memory store. If state not found, it's invalid.
    oauth_meta = None
    if not code or not state:
        return RedirectResponse(f"{frontend}/login?error=invalid_state")

    if redis_available():
        try:
            rd = await get_redis()
            raw = await rd.get(f"oauth:state:{state}")
            if raw:
                oauth_meta = json.loads(raw)
                await rd.delete(f"oauth:state:{state}")
        except Exception:
            oauth_meta = _oauth_states.pop(state, None)
    else:
        oauth_meta = _oauth_states.pop(state, None)

    if not oauth_meta:
        return RedirectResponse(f"{frontend}/login?error=invalid_state")
    connect_mode = oauth_meta.get("connect", False)
    user_jwt = oauth_meta.get("user_token")

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            timeout=20.0,
        )
        token_data = token_resp.json()

    access_token_gh = token_data.get("access_token")
    if not access_token_gh:
        logger.error(f"GitHub token exchange failed: {token_data}")
        return RedirectResponse(f"{frontend}/login?error=token_exchange_failed")

    # Fetch GitHub user profile
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token_gh}",
                "Accept": "application/vnd.github+json",
            },
            timeout=20.0,
        )
        gh_user = user_resp.json()

        # Primary email
        email = gh_user.get("email")
        if not email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": f"Bearer {access_token_gh}",
                    "Accept": "application/vnd.github+json",
                },
                timeout=20.0,
            )
            emails = emails_resp.json() if emails_resp.status_code == 200 else []
            primary = next((e for e in emails if e.get("primary")), None)
            email = (primary or (emails[0] if emails else {})).get("email") or f"{gh_user['login']}@users.noreply.github.com"

    github_id = str(gh_user["id"])
    github_username = gh_user["login"]
    avatar_url = gh_user.get("avatar_url")
    full_name = gh_user.get("name") or github_username

    # ── Connect mode: attach token to existing logged-in user ──
    if connect_mode and user_jwt:
        try:
            payload = decode_token(user_jwt)
            user_id = int(payload.get("sub"))
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.github_id = github_id
                user.github_token = access_token_gh
                user.github_username = github_username
                if avatar_url:
                    user.avatar_url = avatar_url
                db.commit()
                return RedirectResponse(f"{frontend}/dashboard/github?connected=1")
        except Exception as e:
            logger.warning(f"Connect mode failed: {e}")
            return RedirectResponse(f"{frontend}/dashboard/github?error=connect_failed")

    # ── Login mode: find or create user, issue JWT ──
    user = db.query(User).filter(User.github_id == github_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()

    if user:
        user.github_id = github_id
        user.github_token = access_token_gh
        user.github_username = github_username
        user.avatar_url = avatar_url or user.avatar_url
        user.last_login = datetime.now(timezone.utc)
        if not user.full_name:
            user.full_name = full_name
    else:
        # Create new user from GitHub
        base_username = github_username
        username = base_username
        i = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base_username}{i}"
            i += 1

        user = User(
            email=email,
            username=username,
            full_name=full_name,
            hashed_password=None,
            github_id=github_id,
            github_token=access_token_gh,
            github_username=github_username,
            avatar_url=avatar_url,
            is_verified=True,
            role="viewer",
            last_login=datetime.now(timezone.utc),
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    audit = AuditLog(
        user_id=user.id,
        action="user.github_login",
        resource_type="user",
        resource_id=str(user.id),
    )
    db.add(audit)
    db.commit()

    jwt_access = create_access_token(subject=user.id)
    jwt_refresh = create_refresh_token(subject=user.id)

    # Redirect to frontend with tokens in query (frontend will store them)
    return RedirectResponse(
        f"{frontend}/auth/callback?access_token={jwt_access}&refresh_token={jwt_refresh}"
    )


@router.get("/github/status")
async def github_oauth_status(current_user: User = Depends(get_current_user)):
    return {
        "oauth_configured": bool(settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET),
        "connected": bool(current_user.github_token),
        "github_username": current_user.github_username,
        "github_id": current_user.github_id,
    }


@router.delete("/github/disconnect")
async def github_disconnect(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.github_token = None
    current_user.github_id = None
    current_user.github_username = None
    db.commit()
    return {"message": "GitHub disconnected"}
