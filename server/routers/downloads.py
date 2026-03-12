from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from models.database import get_db, Track, DownloadJob, PlaylistTrack, AsyncSessionLocal
from services.downloader import detect_source, download_track
from services.queue import download_queue


router = APIRouter(prefix="/downloads", tags=["downloads"])


class DownloadRequest(BaseModel):
    url: str
    playlist_id: int | None = None


class JobOut(BaseModel):
    id: int
    status: str
    progress: float
    error: str
    track_id: int | None


@router.post("/", response_model=JobOut)
async def start_download(req: DownloadRequest, db: AsyncSession = Depends(get_db)):
    url = req.url.strip()
    source = detect_source(url)

    if source == "unknown":
        raise HTTPException(
            status_code=400,
            detail="Неподдерживаемый источник. Используй ссылки YouTube, SoundCloud, Spotify или VK.",
        )

    if source == "vk_audio_unsupported":
        raise HTTPException(
            status_code=400,
            detail=(
                "Ссылки vk.com/audio... не поддерживаются — VK закрыл к ним доступ для внешних инструментов. "
                "Попробуй найти этот трек на YouTube или SoundCloud."
            ),
        )

    job = DownloadJob(url=url, status="pending")
    db.add(job)
    await db.commit()
    await db.refresh(job)
    job_id = job.id
    playlist_id = req.playlist_id

    async def coro_factory(progress_cb):
        meta = await download_track(url, source, progress_cb)

        async with AsyncSessionLocal() as session:
            track = Track(
                title=meta["title"],
                artist=meta["artist"],
                album=meta.get("album", ""),
                duration=meta["duration"],
                source_url=url,
                source_type=meta["source_type"],
                file_path=meta["file_path"],
                cover_path=meta.get("cover_path", ""),
            )
            session.add(track)
            await session.commit()
            await session.refresh(track)

            if playlist_id:
                count_result = await session.execute(
                    select(func.count(PlaylistTrack.id)).where(
                        PlaylistTrack.playlist_id == playlist_id
                    )
                )
                count = count_result.scalar() or 0
                pt = PlaylistTrack(playlist_id=playlist_id, track_id=track.id, position=count)
                session.add(pt)
                await session.commit()

            j = await session.get(DownloadJob, job_id)
            if j:
                j.status = "done"
                j.track_id = track.id
                await session.commit()

            return {"track_id": track.id}

    await download_queue.enqueue(job_id, coro_factory)
    return JobOut(id=job_id, status="pending", progress=0, error="", track_id=None)


@router.get("/{job_id}", response_model=JobOut)
async def get_job_status(job_id: int):
    job = download_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobOut(
        id=job["id"], status=job["status"], progress=job["progress"],
        error=job["error"], track_id=job.get("track_id"),
    )


@router.get("/", response_model=list[JobOut])
async def list_jobs():
    return [
        JobOut(id=j["id"], status=j["status"], progress=j["progress"],
               error=j["error"], track_id=j.get("track_id"))
        for j in download_queue.all_jobs()
    ]