from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pathlib import Path
import os

from models.database import get_db, Track
from pydantic import BaseModel


router = APIRouter(prefix="/tracks", tags=["tracks"])


class TrackOut(BaseModel):
    id: int
    title: str
    artist: str
    album: str
    duration: float
    source_url: str
    source_type: str
    cover_url: str

    class Config:
        from_attributes = True


def track_to_out(track: Track) -> TrackOut:
    cover_url = ""
    if track.cover_path and Path(track.cover_path).exists():
        cover_url = f"/tracks/{track.id}/cover"
    return TrackOut(
        id=track.id,
        title=track.title,
        artist=track.artist,
        album=track.album,
        duration=track.duration,
        source_url=track.source_url,
        source_type=track.source_type,
        cover_url=cover_url,
    )


@router.get("/", response_model=list[TrackOut])
async def list_tracks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Track).order_by(Track.created_at.desc()))
    tracks = result.scalars().all()
    return [track_to_out(t) for t in tracks]


@router.get("/{track_id}", response_model=TrackOut)
async def get_track(track_id: int, db: AsyncSession = Depends(get_db)):
    track = await db.get(Track, track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track_to_out(track)


@router.get("/{track_id}/audio")
async def stream_audio(track_id: int, db: AsyncSession = Depends(get_db)):
    track = await db.get(Track, track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    file_path = Path(track.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(
        str(file_path),
        media_type="audio/mpeg",
        headers={"Accept-Ranges": "bytes"},
    )


@router.get("/{track_id}/cover")
async def get_cover(track_id: int, db: AsyncSession = Depends(get_db)):
    track = await db.get(Track, track_id)
    if not track or not track.cover_path:
        raise HTTPException(status_code=404, detail="Cover not found")
    cover_path = Path(track.cover_path)
    if not cover_path.exists():
        raise HTTPException(status_code=404, detail="Cover file not found")
    return FileResponse(str(cover_path), media_type="image/jpeg")


@router.delete("/{track_id}")
async def delete_track(track_id: int, db: AsyncSession = Depends(get_db)):
    track = await db.get(Track, track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    #deleting files
    for path in [track.file_path, track.cover_path]:
        if path:
            try:
                os.remove(path)
            except FileNotFoundError:
                pass

    await db.delete(track)
    await db.commit()
    return {"ok": True}