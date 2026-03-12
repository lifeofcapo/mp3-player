import asyncio
import logging
from typing import Dict, Optional, Callable
from datetime import datetime

logger = logging.getLogger(__name__)


class DownloadQueue:
    def __init__(self, max_concurrent: int = 2):
        self.max_concurrent = max_concurrent
        self._queue: asyncio.Queue = asyncio.Queue()
        self._jobs: Dict[int, dict] = {}  # job_id -> status dict
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._running = False

    def get_job(self, job_id: int) -> Optional[dict]:
        return self._jobs.get(job_id)

    def all_jobs(self) -> list:
        return list(self._jobs.values())

    async def enqueue(self, job_id: int, coro_factory: Callable) -> None:
        self._jobs[job_id] = {
            "id": job_id,
            "status": "pending",
            "progress": 0,
            "error": "",
            "track_id": None,
            "created_at": datetime.utcnow().isoformat(),
        }
        asyncio.create_task(self._process(job_id, coro_factory))

    async def _process(self, job_id: int, coro_factory: Callable):
        async with self._semaphore:
            job = self._jobs[job_id]
            job["status"] = "downloading"

            def on_progress(p: float):
                job["progress"] = round(p, 1)

            try:
                result = await coro_factory(on_progress)
                job["status"] = "done"
                job["progress"] = 100
                job["track_id"] = result.get("track_id")
            except Exception as e:
                error_text = str(e).strip()
                if len(error_text) > 300:
                    error_text = error_text[:300] + "..."
                job["status"] = "error"
                job["error"] = error_text
                logger.error("Job %d failed: %s", job_id, error_text)


download_queue = DownloadQueue(max_concurrent=2)