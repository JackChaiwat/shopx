import json
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import settings

_redis_client: Optional[aioredis.Redis] = None


def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
    return _redis_client


async def check_redis_connection() -> None:
    client = get_redis()
    await client.ping()


async def cache_get(key: str) -> Optional[Any]:
    client = get_redis()
    value = await client.get(key)
    if value is None:
        return None
    return json.loads(value)


async def cache_set(key: str, value: Any, ttl: int = settings.REDIS_CACHE_TTL) -> None:
    client = get_redis()
    await client.set(key, json.dumps(value, default=str), ex=ttl)


async def cache_delete(key: str) -> None:
    client = get_redis()
    await client.delete(key)


async def cache_delete_pattern(pattern: str) -> None:
    client = get_redis()
    keys = await client.keys(pattern)
    if keys:
        await client.delete(*keys)


async def rate_limit_check(key: str, limit: int, window: int = 60) -> bool:
    """Returns True if within limit, False if exceeded."""
    client = get_redis()
    pipe = client.pipeline()
    pipe.incr(key)
    pipe.expire(key, window)
    results = await pipe.execute()
    return results[0] <= limit


async def store_refresh_token(user_id: str, token: str, ttl_days: int = 30) -> None:
    client = get_redis()
    key = f"refresh_token:{user_id}:{token[:16]}"
    await client.set(key, token, ex=ttl_days * 86400)


async def verify_refresh_token(user_id: str, token: str) -> bool:
    client = get_redis()
    key = f"refresh_token:{user_id}:{token[:16]}"
    stored = await client.get(key)
    return stored == token


async def revoke_refresh_token(user_id: str, token: str) -> None:
    client = get_redis()
    key = f"refresh_token:{user_id}:{token[:16]}"
    await client.delete(key)


async def revoke_all_refresh_tokens(user_id: str) -> None:
    client = get_redis()
    pattern = f"refresh_token:{user_id}:*"
    keys = await client.keys(pattern)
    if keys:
        await client.delete(*keys)


async def store_otp(key: str, otp: str, ttl: int = 300) -> None:
    client = get_redis()
    await client.set(f"otp:{key}", otp, ex=ttl)


async def verify_otp(key: str, otp: str) -> bool:
    client = get_redis()
    stored = await client.get(f"otp:{key}")
    if stored == otp:
        await client.delete(f"otp:{key}")
        return True
    return False
