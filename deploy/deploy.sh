#!/usr/bin/env bash
# Редеплой через git: на сервере выполняется git fetch + reset --hard на
# нужную ветку, дальше пересборка и рестарт. Запускать С ЛОКАЛЬНОЙ машины
# разработки (не на сервере). Требует, чтобы на сервере уже был сделан
# первичный `git clone` (см. DEPLOY.md, шаг 4) и настроен deploy key.
#
# Использование: deploy/deploy.sh пользователь@IP_СЕРВЕРА [путь-на-сервере] [ветка]
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Использование: $0 пользователь@сервер [путь-на-сервере] [ветка]" >&2
  exit 1
fi

SERVER="$1"
REMOTE_DIR="${2:-/srv/smartfollow}"
BRANCH="${3:-main}"

echo "Обновляю код и пересобираю на $SERVER:$REMOTE_DIR (ветка $BRANCH)..."
ssh "$SERVER" "
  set -euo pipefail
  cd '$REMOTE_DIR'
  git fetch origin
  git reset --hard 'origin/$BRANCH'
  npm ci
  npx prisma generate
  npx prisma migrate deploy
  npm run build
  systemctl restart smartfollow
  systemctl status smartfollow --no-pager -l
"

echo "Готово."
