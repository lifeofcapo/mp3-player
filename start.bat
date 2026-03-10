@echo off
chcp 65001 >nul
title Mp3Player

echo.
echo  ╔══════════════════════════════╗
echo  ║      🎵 Mp3Player           ║
echo  ╚══════════════════════════════╝
echo.

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo  ❌ Docker не найден!
    echo.
    echo  Скачай Docker Desktop: https://www.docker.com/products/docker-desktop/
    echo  После установки перезапусти этот файл.
    echo.
    pause
    exit /b 1
)

echo  ✅ Docker найден
echo  🚀 Запускаем МП3 Плеер...
echo.

docker compose up -d

if %errorlevel% neq 0 (
    echo.
    echo  ❌ Ошибка запуска. Попробуй:
    echo     1. Убедись что Docker Desktop запущен
    echo     2. Запусти этот файл от имени администратора
    echo.
    pause
    exit /b 1
)

echo.
echo  ✅ Плеер запущен!
echo.
echo  🌐 Открываю браузер...
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo  Для остановки нажми любую клавишу...
pause >nul

docker compose down
echo  ✅ Плеер остановлен.