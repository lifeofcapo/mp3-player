from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
from config import settings

router = APIRouter(prefix="/cookies", tags=["cookies"])

COOKIES_PATH = Path("./cookies")


def get_vk_cookies_path() -> Path | None:
    p = COOKIES_PATH / "vk_cookies.txt"
    return p if p.exists() else None


@router.post("/vk")
async def upload_vk_cookies(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Нужен файл cookies.txt")

    COOKIES_PATH.mkdir(parents=True, exist_ok=True)
    content = await file.read()

    # Минимальная валидация — файл должен содержать строки Netscape формата
    text = content.decode("utf-8", errors="replace")
    if "# Netscape HTTP Cookie File" not in text and ".vk.com" not in text:
        raise HTTPException(
            status_code=400,
            detail="Файл не похож на cookies.txt от VK. Убедись, что экспортировал куки с vk.com"
        )

    cookies_file = COOKIES_PATH / "vk_cookies.txt"
    cookies_file.write_bytes(content)

    return {"ok": True, "message": "Куки VK успешно загружены"}


@router.get("/vk/status")
async def vk_cookies_status():
    p = get_vk_cookies_path()
    if not p:
        return {"has_cookies": False}

    # Проверяем не слишком ли старый файл (куки живут ~2 недели)
    import time
    age_days = (time.time() - p.stat().st_mtime) / 86400
    return {
        "has_cookies": True,
        "age_days": round(age_days, 1),
        "warning": "Куки старше 14 дней, возможно истекли" if age_days > 14 else None
    }


@router.delete("/vk")
async def delete_vk_cookies():
    p = get_vk_cookies_path()
    if p:
        p.unlink()
    return {"ok": True}