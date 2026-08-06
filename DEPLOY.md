# Деплой Smartfollow на голый VPS (Reg.cloud)

Рассчитано на чистый Ubuntu/Debian VPS с root-доступом по SSH, без
Docker, без панели управления и **без git-репозитория** — код едет на
сервер напрямую (архив по SSH), обновления делаются нечасто, поэтому
процесс сборки одной командой важнее, чем полноценный git-деплой.

Шаги 1–3, 5–9 выполняются **на сервере**. Шаг 4 (доставка кода) и
последующие редеплои — **с машины разработки** (Windows, через Git
Bash/WSL, где есть `ssh`/`scp`/`tar`).

## 0. Что должно быть готово заранее

- IP-адрес сервера и root-доступ по SSH (пароль или ключ). Проще
  всего настроить вход по SSH-ключу — тогда `deploy/deploy.sh` не
  будет спрашивать пароль на каждом шаге.
- Пароль для PostgreSQL, который ты придумаешь на месте (шаг 2).
- `ssh`, `scp` и `tar` на машине, с которой будешь деплоить (в Git
  Bash на Windows они есть из коробки).

## 1. Базовые пакеты и Node.js

```bash
apt update && apt upgrade -y
apt install -y curl build-essential nginx

# Node.js 24.x (та же мажорная версия, что и в разработке)
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs

node -v   # ожидается v24.x
npm -v
```

## 2. PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql

# Создать пользователя и базу
sudo -u postgres psql -c "CREATE USER smartfollow WITH PASSWORD 'ПРИДУМАЙ_ПАРОЛЬ';"
sudo -u postgres psql -c "CREATE DATABASE smartfollow OWNER smartfollow;"
```

Postgres по умолчанию слушает только `localhost` — это то, что нужно
(приложение и база на одной машине, порт наружу открывать не надо).

## 3. Пользователь и каталоги приложения

Запускать сам Node-процесс от root — плохая идея, но собирать
(`npm ci`/`npm run build`) удобнее от root по SSH, поэтому владельцем
кода в `/srv/smartfollow` остаётся root, а отдельный пользователь
`smartfollow` — только для запуска через systemd (шаг 7) и владения
постоянным хранилищем файлов:

```bash
useradd -r -m -d /var/lib/smartfollow -s /usr/sbin/nologin smartfollow
mkdir -p /var/lib/smartfollow/storage
mkdir -p /srv/smartfollow
chown -R smartfollow:smartfollow /var/lib/smartfollow
```

## 4. Код на сервер

Код не лежит в репозитории — доставляется архивом с локальной машины.
Первую заливку можно сделать вручную (дальше это же делает
`deploy/deploy.sh`, см. «Повторный деплой» в конце файла):

```bash
# на локальной машине, из корня проекта
# якорь "./" обязателен — без него --exclude='storage' срежет ещё и
# src/lib/storage (код), а не только корневую папку с загруженными файлами
tar --exclude='./node_modules' --exclude='./.next' --exclude='./storage' \
    --exclude='./.env' --exclude='./.git' -czf /tmp/smartfollow.tar.gz .
scp /tmp/smartfollow.tar.gz root@IP_СЕРВЕРА:/tmp/smartfollow.tar.gz
ssh root@IP_СЕРВЕРА "tar --no-same-owner -xzf /tmp/smartfollow.tar.gz -C /srv/smartfollow && chown -R root:root /srv/smartfollow && rm /tmp/smartfollow.tar.gz"
```

Дальше шаги 5–6 — уже на сервере, `cd /srv/smartfollow`.

## 5. Настройка окружения

Файл `.env` не входит в архив (см. `--exclude` выше) — создаётся на
сервере один раз и дальше не трогается редеплоями:

```bash
cp .env.example .env
nano .env
```

Заполнить:
- `DATABASE_URL` — `postgresql://smartfollow:ПАРОЛЬ@localhost:5432/smartfollow?schema=public`
  (пароль с спецсимволами — закодировать: `%` → `%25` и т.д.)
- `APP_URL` — пока `http://IP_СЕРВЕРА` (или временный домен), после привязки
  домена и выпуска HTTPS — поменять на `https://домен` и перезапустить (шаг 8).
- `STORAGE_LOCAL_PATH` — `/var/lib/smartfollow/storage` (уже создан на шаге 3).
- `AUTH_SECRET` — сгенерировать: `openssl rand -base64 32`, вставить результат.
- `NODE_ENV="production"`.

Внутри файл — пароль от БД и секрет для подписи сессий, поэтому доступ
стоит ограничить. **Не `600` (только root)** — Next.js сам открывает
`.env` при старте (не только через systemd `EnvironmentFile`), а
процесс работает от `smartfollow`, так что нужен групповой доступ:

```bash
chgrp smartfollow .env
chmod 640 .env
```

## 6. Установка, миграции, сборка

```bash
npm ci
npx prisma generate
npx prisma migrate deploy   # применяет уже созданные миграции, ничего не спрашивает
npm run build
```

`prisma migrate deploy` — не `migrate dev`: он не создаёт новых миграций
и не задаёт вопросов, только применяет то, что уже есть в `prisma/migrations/`
(это то, что накопилось за разработку и приехало в архиве с шага 4).

## 7. systemd-сервис

Каталог `/srv/smartfollow` остаётся владением root (собирали от root
на шаге 6) — это нормально: systemd запускает процесс от имени
`smartfollow`, но читать и исполнять файлы, собранные root, ему
достаточно прав по умолчанию. Писать наружу процессу нужно только в
`/var/lib/smartfollow/storage`, которым `smartfollow` уже владеет (шаг 3).

Скопировать unit-файл (шаблон лежит в `deploy/smartfollow.service`,
путь `/srv/smartfollow` и пользователь `smartfollow` в нём уже
прописаны — поправить, если называл иначе):

```bash
cp deploy/smartfollow.service /etc/systemd/system/smartfollow.service
systemctl daemon-reload
systemctl enable --now smartfollow
systemctl status smartfollow   # должен быть active (running)
```

Логи: `journalctl -u smartfollow -f`.

## 8. nginx как обратный прокси

Шаблон в `deploy/nginx.conf` — на первое время (без домена) слушает
по IP на 80 порту и проксирует на `localhost:3000`, где висит `next start`.

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/smartfollow
ln -s /etc/nginx/sites-available/smartfollow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default   # выключить дефолтную заглушку nginx
nginx -t && systemctl reload nginx
```

Проверить: `http://IP_СЕРВЕРА` должен открыть страницу входа Smartfollow.

## 9. Файрвол

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'   # 80 и 443
ufw enable
```

Порт 3000 (сам Node-процесс) наружу открывать не нужно — к нему обращается
только nginx через localhost.

## 10. Когда появится домен: HTTPS

1. Указать A-запись домена на IP сервера, дождаться распространения (`dig домен`).
2. В `deploy/nginx.conf` / `/etc/nginx/sites-available/smartfollow` заменить
   `server_name _;` на `server_name твой-домен.ru;`, перезагрузить nginx.
3. Выпустить сертификат:
   ```bash
   apt install -y certbot python3-certbot-nginx
   certbot --nginx -d твой-домен.ru
   ```
   Certbot сам допишет в конфиг редирект на https и настроит автопродление.
4. В `.env` поменять `APP_URL` на `https://твой-домен.ru`, перезапустить приложение:
   `systemctl restart smartfollow`.

## Повторный деплой (когда есть новый код)

Запускается **с локальной машины**, не на сервере:

```bash
chmod +x deploy/deploy.sh   # один раз
./deploy/deploy.sh root@IP_СЕРВЕРА
```

Скрипт паковает проект в архив (исключая корневые `node_modules`, `.next`,
`storage`, `.env` — именно корневые, не `src/lib/storage`), заливает его по `scp`, распаковывает поверх
`/srv/smartfollow` на сервере и там же выполняет `npm ci`, `prisma
generate`, `prisma migrate deploy`, `npm run build`,
`systemctl restart smartfollow` — по порядку, останавливаясь на первой
ошибке. `.env` и `storage` не в архиве — редеплой их не трогает
(владельца файла возвращает на `root:smartfollow` 640 отдельным
шагом — иначе `chown -R root:root` после распаковки заодно откатывал
бы группу и на `.env`, и Next.js переставал бы его открывать).

Первый аргумент — адрес сервера в формате `пользователь@IP` (в
примерах выше — `root@IP_СЕРВЕРА`, как и остальная инструкция).
Второй необязательный аргумент — путь на сервере, если называл каталог
не `/srv/smartfollow`.

## Резервные копии

Два места, которые нельзя потерять и которые не приезжают в архиве деплоя:

- **База данных**: `pg_dump smartfollow > backup.sql` (регулярно, вне сервера).
- **Файлы материалов**: каталог `STORAGE_LOCAL_PATH` (`/var/lib/smartfollow/storage`) —
  презентации, видео, превью. Обычным архивом/rsync на другое хранилище.

Это временная схема (см. заметки владельца в архитектуре проекта: конечная
цель — Яндекс Клауд с учётом 152-ФЗ, здесь — промежуточный шаг). Когда обе
копии будут настроены, стоит проверить восстановление хотя бы раз вручную.

## Отличия от локальной разработки

- Локально `prisma migrate dev` создаёт и применяет миграции; на сервере —
  только `prisma migrate deploy` (применяет готовые, не создаёт новых).
- Локально Turbopack/`next dev` пересобирает на лету; на сервере — `next build`
  один раз при деплое, дальше `next start` отдаёт готовую сборку.
- `src/generated/prisma` собирается генератором Prisma и не входит в архив
  деплоя (см. `.gitignore` — исключён по той же логике, что и из git) —
  `prisma generate` обязателен на сервере после каждого `npm ci`.
- **`tar` при редеплое только добавляет и перезаписывает файлы, не удаляет.**
  Если файл убрали локально (например, сменили шрифт или картинку в
  `public/`), на сервере старый файл останется мёртвым грузом — сам не
  пропадёт. Не страшно для работы приложения (просто неиспользуемые байты),
  но раз в несколько деплоев стоит вручную сверить `public/` на сервере
  с локальной версией и убрать лишнее.
