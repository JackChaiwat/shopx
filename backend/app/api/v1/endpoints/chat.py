"""Chat endpoint"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.api.v1.dependencies.auth import CurrentActiveUser, DBSession
from app.core.config import settings
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.models import ChatRoom, Message, Notification, NotificationType, Order, Shop
from app.services.storage import storage_service
from app.websocket.manager import connection_manager

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


class SendMessageRequest(BaseModel):
    content: Optional[str] = None
    image_url: Optional[str] = None


def _message_dict(m: Message) -> dict:
    return {
        "id": str(m.id),
        "room_id": str(m.room_id),
        "sender_id": str(m.sender_id),
        "content": m.content,
        "image_url": m.image_url,
        "is_read": m.is_read,
        "created_at": m.created_at.isoformat(),
    }


def _add_notification(db: DBSession, user_id, notification_type: NotificationType, title: str, body: str, action_url: Optional[str] = None, metadata: Optional[dict] = None) -> None:
    db.add(Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        body=body,
        action_url=action_url,
        notif_metadata=metadata,
    ))


def _room_dict(room: ChatRoom, current_user_id) -> dict:
    return {
        "id": str(room.id),
        "shop_id": str(room.shop_id),
        "shop_name": room.shop.name if room.shop else None,
        "buyer_id": str(room.buyer_id),
        "buyer_name": room.buyer.full_name if room.buyer else None,
        "buyer_email": room.buyer.email if room.buyer else None,
        "buyer_unread_count": room.buyer_unread_count,
        "seller_unread_count": room.seller_unread_count,
        "unread_count": room.buyer_unread_count if room.buyer_id == current_user_id else room.seller_unread_count,
        "last_message_at": room.last_message_at.isoformat() if room.last_message_at else None,
    }


@router.get("/rooms")
async def list_rooms(current_user: CurrentActiveUser, db: DBSession):
    shop_result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id))
    shop = shop_result.scalar_one_or_none()
    query = select(ChatRoom).options(selectinload(ChatRoom.shop), selectinload(ChatRoom.buyer))
    if shop:
        query = query.where(ChatRoom.shop_id == shop.id)
    else:
        query = query.where(ChatRoom.buyer_id == current_user.id)
    query = query.order_by(ChatRoom.last_message_at.desc().nullslast())
    result = await db.execute(query)
    rooms = result.scalars().all()
    return {"success": True, "data": [_room_dict(r, current_user.id) for r in rooms]}


@router.post("/rooms/{shop_id}", status_code=201)
async def get_or_create_room(shop_id: UUID, current_user: CurrentActiveUser, db: DBSession):
    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
    if not shop_result.scalar_one_or_none():
        raise NotFoundException("Shop", shop_id)

    result = await db.execute(
        select(ChatRoom).where(ChatRoom.buyer_id == current_user.id, ChatRoom.shop_id == shop_id)
    )
    room = result.scalar_one_or_none()
    if not room:
        room = ChatRoom(buyer_id=current_user.id, shop_id=shop_id)
        db.add(room)
        await db.commit()
        await db.refresh(room)

    return {"success": True, "data": {"id": str(room.id), "shop_id": str(room.shop_id)}}


@router.post("/rooms/by-order/{order_id}", status_code=201)
async def get_or_create_room_by_order(order_id: UUID, current_user: CurrentActiveUser, db: DBSession):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.shop), selectinload(Order.buyer))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundException("Order", order_id)
    is_buyer = order.buyer_id == current_user.id
    is_seller = order.shop and order.shop.owner_id == current_user.id
    if not (is_buyer or is_seller):
        raise ForbiddenException()

    room_result = await db.execute(
        select(ChatRoom)
        .options(selectinload(ChatRoom.shop), selectinload(ChatRoom.buyer))
        .where(ChatRoom.buyer_id == order.buyer_id, ChatRoom.shop_id == order.shop_id)
    )
    room = room_result.scalar_one_or_none()
    if not room:
        room = ChatRoom(buyer_id=order.buyer_id, shop_id=order.shop_id)
        db.add(room)
        await db.commit()
        await db.refresh(room)
        room = (await db.execute(
            select(ChatRoom)
            .options(selectinload(ChatRoom.shop), selectinload(ChatRoom.buyer))
            .where(ChatRoom.id == room.id)
        )).scalar_one()
    return {"success": True, "data": _room_dict(room, current_user.id)}


@router.get("/rooms/{room_id}/messages")
async def get_messages(
    room_id: UUID,
    current_user: CurrentActiveUser,
    db: DBSession,
    page: int = 1,
    limit: int = 50,
):
    room_result = await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise NotFoundException("Chat room", room_id)

    # Check access
    shop_result = await db.execute(select(Shop).where(Shop.id == room.shop_id))
    shop = shop_result.scalar_one_or_none()
    is_buyer = room.buyer_id == current_user.id
    is_seller = shop and shop.owner_id == current_user.id
    if not (is_buyer or is_seller):
        raise ForbiddenException()

    if is_buyer and room.buyer_unread_count:
        room.buyer_unread_count = 0
        await db.commit()
    elif is_seller and room.seller_unread_count:
        room.seller_unread_count = 0
        await db.commit()

    result = await db.execute(
        select(Message)
        .where(Message.room_id == room_id)
        .order_by(Message.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    messages = result.scalars().all()
    return {"success": True, "data": [_message_dict(m) for m in reversed(messages)]}


@router.post("/rooms/{room_id}/messages", status_code=201)
async def send_message(
    room_id: UUID,
    body: SendMessageRequest,
    current_user: CurrentActiveUser,
    db: DBSession,
):
    if not body.content and not body.image_url:
        raise BadRequestException("Message must have content or image")

    room_result = await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise NotFoundException("Chat room", room_id)

    shop_result = await db.execute(select(Shop).where(Shop.id == room.shop_id))
    shop = shop_result.scalar_one_or_none()
    is_buyer = room.buyer_id == current_user.id
    is_seller = shop and shop.owner_id == current_user.id
    if not (is_buyer or is_seller):
        raise ForbiddenException()

    msg = Message(
        room_id=room_id,
        sender_id=current_user.id,
        content=body.content,
        image_url=body.image_url,
    )
    db.add(msg)

    room.last_message_at = datetime.now(timezone.utc)
    preview = (body.content or "Sent an image").strip()
    if len(preview) > 120:
        preview = preview[:117] + "..."
    sender_name = current_user.full_name or current_user.email
    if is_buyer:
        room.seller_unread_count += 1
        if shop and shop.owner_id:
            _add_notification(
                db,
                shop.owner_id,
                NotificationType.CHAT,
                title=sender_name,
                body=preview,
                action_url=f"/chat?room_id={room.id}",
                metadata={
                    "room_id": str(room.id),
                    "shop_id": str(room.shop_id),
                    "buyer_id": str(room.buyer_id),
                    "sender_name": sender_name,
                },
            )
    else:
        room.buyer_unread_count += 1
        sender_name = shop.name if shop else sender_name
        _add_notification(
            db,
            room.buyer_id,
            NotificationType.CHAT,
            title=sender_name,
            body=preview,
            action_url=f"/chat?room_id={room.id}",
            metadata={
                "room_id": str(room.id),
                "shop_id": str(room.shop_id),
                "sender_name": sender_name,
            },
        )

    await db.commit()
    await db.refresh(msg)

    # Broadcast via WebSocket
    msg_data = _message_dict(msg)
    await connection_manager.broadcast_to_room(str(room_id), {"type": "new_message", "data": msg_data})

    return {"success": True, "data": msg_data}
