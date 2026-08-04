import json
import logging
import secrets
from datetime import UTC, datetime
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.db.session import get_db
from app.models.user import AuditLog, User
from app.schemas.user import (
    PasswordResetRequest,
    Token,
    UserCreate,
    UserLogin,
    UserPasswordUpdate,
    UserResponse,
    UserUpdate,
)
from app.utils.redis_client import get_redis, redis_available

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

# In-memory fallback for OAuth state.
# Redis should be used in production.
_oauth_states: dict[str, dict] = {}


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    user_in: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(User)
        .filter(
            (User.email == user_in.email)
            | (User.username == user_in.username)
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already registered",
        )

    user = User(
        email=user_in.email,
        username=user_in.username,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        role=(
            user_in.role.value
            if hasattr(user_in.role, "value")
            else str(user_in.role)
        ),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    audit_log = AuditLog(
        user_id=user.id,
        action="user.register",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request.client else None,
    )

    db.add(audit_log)
    db.commit()

    return user


@router.post("/login", response_model=Token)
async def login(
    user_in: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == user_in.email)
        .first()
    )

    password_is_valid = (
        user
        and user.hashed_password
        and verify_password(
            user_in.password,
            user.hashed_password,
        )
    )

    if not password_is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    user.last_login = datetime.now(UTC)
    db.commit()

    access_token = create_access_token(subject=user.id)
    refresh_token_value = create_refresh_token(subject=user.id)

    audit_log = AuditLog(
        user_id=user.id,
        action="user.login",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request.client else None,
    )

    db.add(audit_log)
    db.commit()

    return Token(
        access_token=access_token,
        refresh_token=refresh_token_value,
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str = Query(...),
    db: Session = Depends(get_db),
):
    payload = decode_token(refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    try:
        parsed_user_id = int(user_id)
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from error

    user = (
        db.query(User)
        .filter(User.id == parsed_user_id)
        .first()
    )

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return Token(
        access_token=create_access_token(subject=user.id),
        refresh_token=create_refresh_token(subject=user.id),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
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
    password_is_valid = (
        current_user.hashed_password
        and verify_password(
            data.current_password,
            current_user.hashed_password,
        )
    )

    if not password_is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = get_password_hash(
        data.new_password
    )

    db.commit()

    return {
        "message": "Password updated successfully",
    }


@router.post("/forgot-password")
async def forgot_password(
    data: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    # Do not reveal whether an email is registered.
    _ = data
    _ = db

    return {
        "message": (
            "If the email exists, a reset link has been sent"
        ),
    }


# ─────────────────────────────────────────────────────────────
# GitHub OAuth
# ─────────────────────────────────────────────────────────────


@router.get("/github")
async def github_oauth_start(
    request: Request,
    connect: bool = Query(
        False,
        description=(
            "If true, connect GitHub to an existing user"
        ),
    ),
    token: str | None = Query(
        None,
        description=(
            "JWT of the logged-in user when connecting GitHub"
        ),
    ),
):
    """
    Redirect the user to GitHub OAuth.

    connect=false:
        Log in or create a user through GitHub.

    connect=true:
        Attach GitHub credentials to an existing user.
    """

    _ = request

    if (
        not settings.GITHUB_CLIENT_ID
        or not settings.GITHUB_CLIENT_SECRET
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "GitHub OAuth is not configured. "
                "Set GITHUB_CLIENT_ID and "
                "GITHUB_CLIENT_SECRET in .env"
            ),
        )

    state = secrets.token_urlsafe(32)

    oauth_metadata = {
        "connect": connect,
        "user_token": token,
        "created_at": datetime.now(UTC).isoformat(),
    }

    if redis_available():
        try:
            redis_client = await get_redis()

            await redis_client.set(
                f"oauth:state:{state}",
                json.dumps(oauth_metadata),
                ex=300,
            )
        except Exception:
            logger.exception(
                "Unable to save OAuth state in Redis"
            )
            _oauth_states[state] = oauth_metadata
    else:
        _oauth_states[state] = oauth_metadata

    parameters = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "scope": "read:user user:email repo workflow",
        "state": state,
        "allow_signup": "true",
    }

    authorization_url = (
        "https://github.com/login/oauth/authorize?"
        f"{urlencode(parameters)}"
    )

    return RedirectResponse(authorization_url)


@router.get("/github/callback")
async def github_oauth_callback(
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Handle the callback sent by GitHub OAuth."""

    frontend_url = settings.FRONTEND_URL.rstrip("/")

    if error:
        return RedirectResponse(
            f"{frontend_url}/login?error={error}"
        )

    if not code or not state:
        return RedirectResponse(
            f"{frontend_url}/login?error=invalid_state"
        )

    oauth_metadata = None

    if redis_available():
        try:
            redis_client = await get_redis()

            raw_state = await redis_client.get(
                f"oauth:state:{state}"
            )

            if raw_state:
                oauth_metadata = json.loads(raw_state)

                await redis_client.delete(
                    f"oauth:state:{state}"
                )
        except Exception:
            logger.exception(
                "Unable to retrieve OAuth state from Redis"
            )
            oauth_metadata = _oauth_states.pop(
                state,
                None,
            )
    else:
        oauth_metadata = _oauth_states.pop(
            state,
            None,
        )

    if not oauth_metadata:
        return RedirectResponse(
            f"{frontend_url}/login?error=invalid_state"
        )

    connect_mode = oauth_metadata.get(
        "connect",
        False,
    )

    user_jwt = oauth_metadata.get("user_token")

    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={
                "Accept": "application/json",
            },
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            timeout=20.0,
        )

        token_response.raise_for_status()
        token_data = token_response.json()

    github_access_token = token_data.get(
        "access_token"
    )

    if not github_access_token:
        logger.error(
            "GitHub token exchange failed: %s",
            token_data,
        )

        return RedirectResponse(
            f"{frontend_url}/login?"
            "error=token_exchange_failed"
        )

    async with httpx.AsyncClient() as client:
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": (
                    f"Bearer {github_access_token}"
                ),
                "Accept": "application/vnd.github+json",
            },
            timeout=20.0,
        )

        user_response.raise_for_status()
        github_user = user_response.json()

        email = github_user.get("email")

        if not email:
            emails_response = await client.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": (
                        f"Bearer {github_access_token}"
                    ),
                    "Accept": (
                        "application/vnd.github+json"
                    ),
                },
                timeout=20.0,
            )

            if emails_response.status_code == 200:
                emails = emails_response.json()
            else:
                emails = []

            primary_email = next(
                (
                    item
                    for item in emails
                    if item.get("primary")
                ),
                None,
            )

            fallback_email_data = (
                primary_email
                or (emails[0] if emails else {})
            )

            email = fallback_email_data.get(
                "email"
            )

            if not email:
                email = (
                    f"{github_user['login']}"
                    "@users.noreply.github.com"
                )

    github_id = str(github_user["id"])
    github_username = github_user["login"]
    avatar_url = github_user.get("avatar_url")
    full_name = (
        github_user.get("name")
        or github_username
    )

    # Connect GitHub to an existing logged-in user.
    if connect_mode and user_jwt:
        try:
            payload = decode_token(user_jwt)
            subject = payload.get("sub")

            if subject is None:
                raise ValueError(
                    "JWT subject is missing"
                )

            user_id = int(subject)

            user = (
                db.query(User)
                .filter(User.id == user_id)
                .first()
            )

            if user:
                user.github_id = github_id
                user.github_token = github_access_token
                user.github_username = github_username

                if avatar_url:
                    user.avatar_url = avatar_url

                db.commit()

                return RedirectResponse(
                    f"{frontend_url}/dashboard/github?"
                    "connected=1"
                )

        except (TypeError, ValueError) as exception:
            logger.warning(
                "Connect mode failed: %s",
                exception,
            )

            return RedirectResponse(
                f"{frontend_url}/dashboard/github?"
                "error=connect_failed"
            )

    # Find an existing user using GitHub ID.
    user = (
        db.query(User)
        .filter(User.github_id == github_id)
        .first()
    )

    # Otherwise find the user through email.
    if not user:
        user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

    if user:
        user.github_id = github_id
        user.github_token = github_access_token
        user.github_username = github_username
        user.avatar_url = (
            avatar_url
            or user.avatar_url
        )
        user.last_login = datetime.now(UTC)

        if not user.full_name:
            user.full_name = full_name

    else:
        base_username = github_username
        username = base_username
        suffix = 1

        while (
            db.query(User)
            .filter(User.username == username)
            .first()
        ):
            username = f"{base_username}{suffix}"
            suffix += 1

        user = User(
            email=email,
            username=username,
            full_name=full_name,
            hashed_password=None,
            github_id=github_id,
            github_token=github_access_token,
            github_username=github_username,
            avatar_url=avatar_url,
            is_verified=True,
            role="viewer",
            last_login=datetime.now(UTC),
        )

        db.add(user)

    db.commit()
    db.refresh(user)

    audit_log = AuditLog(
        user_id=user.id,
        action="user.github_login",
        resource_type="user",
        resource_id=str(user.id),
    )

    db.add(audit_log)
    db.commit()

    jwt_access_token = create_access_token(
        subject=user.id
    )

    jwt_refresh_token = create_refresh_token(
        subject=user.id
    )

    return RedirectResponse(
        f"{frontend_url}/auth/callback?"
        f"access_token={jwt_access_token}&"
        f"refresh_token={jwt_refresh_token}"
    )


@router.get("/github/status")
async def github_oauth_status(
    current_user: User = Depends(get_current_user),
):
    return {
        "oauth_configured": bool(
            settings.GITHUB_CLIENT_ID
            and settings.GITHUB_CLIENT_SECRET
        ),
        "connected": bool(
            current_user.github_token
        ),
        "github_username": (
            current_user.github_username
        ),
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

    return {
        "message": "GitHub disconnected",
    }