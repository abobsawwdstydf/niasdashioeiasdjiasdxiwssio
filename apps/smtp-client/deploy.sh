#!/bin/bash
# NEXO SMTP Client - Deploy Script for Server
# Запускать: bash deploy.sh

set -e

echo "🚀 NEXO SMTP Client Deploy"
echo "==========================="

# Создаём директорию
mkdir -p ~/nexo-smtp-client/data ~/nexo-smtp-client/logs
cd ~/nexo-smtp-client

# Копируем файлы (предполагается что архив уже на сервере)
# Если нужно — можно scp сюда добавить

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install --production

# Создаём .env если нет
if [ ! -f .env ]; then
  echo "⚙️ Создаю .env шаблон..."
  cat > .env << EOF
# Адрес NEXO сервера (WebSocket)
SERVER_URL=wss://your-nexo-server.com

# Токен туннеля
TUNNEL_TOKEN=sk_live_xxxxx

# Порт панели
PANEL_PORT=3000
EOF
  echo "⚠️ Отредактируйте .env!"
fi

# systemd сервис
echo "🔧 Настраиваю автозапуск..."
sudo tee /etc/systemd/system/nexo-smtp-client.service > /dev/null << EOF
[Unit]
Description=NEXO SMTP Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=nexo-smtp
Group=nexo-smtp
WorkingDirectory=$HOME/nexo-smtp-client
ExecStart=$(which node) src/index.js
Restart=always
RestartSec=5
EnvironmentFile=$HOME/nexo-smtp-client/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable nexo-smtp-client
sudo systemctl restart nexo-smtp-client

echo ""
echo "✅ Готово!"
echo "📡 Панель: http://$(hostname -I | awk '{print $1}'):3000"
echo "📋 Логи: sudo journalctl -u nexo-smtp-client -f"
echo "🔄 Рестарт: sudo systemctl restart nexo-smtp-client"
echo "🛑 Стоп: sudo systemctl stop nexo-smtp-client"
