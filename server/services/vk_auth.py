"""
VK авторизация через vk_api с поддержкой двухфакторки.

Принцип работы 2FA:
  vk_api вызывает auth_handler() синхронно во время vk.auth().
  Мы блокируем этот вызов через threading.Event — ждём пока
  пользователь введёт код в интерфейсе и вызовет login_step2().
"""
import json
import logging
import threading
from pathlib import Path
from typing import Optional

import vk_api
from vk_api.exceptions import BadPassword, Captcha

logger = logging.getLogger(__name__)

SESSION_PATH = Path("./cookies/vk_session.json")

def _save_session(token: str, user_id: int, login: str) -> None:
    SESSION_PATH.parent.mkdir(parents=True, exist_ok=True)
    SESSION_PATH.write_text(
        json.dumps({"token": token, "user_id": user_id, "login": login}),
        encoding="utf-8",
    )


def _load_session() -> Optional[dict]:
    if not SESSION_PATH.exists():
        return None
    try:
        return json.loads(SESSION_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None


def delete_session() -> None:
    if SESSION_PATH.exists():
        SESSION_PATH.unlink()


def get_session_status() -> dict:
    s = _load_session()
    if not s:
        return {"authenticated": False}
    return {
        "authenticated": True,
        "login": s.get("login", ""),
        "user_id": s.get("user_id"),
    }

class _AuthState:
    def __init__(self):
        self.reset()

    def reset(self):
        self.code_event = threading.Event() # Event: основной поток auth() ждёт, пока пользователь введёт код
        self.done_event = threading.Event() # Event: сигнализирует что auth() полностью завершился 
        self.twofa_event = threading.Event()  # Event: сигнализирует login_step1 что нужна 2FA 
        self.code: Optional[str] = None
        self.error: Optional[str] = None
        self.token: Optional[str] = None
        self.user_id: Optional[int] = None
        self.login: Optional[str] = None
        self.needs_2fa: bool = False


_state = _AuthState()
_state_lock = threading.Lock()

def login_step1(login: str, password: str) -> dict:
    """
    Запускает авторизацию в отдельном потоке.
    Возвращает немедленно:
      {"status": "ok"}           — успех без 2FA
      {"status": "2fa_required"} — нужен код
      {"status": "error", ...}   — ошибка
    """
    with _state_lock:
        _state.reset()
        _state.login = login

    def auth_handler():
        """Вызывается vk_api когда нужен 2FA код. Блокирует поток авторизации."""
        with _state_lock:
            _state.needs_2fa = True

        _state.twofa_event.set()

        logger.info("VK 2FA required, waiting for code...")
        got_code = _state.code_event.wait(timeout=300)
        if not got_code or not _state.code:
            raise RuntimeError("Таймаут ввода кода двухфакторной аутентификации.")
        return _state.code, True  

    def _run_auth():
        try:
            vk = vk_api.VkApi(
                login=login,
                password=password,
                app_id=2685278,           # Kate Mobile
                scope="audio,offline",
                auth_handler=auth_handler,
            )
            vk.auth()
            token = vk.token["access_token"]
            user_info = vk.method("users.get")[0]
            user_id = user_info["id"]

            with _state_lock:
                _state.token = token
                _state.user_id = user_id

        except BadPassword:
            with _state_lock:
                _state.error = "Неверный логин или пароль"
        except Captcha:
            with _state_lock:
                _state.error = "VK требует капчу. Попробуй позже."
        except Exception as e:
            err = str(e)
            logger.error("VK auth thread error: %s", err)
            with _state_lock:
                _state.error = err
        finally:
            _state.done_event.set()

    t = threading.Thread(target=_run_auth, daemon=True)
    t.start()

    finished = _state.done_event.wait(timeout=30)
    needs_2fa = _state.twofa_event.is_set()

    if needs_2fa:
        return {"status": "2fa_required"}

    if not finished:
        return {"status": "error", "message": "Таймаут подключения к VK. Проверь интернет."}

    with _state_lock:
        if _state.error:
            return {"status": "error", "message": _state.error}

        if _state.token:
            _save_session(_state.token, _state.user_id, login)
            logger.info("VK auth OK (no 2FA): user_id=%s", _state.user_id)
            return {"status": "ok"}

    return {"status": "error", "message": "Неизвестная ошибка авторизации"}


def login_step2(code: str) -> dict:
    """
    Передаёт 2FA код ожидающему потоку авторизации.
    """
    with _state_lock:
        if not _state.needs_2fa:
            return {"status": "error", "message": "Нет активной сессии 2FA. Начни авторизацию заново."}
        _state.code = code

    _state.code_event.set()

    got_event = _state.done_event.wait(timeout=30)

    if not got_event:
        return {"status": "error", "message": "Таймаут авторизации после ввода кода."}

    with _state_lock:
        if _state.error:
            err = _state.error
            _state.reset()
            return {"status": "error", "message": err}

        if _state.token:
            login = _state.login or ""
            _save_session(_state.token, _state.user_id, login)
            logger.info("VK auth OK (2FA): user_id=%s", _state.user_id)
            _state.reset()
            return {"status": "ok"}

    return {"status": "error", "message": "Неизвестная ошибка после ввода кода."}

def _get_vk_api_instance() -> vk_api.VkApi:
    s = _load_session()
    if not s:
        raise RuntimeError("Нет авторизации VK. Войди в аккаунт в разделе «Загрузки».")
    return vk_api.VkApi(token=s["token"])


def resolve_audio_url(owner_id: int, audio_id: int) -> str:
    """Получает прямую ссылку на аудио через VK API."""
    vk = _get_vk_api_instance()
    try:
        result = vk.method("audio.getById", {"audios": f"{owner_id}_{audio_id}"})
    except vk_api.exceptions.ApiError as e:
        raise RuntimeError(f"VK API ошибка: {e}") from e

    if not result:
        raise RuntimeError(
            f"Трек {owner_id}_{audio_id} не найден или недоступен. "
            "Возможно он удалён или доступен только для определённых пользователей."
        )

    url = result[0].get("url", "")
    if not url:
        raise RuntimeError(
            "VK не вернул ссылку на аудио. "
            "Трек может быть заблокирован в твоём регионе."
        )
    return url