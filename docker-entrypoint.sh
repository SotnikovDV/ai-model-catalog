#!/bin/sh
set -e

if [ "$(id -u)" = "0" ]; then
  if [ -d /app/data ]; then
    chown -R node:node /app/data
    chmod -R u+rwX,g+rwX /app/data
  fi
  if [ -d /app/backups ]; then
    chown -R node:node /app/backups
    chmod -R u+rwX,g+rwX /app/backups
  fi
  exec su -s /bin/sh node -c 'exec "$0" "$@"' "$@"
fi

exec "$@"
