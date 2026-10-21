import asyncio
import json
import logging
from typing import Dict, Set, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class ProjectEventManager:
    def __init__(self):
        # Maps project_id -> Set of asyncio.Queue
        self._subscribers: Dict[int, Set[asyncio.Queue]] = {}
        # Global subscribers (listen to any project activity)
        self._global_subscribers: Set[asyncio.Queue] = set()

    def subscribe(self, project_id: int) -> asyncio.Queue:
        """Subscribe a client queue to events for a specific project."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        if project_id == 0:
            self._global_subscribers.add(queue)
        else:
            if project_id not in self._subscribers:
                self._subscribers[project_id] = set()
            self._subscribers[project_id].add(queue)
        return queue

    def unsubscribe(self, project_id: int, queue: asyncio.Queue):
        """Unsubscribe and cleanup an active client queue."""
        if project_id == 0:
            self._global_subscribers.discard(queue)
        elif project_id in self._subscribers:
            self._subscribers[project_id].discard(queue)
            if not self._subscribers[project_id]:
                del self._subscribers[project_id]

    def broadcast(self, project_id: int, event_type: str, data: Optional[Dict[str, Any]] = None):
        """
        Non-blocking broadcast to all active SSE subscribers for this project.
        Can safely be called from both sync (def) and async (async def) routes.
        """
        payload = {
            "type": event_type,
            "project_id": project_id,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data or {}
        }

        # Gather target queues (project-specific + global)
        target_queues = list(self._subscribers.get(project_id, set())) + list(self._global_subscribers)
        if not target_queues:
            return

        dead_queues = []
        for queue in target_queues:
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                dead_queues.append(queue)
            except Exception as e:
                logger.warning(f"Failed to deliver SSE event to queue: {e}")
                dead_queues.append(queue)

        for q in dead_queues:
            self.unsubscribe(project_id, q)
            self._global_subscribers.discard(q)

project_event_manager = ProjectEventManager()
