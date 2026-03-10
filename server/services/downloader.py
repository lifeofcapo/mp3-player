import asyncio
import re
import uuid
import subprocess
from pathlib import Path
import yt_dlp
from mutagen.mp3 import MP3
from mutagen.id3 import ID3
from PIL import Image
import io

from config import settings


def detect_source(url: str) -> str:
    url = url.lower()
    if "spotify.com" in url:
        return "spotify"
    elif "soundcloud.com" in url:
        return "soundcloud"
    elif "vk.com" in url or "vkontakte.ru" in url:
        return "vk"
    elif "youtube.com" in url or "youtu.be" in url:
        return "youtube"
    return "unknown"


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    return name[:100].strip()


async def download_track(url: str, source: str, progress_callback=None) -> dict:
    if source == "spotify":
        return await _download_spotify(url, progress_callback)
    else:
        return await _download_ytdlp(url, source, progress_callback)


async def _download_ytdlp(url: str, source: str, progress_callback=None) -> dict:
    file_id = str(uuid.uuid4())
    output_template = str(settings.music_path / f"{file_id}.%(ext)s")
    loop = asyncio.get_event_loop()

    def progress_hook(d):
        if d["status"] == "downloading" and progress_callback:
            total = d.get("total_bytes") or d.get("total_bytes_estimate", 0)
            downloaded = d.get("downloaded_bytes", 0)
            if total > 0:
                loop.call_soon_threadsafe(progress_callback, downloaded / total * 90)

    opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [progress_hook],
        "writethumbnail": True,
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"},
            {"key": "FFmpegThumbnailsConvertor", "format": "jpg"},
        ],
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        },
        "fragment_retries": 5,
        "retries": 3,
        # НЕ используем cookiesfrombrowser — вызывает DPAPI ошибку на Windows
    }

    if source == "youtube":
        # android клиент не требует sign-in проверки
        opts["extractor_args"] = {
            "youtube": {"player_client": ["android", "web_creator"]}
        }

    def _download():
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(url, download=True)

    try:
        info = await loop.run_in_executor(None, _download)
    except Exception as e:
        raise RuntimeError(str(e)) from e

    meta = {"title": "Unknown", "artist": "Unknown", "album": "", "duration": 0}
    if info:
        meta["title"] = info.get("title") or "Unknown"
        meta["artist"] = info.get("uploader") or info.get("artist") or "Unknown"
        meta["album"] = info.get("album") or ""
        meta["duration"] = float(info.get("duration") or 0)

    mp3_file = settings.music_path / f"{file_id}.mp3"
    if not mp3_file.exists():
        for f in settings.music_path.glob(f"{file_id}.*"):
            if f.suffix in (".mp3", ".m4a", ".opus", ".webm"):
                mp3_file = f
                break

    if not mp3_file.exists():
        raise RuntimeError(f"Файл не найден после скачивания (id={file_id})")

    cover_path = ""
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        thumb = settings.music_path / f"{file_id}{ext}"
        if thumb.exists():
            cover_path = str(thumb)
            break

    if cover_path:
        try:
            img = Image.open(cover_path)
            img.thumbnail((500, 500))
            img.save(cover_path, "JPEG", quality=85)
        except Exception:
            pass

    meta["file_path"] = str(mp3_file)
    meta["cover_path"] = cover_path
    meta["source_type"] = source

    if progress_callback:
        loop.call_soon_threadsafe(progress_callback, 100)

    return meta


async def _download_spotify(url: str, progress_callback=None) -> dict:
    output_dir = str(settings.music_path)
    loop = asyncio.get_event_loop()
    before = set(settings.music_path.glob("*.mp3"))

    if progress_callback:
        loop.call_soon_threadsafe(progress_callback, 10)

    def _run_spotdl():
        return subprocess.run(
            ["spotdl", "download", url, "--output", output_dir, "--format", "mp3", "--bitrate", "192k"],
            capture_output=True, text=True, timeout=300, encoding="utf-8", errors="replace",
        )

    try:
        result = await asyncio.wait_for(loop.run_in_executor(None, _run_spotdl), timeout=290)
    except asyncio.TimeoutError:
        raise RuntimeError("spotdl: превышено время ожидания")

    if progress_callback:
        loop.call_soon_threadsafe(progress_callback, 90)

    after = set(settings.music_path.glob("*.mp3"))
    new_files = sorted(after - before, key=lambda f: f.stat().st_mtime, reverse=True)

    if not new_files:
        all_mp3 = sorted(settings.music_path.glob("*.mp3"), key=lambda f: f.stat().st_mtime, reverse=True)
        if not all_mp3:
            raise RuntimeError(f"spotdl не скачал файл.\nstdout: {result.stdout[-500:]}\nstderr: {result.stderr[-500:]}")
        new_files = [all_mp3[0]]

    latest = new_files[0]
    meta = _extract_metadata_from_mp3(latest)
    meta["file_path"] = str(latest)
    meta["source_type"] = "spotify"

    if progress_callback:
        loop.call_soon_threadsafe(progress_callback, 100)

    return meta


def _extract_metadata_from_mp3(path: Path) -> dict:
    meta = {"title": path.stem, "artist": "Unknown", "album": "", "duration": 0, "cover_path": ""}
    try:
        audio = MP3(str(path))
        meta["duration"] = audio.info.length
        tags = ID3(str(path))
        if "TIT2" in tags: meta["title"] = str(tags["TIT2"])
        if "TPE1" in tags: meta["artist"] = str(tags["TPE1"])
        if "TALB" in tags: meta["album"] = str(tags["TALB"])
        for key in tags:
            if key.startswith("APIC"):
                cover_data = tags[key].data
                cover_path = path.with_suffix(".jpg")
                img = Image.open(io.BytesIO(cover_data))
                img.thumbnail((500, 500))
                img.save(str(cover_path), "JPEG", quality=85)
                meta["cover_path"] = str(cover_path)
                break
    except Exception:
        pass
    return meta