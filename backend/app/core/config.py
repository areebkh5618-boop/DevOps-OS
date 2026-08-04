from pydantic_settings import BaseSettings
from typing import List, Optional
from pathlib import Path
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "DevVerse"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "devverse-super-secret-key-change-in-production-2024")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database — SQLite by default so it works without Postgres
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./devverse.db"
    )
    
    # Redis (optional)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]
    
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # Docker
    DOCKER_HOST: Optional[str] = os.getenv("DOCKER_HOST", "unix:///var/run/docker.sock")
    
    # Kubernetes
    KUBECONFIG: Optional[str] = os.getenv("KUBECONFIG", None)
    K8S_IN_CLUSTER: bool = os.getenv("K8S_IN_CLUSTER", "false").lower() == "true"
    
    # GitHub OAuth App (create at https://github.com/settings/developers)
    GITHUB_CLIENT_ID: Optional[str] = os.getenv("GITHUB_CLIENT_ID", None)
    GITHUB_CLIENT_SECRET: Optional[str] = os.getenv("GITHUB_CLIENT_SECRET", None)
    GITHUB_REDIRECT_URI: str = os.getenv(
        "GITHUB_REDIRECT_URI",
        "http://localhost:8000/api/v1/auth/github/callback"
    )
    # Optional org-level PAT fallback for server-side calls
    GITHUB_TOKEN: Optional[str] = os.getenv("GITHUB_TOKEN", None)
    GITHUB_API_URL: str = "https://api.github.com"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 120
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    class Config:
        # Resolve .env from the backend directory so settings load when
        # the app is started from the project root with --app-dir backend.
        base_dir = Path(__file__).resolve().parents[2]
        env_file = str(base_dir / ".env")
        case_sensitive = True


settings = Settings()
