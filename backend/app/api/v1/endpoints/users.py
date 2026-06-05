from decimal import Decimal
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel, EmailStr

from app.api.v1.dependencies.auth import CurrentActiveUser, DBSession
from app.core.config import settings
from app.core.exceptions import BadRequestException, NotFoundException
from app.db.repositories.user_repository import UserRepository
from app.models.models import UserAddress
from app.services.storage import storage_service

logger = structlog.get_logger(__name__)
router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    username: Optional[str] = None


class AddressRequest(BaseModel):
    label: str = "Home"
    recipient_name: str
    phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str = "TH"
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    is_default: bool = False


def _address_dict(addr: UserAddress) -> dict:
    return {
        "id": str(addr.id),
        "label": addr.label,
        "recipient_name": addr.recipient_name,
        "phone": addr.phone,
        "address_line1": addr.address_line1,
        "address_line2": addr.address_line2,
        "city": addr.city,
        "state": addr.state,
        "postal_code": addr.postal_code,
        "country": addr.country,
        "latitude": str(addr.latitude) if addr.latitude is not None else None,
        "longitude": str(addr.longitude) if addr.longitude is not None else None,
        "is_default": addr.is_default,
    }


@router.get("/me")
async def get_profile(current_user: CurrentActiveUser):
    return {
        "success": True,
        "data": {
            "id": str(current_user.id),
            "email": current_user.email,
            "phone": current_user.phone,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "avatar_url": current_user.avatar_url,
            "role": current_user.role.value,
            "status": current_user.status.value,
            "is_email_verified": current_user.is_email_verified,
            "wallet_balance": str(current_user.wallet_balance),
            "created_at": current_user.created_at.isoformat(),
        },
    }


@router.patch("/me")
async def update_profile(body: UpdateProfileRequest, current_user: CurrentActiveUser, db: DBSession):
    repo = UserRepository(db)
    updates = body.model_dump(exclude_none=True)
    if updates:
        user = await repo.update(current_user, **updates)
    else:
        user = current_user
    return {"success": True, "data": {"id": str(user.id), "full_name": user.full_name}}


@router.post("/me/avatar")
async def upload_avatar(
    current_user: CurrentActiveUser,
    db: DBSession,
    file: UploadFile = File(...),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise BadRequestException("Only JPEG, PNG, and WebP images are allowed")

    data = await file.read()
    if len(data) > MAX_AVATAR_SIZE:
        raise BadRequestException("Avatar image must be under 5MB")

    url = await storage_service.upload_file(
        file_data=data,
        bucket=settings.MINIO_BUCKET_AVATARS,
        content_type=file.content_type,
    )

    repo = UserRepository(db)
    user = await repo.update(current_user, avatar_url=url)
    return {"success": True, "data": {"avatar_url": url}}


@router.get("/me/addresses")
async def get_addresses(current_user: CurrentActiveUser, db: DBSession):
    from sqlalchemy import select
    from app.models.models import UserAddress as UA
    result = await db.execute(select(UA).where(UA.user_id == current_user.id).order_by(UA.is_default.desc(), UA.created_at.desc()))
    addresses = result.scalars().all()
    return {"success": True, "data": [_address_dict(a) for a in addresses]}


@router.post("/me/addresses", status_code=201)
async def add_address(body: AddressRequest, current_user: CurrentActiveUser, db: DBSession):
    from sqlalchemy import update
    from app.models.models import UserAddress as UA

    if body.is_default:
        await db.execute(
            update(UA).where(UA.user_id == current_user.id).values(is_default=False)
        )

    addr = UserAddress(user_id=current_user.id, **body.model_dump())
    db.add(addr)
    await db.commit()
    await db.refresh(addr)
    return {"success": True, "data": _address_dict(addr)}


@router.put("/me/addresses/{address_id}")
async def update_address(
    address_id: UUID,
    body: AddressRequest,
    current_user: CurrentActiveUser,
    db: DBSession,
):
    from sqlalchemy import select, update
    from app.models.models import UserAddress as UA

    result = await db.execute(
        select(UA).where(UA.id == address_id, UA.user_id == current_user.id)
    )
    addr = result.scalar_one_or_none()
    if not addr:
        raise NotFoundException("Address", address_id)

    if body.is_default:
        await db.execute(
            update(UA).where(UA.user_id == current_user.id).values(is_default=False)
        )

    for k, v in body.model_dump().items():
        setattr(addr, k, v)
    await db.commit()
    await db.refresh(addr)
    return {"success": True, "data": _address_dict(addr)}


@router.delete("/me/addresses/{address_id}", status_code=204)
async def delete_address(address_id: UUID, current_user: CurrentActiveUser, db: DBSession):
    from sqlalchemy import select
    from app.models.models import UserAddress as UA

    result = await db.execute(
        select(UA).where(UA.id == address_id, UA.user_id == current_user.id)
    )
    addr = result.scalar_one_or_none()
    if not addr:
        raise NotFoundException("Address", address_id)
    await db.delete(addr)
    await db.commit()
