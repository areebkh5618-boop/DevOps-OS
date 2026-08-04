import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from app.api.v1 import auth, dashboard, docker, github, kubernetes, terminal
from app.core.config import settings
from app.db.session import Base, engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting DevVerse API...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified")
    except Exception as e:
        logger.warning(f"Database init warning: {e}")
    yield
    # Shutdown
    logger.info("Shutting down DevVerse API...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="The Ultimate Browser-Based DevOps Operating System",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS + ["*"] if settings.DEBUG else settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Rate limiting middleware (simple in-memory)
request_counts: dict = {}


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = 60  # 1 minute

    if client_ip not in request_counts:
        request_counts[client_ip] = []
    
    # Clean old requests
    request_counts[client_ip] = [t for t in request_counts[client_ip] if now - t < window]
    
    if len(request_counts[client_ip]) >= settings.RATE_LIMIT_PER_MINUTE:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Try again later."},
        )
    
    request_counts[client_ip].append(now)
    response = await call_next(request)
    return response


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    process_time = time.time() - start
    response.headers["X-Process-Time"] = str(round(process_time, 4))
    return response


# Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(docker.router, prefix=settings.API_V1_STR)
app.include_router(kubernetes.router, prefix=settings.API_V1_STR)
app.include_router(github.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(terminal.router, prefix=settings.API_V1_STR)


# Compatibility redirects: some OAuth apps may be configured without the API
# version prefix (e.g. `/api/auth/github/callback`). Provide top-level
# redirects to the v1 routes so GitHub redirect URIs that omit `/v1` do not
# return 404.
@app.get("/api/auth/github")
async def compat_github_start(request: Request):
    qs = request.scope.get("query_string", b"").decode("utf-8")
    target = f"{settings.API_V1_STR}/auth/github"
    if qs:
        target = f"{target}?{qs}"
    return RedirectResponse(target)


@app.get("/api/auth/github/callback")
async def compat_github_callback(request: Request):
    qs = request.scope.get("query_string", b"").decode("utf-8")
    target = f"{settings.API_V1_STR}/auth/github/callback"
    if qs:
        target = f"{target}?{qs}"
    return RedirectResponse(target)


@app.get("/")
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "tagline": "The Ultimate Browser-Based DevOps Operating System",
        "docs": "/docs",
        "status": "operational",
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "version": settings.VERSION}
