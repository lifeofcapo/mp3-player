# 🎵 Mp3 Player

Универсальный музыкальный плеер в браузере — объединяет YouTube, SoundCloud, Spotify и VK Music в одном месте. Без VPN. Работает локально.

<p align="center">
  <img src="https://raw.githubusercontent.com/lifeofcapo/mp3-player/main/client/public/Screenshot.png" width="900">
</p>

## Возможности

- 🔗 **Вставь ссылку** с YouTube / SoundCloud / Spotify / VK — трек автоматически скачается и добавится в плейлист
- 🎧 **Полноценный плеер** — прогресс-бар, громкость, shuffle, repeat (none / all / one)
- 📋 **Плейлисты** — создание, удаление, добавление треков
- 🎨 **Темы** — Dark / Light / System
- 🖼️ **Метаданные** — обложки, исполнитель, название — всё подтягивается автоматически
- 🐳 **Запуск одной командой** через Docker Compose

---

## 🚀 Быстрый старт

### Способ 1: Docker (рекомендуется)

**Требования:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / Mac / Linux)

```bash

git clone https://github.com/lifeofcapo/mp3-player.git
cd mp3-player

docker compose up
```

Открой браузер: **http://localhost:3000**

---

### Способ 2: Скрипты (без знания команд)

**Windows:** дважды кликни `start.bat`  
**Mac / Linux:** дважды кликни `start.sh` (или `./start.sh` в терминале)

---

### Способ 3: Для разработчиков (ручной запуск)

**Требования:** Python 3.11+, Node.js 18+, [yt-dlp](https://github.com/yt-dlp/yt-dlp), [spotdl](https://github.com/spotDL/spotify-downloader), ffmpeg

```bash
# Бэкенд
cd server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Фронтенд (в другом терминале)
cd client
npm install
npm run dev
```

---

## 📦 Поддерживаемые источники

| Источник | Формат ссылки | Метод |
|---|---|---|
| YouTube | `youtube.com/watch?v=...` | yt-dlp |
| SoundCloud | `soundcloud.com/...` | yt-dlp |
| Spotify | `open.spotify.com/track/...` | spotdl → YouTube |
| VK Music | `vk.com/audio...` | yt-dlp |

---

## 🤝 Вклад в проект

PR и Issues приветствуются

---

## 📄 Лицензия

MIT — используй свободно.