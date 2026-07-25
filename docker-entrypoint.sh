#!/bin/sh
set -e

if [ "$(id -u)" = "0" ] && [ -d /app/data ]; then
  chown -R node:node /app/data
  chmod -R u+rwX,g+rwX /app/data
fi

if [ "$(id -u)" = "0" ]; then
  exec su-exec node "$@"
fi

exec "$@"
