from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import select, update

from app.api.v1.dependencies.auth import CurrentActiveUser, DBSession
from app.core.exceptions import NotFoundException
from app.models.models import Notification

router = APIRouter()


@router.get("")
async def list_notifications(
    current_user: CurrentActiveUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    unread_only: bool = False,
):
    query = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        query = query.where(Notification.is_read == False)
    query = query.order_by(Notification.created_at.desc())

    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    notifications = result.scalars().all()

    return {
        "success": True,
        "data": [
            {
                "id": str(n.id),
                "type": n.type.value,
                "title": n.title,
                "body": n.body,
                "image_url": n.image_url,
                "action_url": n.action_url,
                "metadata": n.notif_metadata or {},
                "is_read": n.is_read,
                "read_at": n.read_at.isoformat() if n.read_at else None,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifications
        ],
    }


@router.post("/{notification_id}/read")
async def mark_read(notification_id: UUID, current_user: CurrentActiveUser, db: DBSession):
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise NotFoundException("Notification", notification_id)
    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": True}


@router.post("/read-all")
async def mark_all_read(current_user: CurrentActiveUser, db: DBSession):
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True, read_at=now)
    )
    await db.commit()
    return {"success": True, "message": "All notifications marked as read"}


@router.get("/unread-count")
async def unread_count(current_user: CurrentActiveUser, db: DBSession):
    from sqlalchemy import func
    result = await db.execute(
        select(func.count(Notification.id))
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
    )
    count = result.scalar() or 0
    return {"success": True, "data": {"count": count}}
