import json
from datetime import datetime, timezone
from uuid import UUID

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_token
from app.websocket.manager import connection_manager

logger = structlog.get_logger(__name__)
ws_router = APIRouter()


async def authenticate_ws(websocket: WebSocket) -> str | None:
    """Authenticate WebSocket via token query param."""
    token = websocket.query_params.get("token")
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        return payload.get("sub")
    except Exception:
        return None


@ws_router.websocket("/notifications")
async def notifications_ws(websocket: WebSocket):
    user_id = await authenticate_ws(websocket)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await connection_manager.connect(websocket, user_id)
    try:
        await connection_manager.send_to_user(user_id, {
            "type": "connected",
            "message": "Connected to notifications",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        while True:
            # Keep connection alive, handle pings
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        connection_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error("WS notification error", user_id=user_id, error=str(e))
        connection_manager.disconnect(websocket, user_id)


@ws_router.websocket("/chat/{room_id}")
async def chat_ws(websocket: WebSocket, room_id: str):
    user_id = await authenticate_ws(websocket)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await connection_manager.connect(websocket, user_id)
    connection_manager.join_room(room_id, user_id)

    try:
        await connection_manager.send_to_user(user_id, {
            "type": "room_joined",
            "room_id": room_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

            elif msg.get("type") == "typing":
                await connection_manager.broadcast_to_room(
                    room_id,
                    {"type": "typing", "user_id": user_id, "room_id": room_id},
                    exclude_user=user_id,
                )

    except WebSocketDisconnect:
        connection_manager.leave_room(room_id, user_id)
        connection_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error("WS chat error", user_id=user_id, room_id=room_id, error=str(e))
        connection_manager.leave_room(room_id, user_id)
        connection_manager.disconnect(websocket, user_id)
