#!/bin/sh
# Ручной бэкап SQLite на NAS (Docker).
# Запуск из папки проекта:
#   chmod +x db-backup.sh   # один раз
#   ./db-backup.sh
#   # или: sudo ./db-backup.sh
set -e
cd "$(dirname "$0")"

if docker info >/dev/null 2>&1; then
  DOCKER="docker"
elif sudo docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
else
  echo "Docker недоступен. Запустите с правами на docker или через sudo." >&2
  exit 1
fi

echo "=== ai-model-catalog SQLite backup (Docker) ==="
$DOCKER compose run --rm app node dist/db/backup.js
echo "Готово."
