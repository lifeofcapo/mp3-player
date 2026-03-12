import asyncio
import re
import uuid
import subprocess
import logging
import requests
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
        if re.search(r'vk\.com/(audio|music/audio)', u):
            return "vk_audio"
        return "vk_video"
    elif "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    return "unknown"


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    return name[:100].strip()


def get_vk_cookies_path() -> Path | None:
    p = COOKIES_PATH / "vk_cookies.txt"
    return p if p.exists() else None


def _parse_vk_audio_id(url: str):
    """
    Парсит owner_id и audio_id из ссылок вида:
      vk.com/audio-12345_67890
      vk.com/audio?id=67890&owner_id=-12345
      vk.com/music/audio/-12345_67890
    Возвращает (owner_id: int, audio_id: int) или бросает ValueError.
    """
    # Формат: /audio{owner_id}_{audio_id} или /audio-{owner_id}_{audio_id}
    m = re.search(r'/audio(-?\d+)_(\d+)', url)
    if m:
        return int(m.group(1)), int(m.group(2))

    # Формат: /music/audio/{owner_id}_{audio_id}
    m = re.search(r'/music/audio/(-?\d+)_(\d+)', url)
    if m:
        return int(m.group(1)), int(m.group(2))

    # Query params: ?id=...&owner_id=...
    m_id = re.search(r'[?&]id=(\d+)', url)
    m_owner = re.search(r'[?&]owner_id=(-?\d+)', url)
    if m_id and m_owner:
        return int(m_owner.group(1)), int(m_id.group(1))

    raise ValueError(f"Не удалось распознать формат VK аудио ссылки: {url}")


async def download_track(url: str, source: str, progress_callback=None) -> dict:
    if source == "spotify":
        return await _download_spotify(url, progress_callback)
    elif source == "vk_audio":
        return await _download_vk_audio(url, progress_callback)
    else:
        return await _download_ytdlp(url, source, progress_callback)


# ---------------------------------------------------------------------------
# VK Audio через VK API
# ---------------------------------------------------------------------------

async def _download_vk_audio(url: str, progress_callback=None) -> dict:
    from services.vk_auth import resolve_audio_url

    loop = asyncio.get_event_loop()

    if progress_callback:
        loop.call_soon_threadsafe(progress_callback, 5)

    # Парсим ID
    try:
        owner_id, audio_id = _parse_vk_audio_id(url)
    except ValueError as e:
        raise RuntimeError(str(e)) from e

    # Получаем прямую ссылку через API (синхронно в executor)
    direct_url = await loop.run_in_executor(
        None, lambda: resolve_audio_url(owner_id, audio_id)
    )

    if progress_callback:
        loop.call_soon_threadsafe(progress_callback, 15)

    file_id = str(uuid.uuid4())

    # Определяем формат: m3u8 (HLS) или прямой mp3
    is_hls = "m3u8" in direct_url.lower() or direct_url.endswith(".m3u8")

    if is_hls:
        meta = await _download_hls(direct_url, file_id, progress_callback)
    else:
        meta = await _download_direct_mp3(direct_url, file_id, progress_callback)

    meta["source_type"] = "vk"
    meta["source_url"] = url

    # Попробуем вытащить метаданные из ID3 если есть
    mp3_path = Path(meta["file_path"])
    if mp3_path.exists():
        id3_meta = await loop.run_in_executor(None, lambda: _extract_metadata_from_mp3(mp3_path))
        if id3_meta.get("title") and id3_meta["title"] != mp3_path.stem:
            meta["title"] = id3_meta["title"]
        if id3_meta.get("artist") and id3_meta["artist"] != "Unknown":
            meta["artist"] = id3_meta["artist"]
        if id3_meta.get("cover_path"):
            meta["cover_path"] = id3_meta["cover_path"]

    return meta


async def _download_direct_mp3(direct_url: str, file_id: str, progress_callback=None) -> dict:
    """Скачивает прямой mp3 файл через requests с прогрессом."""
    loop = asyncio.get_event_loop()
    mp3_path = settings.music_path / f"{file_id}.mp3"

    def _fetch():
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }
        resp = requests.get(direct_url, headers=headers, stream=True, timeout=60)
        resp.raise_for_status()

        total = int(resp.headers.get("content-length", 0))
        downloaded = 0
        with open(mp3_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0 and progress_callback:
                        pct = 15 + (downloaded / total) * 80
                        loop.call_soon_threadsafe(progress_callback, round(pct, 1))

    await loop.run_in_executor(None, _fetch)

    if not mp3_path.exists():
        raise RuntimeError("Файл не был скачан.")

    if progress_callback:
        loop.call_soon_threadsafe(progress_callback, 95)

    return {
        "title": "Unknown",
        "artist": "Unknown",
        "album": "",
        "duration": 0.0,
        "file_path": str(mp3_path),
        "cover_path": "",
    }


async def _download_hls(hls_url: str, file_id: str, progress_callback=None) -> dict:
    """Скачивает HLS поток через ffmpeg."""
    loop = asyncio.get_event_loop()
    mp3_path = settings.music_path / f"{file_id}.mp3"

    def _fetch():
        import subprocess
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", hls_url,
                "-vn",
                "-acodec", "libmp3lame",
                "-ab", "192k",
                str(mp3_path),
            ],
            capture_output=True,
            timeout=300,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"ffmpeg ошибка: {result.stderr.decode('utf-8', errors='replace')[-300:]}"
            )

    if progress_callback:
        loop.call_soon_threadsafe(progress_callback, 20)

    await loop.run_in_executor(None, _fetch)

    if not mp3_path.exists():
        raise RuntimeError("HLS поток не был конвертирован.")

    if progress_callback:
        loop.call_soon_threadsafe(progress_callback, 95)

    return {
        "title": "Unknown",
        "artist": "Unknown",
        "album": "",
        "duration": 0.0,
        "file_path": str(mp3_path),
        "cover_path": "",
    }


# ---------------------------------------------------------------------------
# yt-dlp (YouTube, SoundCloud, VK видео)
# ---------------------------------------------------------------------------

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

    if source == "vk_video":
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
        logger.error("yt-dlp exception for %s: %s", url, combined)
        raise RuntimeError(combined) from e

    if info is None:
        captured = "\n".join(yt_errors).strip()
        raise RuntimeError(captured or "Не удалось получить информацию о треке. Проверь ссылку.")

    meta = {
        "title": info.get("title") or "Unknown",
        "artist": info.get("uploader") or info.get("artist") or "Unknown",
        "album": info.get("album") or "",
        "duration": float(info.get("duration") or 0),
    }

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
            + (f"Детали: {captured}" if captured else "")
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
    meta["source_type"] = source.replace("_video", "")

    if progress_callback:
        loop.call_soon_threadsafe(progress_callback, 100)

    return meta


# ---------------------------------------------------------------------------
# Spotify
# ---------------------------------------------------------------------------

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
            raise RuntimeError(
                f"spotdl не скачал файл.\nstdout: {result.stdout[-500:]}\nstderr: {result.stderr[-500:]}"
            )
        new_files = [all_mp3[0]]

    latest = new_files[0]
    meta = _extract_metadata_from_mp3(latest)
    meta["file_path"] = str(latest)
    meta["source_type"] = "spotify"

    if progress_callback:
        loop.call_soon_threadsafe(progress_callback, 100)

    return meta


# ---------------------------------------------------------------------------
# Утилиты
# ---------------------------------------------------------------------------

def _extract_metadata_from_mp3(path: Path) -> dict:
    meta = {"title": path.stem, "artist": "Unknown", "album": "", "duration": 0.0, "cover_path": ""}
    try:
        audio = MP3(str(path))
        meta["duration"] = audio.info.length
        tags = ID3(str(path))
        if "TIT2" in tags:
            meta["title"] = str(tags["TIT2"])
        if "TPE1" in tags:
            meta["artist"] = str(tags["TPE1"])
        if "TALB" in tags:
            meta["album"] = str(tags["TALB"])
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