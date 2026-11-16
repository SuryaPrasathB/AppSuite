import asyncio
import logging
from typing import Dict, Set, Optional, Any, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


class ProjectEventManager:
    def __init__(self):
        # Maps (tenant_id, project_id) -> Set of asyncio.Queue
        self._subscribers: Dict[Tuple[int, int], Set[asyncio.Queue]] = {}
        # Maps tenant_id -> Set of asyncio.Queue (tenant-scoped global subscribers)
        self._tenant_global_subscribers: Dict[int, Set[asyncio.Queue]] = {}

    def subscribe(self, project_id: int, tenant_id: int = 1) -> asyncio.Queue:
        """Subscribe a client queue to events for a specific project within a tenant."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        if project_id == 0:
            self._tenant_global_subscribers.setdefault(tenant_id, set()).add(queue)
        else:
            key = (tenant_id, project_id)
            self._subscribers.setdefault(key, set()).add(queue)
        return queue

    def unsubscribe(self, project_id: int, queue: asyncio.Queue, tenant_id: int = 1):
        """Unsubscribe and cleanup an active client queue."""
        if project_id == 0:
            subs = self._tenant_global_subscribers.get(tenant_id)
            if subs:
                subs.discard(queue)
                if not subs:
                    del self._tenant_global_subscribers[tenant_id]
        else:
            key = (tenant_id, project_id)
            subs = self._subscribers.get(key)
            if subs:
                subs.discard(queue)
                if not subs:
                    del self._subscribers[key]

    def broadcast(
        self,
        project_id: int,
        event_type: str,
        data: Optional[Dict[str, Any]] = None,
        tenant_id: int = 1,
    ):
        """
        Non-blocking broadcast to all active SSE subscribers for this tenant + project.
        Can safely be called from both sync (def) and async (async def) routes.
        """
        payload = {
            "type": event_type,
            "tenant_id": tenant_id,
            "project_id": project_id,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data or {},
        }

        project_queues = list(self._subscribers.get((tenant_id, project_id), set()))
        global_queues = list(self._tenant_global_subscribers.get(tenant_id, set()))
        target_queues = project_queues + global_queues
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
            self.unsubscribe(project_id, q, tenant_id=tenant_id)
            self.unsubscribe(0, q, tenant_id=tenant_id)


project_event_manager = ProjectEventManager()
