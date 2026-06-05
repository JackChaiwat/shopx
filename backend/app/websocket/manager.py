import json
from collections import defaultdict
from typing import Dict, List, Optional
from uuid import UUID

import structlog
from fastapi import WebSocket

logger = structlog.get_logger(__name__)


class ConnectionManager:
    def __init__(self):
        # user_id -> list of WebSocket connections (multiple tabs/devices)
        self._connections: Dict[str, List[WebSocket]] = defaultdict(list)
        # room_id -> set of connected user_ids
        self._room_users: Dict[str, set] = defaultdict(set)

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self._connections[user_id].append(websocket)
        logger.info("WS connected", user_id=user_id)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self._connections:
            try:
                self._connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self._connections[user_id]:
                del self._connections[user_id]
        logger.info("WS disconnected", user_id=user_id)

    def join_room(self, room_id: str, user_id: str):
        self._room_users[room_id].add(user_id)

    def leave_room(self, room_id: str, user_id: str):
        self._room_users[room_id].discard(user_id)

    async def send_to_user(self, user_id: str, message: dict):
        """Send message to all connections of a user."""
        connections = self._connections.get(user_id, [])
        dead = []
        for ws in connections:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            try:
                self._connections[user_id].remove(ws)
            except ValueError:
                pass

    async def broadcast_to_room(self, room_id: str, message: dict, exclude_user: Optional[str] = None):
        """Broadcast to all users in a chat room."""
        user_ids = self._room_users.get(room_id, set()).copy()
        for user_id in user_ids:
            if user_id != exclude_user:
                await self.send_to_user(user_id, message)

    def is_online(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))

    def online_count(self) -> int:
        return len(self._connections)


connection_manager = ConnectionManager()
