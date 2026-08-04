from typing import Optional
from app.core.config import settings
try:
    from redis import asyncio as aioredis
except Exception:  # pragma: no cover - imported at runtime
    aioredis = None

_redis: Optional[aioredis.Redis] = None


def redis_available() -> bool:
    return aioredis is not None and bool(settings.REDIS_URL)


async def get_redis():
    """Return a global Redis asyncio client or None if not configured."""
    global _redis
    if not redis_available():
        return None
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis
