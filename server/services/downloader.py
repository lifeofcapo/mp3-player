import asyncio
import re
import uuid
import subprocess
import logging
from pathlib import Path
import yt_dlp
from mutagen.mp3 import MP3
from mutagen.id3 import ID3
from PIL import Image
import io

from config import settings

logger = logging.getLogger(__name__)

COOKIES_PATH = Path("./cookies")


def detect_source(url: str) -> str:
    u = url.lower()
    if "spotify.com" in u:
        return "spotify"
    elif "soundcloud.com" in u:
        return "soundcloud"
    elif "vk.com" in u or "vkontakte.ru" in u:
        # vk.com/audio... — не поддерживается yt-dlp
        if re.search(r'vk\.com/audio', u):
            return "vk_audio_unsupported"
        return "vk"
    elif "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    return "unknown"


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    return name[:100].strip()


def get_vk_cookies_path() -> Path | None:
    p = COOKIES_PATH / "vk_cookies.txt"
    return p if p.exists() else None


async def download_track(url: str, source: str, progress_callback=None) -> dict:
    if source == "spotify":
        return await _download_spotify(url, progress_callback)
    else:
        return await _download_ytdlp(url, source, progress_callback)


async def _download_ytdlp(url: str, source: str, progress_callback=None) -> dict:
    file_id = str(uuid.uuid4())
    output_template = str(settings.music_path / f"{file_id}.%(ext)s")
    loop = asyncio.get_event_loop()

    yt_errors: list[str] = []

    def progress_hook(d):
        if d["status"] == "downloading" and progress_callback:
            total = d.get("total_bytes") or d.get("total_bytes_estimate", 0)
            downloaded = d.get("downloaded_bytes", 0)
            if total > 0:
                loop.call_soon_threadsafe(progress_callback, downloaded / total * 90)

    class ErrorCapturingLogger:
        def debug(self, msg): pass
        def info(self, msg): pass
        def warning(self, msg):
            logger.warning("[yt-dlp] %s", msg)
            yt_errors.append(msg)
        def error(self, msg):
            logger.error("[yt-dlp] %s", msg)
            yt_errors.append(msg)

    opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": False,
        "logger": ErrorCapturingLogger(),
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
    }

    if source == "youtube":
        opts["extractor_args"] = {
            "youtube": {"player_client": ["android", "web_creator"]}
        }

    if source == "vk":
        cookies_path = get_vk_cookies_path()
        if cookies_path:
            opts["cookiefile"] = str(cookies_path)
        try:
            opts["impersonate"] = "chrome"
        except Exception:
            pass

    def _download():
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(url, download=True)

    info = None
    try:
        info = await loop.run_in_executor(None, _download)
    except Exception as e:
        error_msg = str(e).strip()
        captured = "\n".join(yt_errors).strip()
        combined = error_msg or captured or "Не удалось скачать трек"
        logger.error("yt-dlp exception for %s: %s | captured: %s", url, error_msg, captured)

        if source == "vk":
            if "badbrowser" in combined.lower():
                raise RuntimeError(
                    "VK отклонил запрос. "
                    "Установи curl_cffi: pip install \"yt-dlp[default,curl-cffi]\""
                ) from e
            if any(w in combined.lower() for w in ["login", "sign in", "private", "members only"]):
                if not get_vk_cookies_path():
                    raise RuntimeError("VK требует авторизацию. Загрузи cookies.txt в разделе «Загрузки».") from e
                else:
                    raise RuntimeError("Куки VK не работают — возможно истекли. Загрузи новые.") from e
        raise RuntimeError(combined) from e

    if info is None:
        captured = "\n".join(yt_errors).strip()
        logger.error("yt-dlp returned None for %s. Errors: %s", url, captured)
        raise RuntimeError(captured or "Не удалось получить информацию о треке. Проверь ссылку.")

    meta = {"title": "Unknown", "artist": "Unknown", "album": "", "duration": 0}
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
        captured = "\n".join(yt_errors).strip()
        raise RuntimeError(
            "Файл не найден после скачивания. "
            + (f"Детали: {captured}" if captured else "Возможно yt-dlp не смог скачать этот трек.")
        )

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