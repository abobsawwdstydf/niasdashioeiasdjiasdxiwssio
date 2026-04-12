#!/bin/bash
# ===== FULL DEPLOY: NEXO SMTP Client =====
# Скопируй ЭТОТ скрипт на сервер и запусти: bash setup-and-deploy.sh

set -e
echo "🚀 NEXO SMTP Client — Установка"
echo "================================="

# Node.js установка (если нет)
if ! command -v node &> /dev/null; then
  echo "📦 Установка Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "✅ Node.js: $(node -v)"
echo "✅ npm: $(npm -v)"

# Создаём проект
PROJECT_DIR="$HOME/nexo-smtp-client"
mkdir -p "$PROJECT_DIR/src" "$PROJECT_DIR/public" "$PROJECT_DIR/data" "$PROJECT_DIR/logs"
cd "$PROJECT_DIR"

# package.json
cat > package.json << 'PKGJSON'
{
  "name": "nexo-smtp-client",
  "version": "1.0.0",
  "description": "NEXO SMTP Client",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "bcryptjs": "^2.4.3",
    "ws": "^8.16.0",
    "nodemailer": "^6.9.7",
    "better-sqlite3": "^9.2.2"
  }
}
PKGJSON

# Установка зависимостей
echo "📦 Установка npm зависимостей..."
npm install --production

# .env
if [ ! -f .env ]; then
  cat > .env << 'ENVFILE'
SERVER_URL=wss://your-nexo-server.com
TUNNEL_TOKEN=sk_live_xxxxx
PANEL_PORT=3000
ENVFILE
  echo "⚠️  Отредактируй .env: nano .env"
fi

# systemd сервис
echo "🔧 Создание systemd сервиса..."
sudo tee /etc/systemd/system/nexo-smtp.service > /dev/null << SVCEOF
[Unit]
Description=NEXO SMTP Client
After=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$(which node) src/index.js
Restart=always
RestartSec=5
EnvironmentFile=$PROJECT_DIR/.env
StandardOutput=append:$PROJECT_DIR/logs/app.log
StandardError=append:$PROJECT_DIR/logs/error.log

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable nexo-smtp
sudo systemctl restart nexo-smtp

echo ""
echo "✅ УСТАНОВКА ЗАВЕРШЕНА!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 Панель: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):3000"
echo "📋 Логи: journalctl -u nexo-smtp -f"
echo "🔄 Рестарт: sudo systemctl restart nexo-smtp"
echo "🛑 Стоп: sudo systemctl stop nexo-smtp"
echo "📝 Настройки: nano $PROJECT_DIR/.env"
echo ""
echo "Первый шаг: открой панель в браузере и настрой учётку"
