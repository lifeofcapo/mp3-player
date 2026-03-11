#!/bin/bash

echo ""
echo " ╔══════════════════════════════╗"
echo " ║      🎵 Mp3Player            ║"
echo " ╚══════════════════════════════╝"
echo ""

if ! command -v docker &> /dev/null; then
    echo " ❌ Docker не найден!"
    echo ""
    echo " Скачай Docker Desktop: https://www.docker.com/products/docker-desktop/"
    echo " После установки перезапусти этот скрипт."
    echo ""
    exit 1
fi

echo " ✅ Docker найден"
echo " 🚀 Запускаем Плеер..."
echo ""

docker compose up -d

if [ $? -ne 0 ]; then
    echo ""
    echo " ❌ Ошибка запуска."
    echo "    Убедись что Docker Desktop запущен и попробуй снова."
    echo ""
    exit 1
fi

echo ""
echo " ✅ Плеер запущен!"
echo " 🌐 http://localhost:3000"
echo ""

sleep 2

if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000
elif command -v open &> /dev/null; then
    open http://localhost:3000
fi

echo " Для остановки нажми Ctrl+C"
echo ""

trap "docker compose down; echo ' ✅ Плеер остановлен.'; exit 0" INT
while true; do sleep 1; done