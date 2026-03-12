from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from models.database import init_db
from routers import tracks, downloads, playlists
from routers import cookies


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Mp3Player API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tracks.router)
app.include_router(downloads.router)
app.include_router(playlists.router)
app.include_router(cookies.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}