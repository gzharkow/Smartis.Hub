#!/usr/bin/env bash
# Деплой/редеплой БЕЗ git: пакует проект локально, заливает по scp,
# на сервере распаковывает поверх и пересобирает. Запускать С ЛОКАЛЬНОЙ
# машины разработки (не на сервере). См. DEPLOY.md.
#
# Использование: deploy/deploy.sh пользователь@IP_СЕРВЕРА [путь-на-сервере]
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Использование: $0 пользователь@сервер [путь-на-сервере]" >&2
  exit 1
fi

SERVER="$1"
REMOTE_DIR="${2:-/srv/smartfollow}"
ARCHIVE="/tmp/smartfollow-deploy-$$.tar.gz"

cd "$(dirname "$0")/.."

echo "Собираю архив проекта..."
# Якорь "./" обязателен: без него --exclude='storage' срезал бы и
# src/lib/storage (код драйвера), а не только корневую папку с файлами.
tar --exclude='./node_modules' --exclude='./.next' --exclude='./storage' \
    --exclude='./.env' --exclude='./.git' -czf "$ARCHIVE" .

echo "Отправляю на $SERVER:$REMOTE_DIR ..."
ssh "$SERVER" "mkdir -p '$REMOTE_DIR'"
scp "$ARCHIVE" "$SERVER:/tmp/smartfollow-deploy.tar.gz"
rm -f "$ARCHIVE"

echo "Разворачиваю, собираю и перезапускаю на сервере..."
ssh "$SERVER" "
  set -euo pipefail
  tar --no-same-owner -xzf /tmp/smartfollow-deploy.tar.gz -C '$REMOTE_DIR'
  chown -R root:root '$REMOTE_DIR'
  # .env не входит в архив (уже существует в каталоге) — chown -R выше
  # заодно откатывает его группу обратно на root, а Next.js сам открывает
  # .env при старте от пользователя smartfollow. Возвращаем групповой доступ.
  if [ -f '$REMOTE_DIR/.env' ]; then
    chgrp smartfollow '$REMOTE_DIR/.env'
    chmod 640 '$REMOTE_DIR/.env'
  fi
  rm /tmp/smartfollow-deploy.tar.gz
  cd '$REMOTE_DIR'
  npm ci
  npx prisma generate
  npx prisma migrate deploy
  npm run build
  systemctl restart smartfollow
  systemctl status smartfollow --no-pager -l
"

echo "Готово."
