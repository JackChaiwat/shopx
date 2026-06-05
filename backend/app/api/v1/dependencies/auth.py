from typing import Annotated, Optional
from uuid import UUID

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import rate_limit_check
from app.core.exceptions import ForbiddenException, RateLimitException, UnauthorizedException
from app.core.security import decode_token
from app.db.session import get_db
from app.models.models import User, UserRole, UserStatus
from app.db.repositories.user_repository import UserRepository

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise UnauthorizedException("Authorization header missing")

    token = credentials.credentials
    payload = decode_token(token)

    if payload.get("type") != "access":
        raise UnauthorizedException("Invalid token type")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Invalid token payload")

    repo = UserRepository(db)
    user = await repo.get_by_id(UUID(user_id))
    if not user:
        raise UnauthorizedException("User not found")

    if user.status == UserStatus.SUSPENDED:
        raise ForbiddenException("Account suspended")

    if user.is_deleted:
        raise UnauthorizedException("Account not found")

    return user


async def get_current_user_optional(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not credentials:
        return None
    try:
        return await get_current_user(credentials, db)
    except Exception:
        return None


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.status != UserStatus.ACTIVE:
        raise ForbiddenException("Account is not active")
    return current_user


async def require_seller(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    if current_user.role not in (UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise ForbiddenException("Seller account required")
    return current_user


async def require_admin(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    if current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise ForbiddenException("Admin access required")
    return current_user


async def require_super_admin(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    if current_user.role != UserRole.SUPER_ADMIN:
        raise ForbiddenException("Super admin access required")
    return current_user


async def check_rate_limit(
    x_forwarded_for: Optional[str] = Header(None),
    x_real_ip: Optional[str] = Header(None),
) -> None:
    ip = x_forwarded_for or x_real_ip or "unknown"
    key = f"rate_limit:{ip}"
    allowed = await rate_limit_check(key, limit=60, window=60)
    if not allowed:
        raise RateLimitException()


# Type aliases for cleaner endpoint signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentActiveUser = Annotated[User, Depends(get_current_active_user)]
CurrentSeller = Annotated[User, Depends(require_seller)]
CurrentAdmin = Annotated[User, Depends(require_admin)]
OptionalUser = Annotated[Optional[User], Depends(get_current_user_optional)]
DBSession = Annotated[AsyncSession, Depends(get_db)]
