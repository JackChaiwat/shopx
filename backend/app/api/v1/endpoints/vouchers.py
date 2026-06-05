from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.api.v1.dependencies.auth import CurrentActiveUser, CurrentSeller, DBSession
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.models import Shop, Voucher, VoucherType

router = APIRouter()


class VoucherCreate(BaseModel):
    code: str
    type: VoucherType
    value: Decimal
    min_order_amount: Decimal = Decimal("0")
    max_discount_amount: Optional[Decimal] = None
    usage_limit: Optional[int] = None
    per_user_limit: int = 1
    starts_at: datetime
    expires_at: datetime


@router.post("/validate")
async def validate_voucher(code: str, order_amount: Decimal, current_user: CurrentActiveUser, db: DBSession):
    result = await db.execute(
        select(Voucher).where(
            Voucher.code == code.upper(),
            Voucher.is_active == True,
            Voucher.starts_at <= datetime.now(timezone.utc),
            Voucher.expires_at >= datetime.now(timezone.utc),
        )
    )
    voucher = result.scalar_one_or_none()
    if not voucher:
        raise NotFoundException("Voucher")

    if voucher.min_order_amount and order_amount < voucher.min_order_amount:
        raise BadRequestException(f"Minimum order amount is {voucher.min_order_amount}")

    if voucher.usage_limit and voucher.used_count >= voucher.usage_limit:
        raise BadRequestException("Voucher usage limit reached")

    discount = Decimal("0")
    if voucher.type == VoucherType.PERCENTAGE:
        discount = min(order_amount * voucher.value / 100, voucher.max_discount_amount or order_amount)
    elif voucher.type == VoucherType.FIXED:
        discount = min(voucher.value, order_amount)

    return {
        "success": True,
        "data": {
            "id": str(voucher.id),
            "code": voucher.code,
            "type": voucher.type.value,
            "value": str(voucher.value),
            "discount_amount": str(discount),
        },
    }


@router.post("", status_code=201)
async def create_voucher(body: VoucherCreate, current_user: CurrentSeller, db: DBSession):
    shop_result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise NotFoundException("Shop")

    existing = await db.execute(select(Voucher.id).where(Voucher.code == body.code.upper()))
    if existing.scalar_one_or_none():
        from app.core.exceptions import ConflictException
        raise ConflictException("Voucher code already exists")

    voucher = Voucher(shop_id=shop.id, **{**body.model_dump(), "code": body.code.upper()})
    db.add(voucher)
    await db.commit()
    await db.refresh(voucher)
    return {"success": True, "data": {"id": str(voucher.id), "code": voucher.code}}
