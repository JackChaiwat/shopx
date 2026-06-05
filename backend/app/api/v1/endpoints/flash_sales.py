"""Flash Sales"""
from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

router = APIRouter()

from app.api.v1.dependencies.auth import DBSession, OptionalUser


@router.get("")
async def list_active_flash_sales(db: DBSession):
    from app.models.models import FlashSale
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(FlashSale)
        .options(selectinload(FlashSale.items))
        .where(FlashSale.is_active == True, FlashSale.starts_at <= now, FlashSale.ends_at >= now)
    )
    sales = result.scalars().all()
    return {
        "success": True,
        "data": [
            {
                "id": str(s.id),
                "name": s.name,
                "starts_at": s.starts_at.isoformat(),
                "ends_at": s.ends_at.isoformat(),
                "item_count": len(s.items),
            }
            for s in sales
        ],
    }
