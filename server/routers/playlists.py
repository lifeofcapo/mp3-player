from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional

from models.database import get_db, Playlist, PlaylistTrack, Track
from routers.tracks import TrackOut, track_to_out


router = APIRouter(prefix="/playlists", tags=["playlists"])


class PlaylistCreate(BaseModel):
    name: str


class PlaylistOut(BaseModel):
    id: int
    name: str
    track_count: int


class PlaylistDetail(BaseModel):
    id: int
    name: str
    tracks: list[TrackOut]


class AddTrackRequest(BaseModel):
    track_id: int


@router.get("/", response_model=list[PlaylistOut])
async def list_playlists(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Playlist).order_by(Playlist.created_at.desc()))
    playlists = result.scalars().all()
    out = []
    for pl in playlists:
        count_res = await db.execute(
            select(func.count(PlaylistTrack.id)).where(PlaylistTrack.playlist_id == pl.id)
        )
        count = count_res.scalar() or 0
        out.append(PlaylistOut(id=pl.id, name=pl.name, track_count=count))
    return out


@router.post("/", response_model=PlaylistOut)
async def create_playlist(data: PlaylistCreate, db: AsyncSession = Depends(get_db)):
    pl = Playlist(name=data.name)
    db.add(pl)
    await db.commit()
    await db.refresh(pl)
    return PlaylistOut(id=pl.id, name=pl.name, track_count=0)


@router.get("/{playlist_id}", response_model=PlaylistDetail)
async def get_playlist(playlist_id: int, db: AsyncSession = Depends(get_db)):
    pl = await db.get(Playlist, playlist_id)
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")

    result = await db.execute(
        select(PlaylistTrack, Track)
        .join(Track, PlaylistTrack.track_id == Track.id)
        .where(PlaylistTrack.playlist_id == playlist_id)
        .order_by(PlaylistTrack.position)
    )
    rows = result.all()
    tracks = [track_to_out(row.Track) for row in rows]
    return PlaylistDetail(id=pl.id, name=pl.name, tracks=tracks)


@router.post("/{playlist_id}/tracks")
async def add_track_to_playlist(
    playlist_id: int,
    data: AddTrackRequest,
    db: AsyncSession = Depends(get_db)
):
    pl = await db.get(Playlist, playlist_id)
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")

    track = await db.get(Track, data.track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    count_res = await db.execute(
        select(func.count(PlaylistTrack.id)).where(PlaylistTrack.playlist_id == playlist_id)
    )
    count = count_res.scalar() or 0

    pt = PlaylistTrack(playlist_id=playlist_id, track_id=data.track_id, position=count)
    db.add(pt)
    await db.commit()
    return {"ok": True}


@router.delete("/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(
    playlist_id: int,
    track_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(PlaylistTrack).where(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.track_id == track_id,
        )
    )
    pt = result.scalar_one_or_none()
    if not pt:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(pt)
    await db.commit()
    return {"ok": True}


@router.delete("/{playlist_id}")
async def delete_playlist(playlist_id: int, db: AsyncSession = Depends(get_db)):
    pl = await db.get(Playlist, playlist_id)
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    await db.delete(pl)
    await db.commit()
    return {"ok": True}