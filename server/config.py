from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    music_dir: str = "./music"
    db_path: str = "./db/mp3player.db"
    max_queue_size: int = 10

    @property
    def music_path(self) -> Path:
        p = Path(self.music_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def db_url(self) -> str:
        p = Path(self.db_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite+aiosqlite:///{p}"

    class Config:
        env_file = ".env"


settings = Settings()