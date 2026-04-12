@echo off
chcp 65001 >nul 2>&1
title NEXO SMTP Deploy
echo.
echo ========================================================
echo   NEXO SMTP Client — Deploy на сервер
echo ========================================================
echo.
echo  Введи пароль когда появится запрос: 0611.com
echo  (Весь деплой через ОДНО подключение — пароль один раз)
echo.
echo  Нажми Enter чтобы начать...
pause >nul
echo.

set SERVER=nexo-smtp@SERVER-NEXO-MSG-NEXO
set SRCDIR=%~dp0

echo ════════════════════════════════════════════════
echo  Отправка всех файлов на сервер...
echo ════════════════════════════════════════════════
echo.

rem ─── Конвертируем HTML в base64 и отправляем всё одной командой ───

(
echo #!/bin/bash
echo set -e
echo D="$HOME/nexo-smtp-client"
echo mkdir -p "$D/src" "$D/public" "$D/data" "$D/logs"
echo cd "$D"
echo.
echo echo "=== СОЗДАНИЕ ФАЙЛОВ ==="
echo.

rem ─── package.json ───
echo cat ^> package.json ^<^< 'PKEOF'
type "%SRCDIR%package.json"
echo PKEOF
echo.

rem ─── .env template ───
echo "[ ! -f .env ] ^&^& cat ^> .env ^<^< 'ENVEOF'"
echo SERVER_URL=wss://your-server.com
echo TUNNEL_TOKEN=sk_live_xxxxx
echo PANEL_PORT=3000
echo ENVEOF
echo.

rem ─── src/db.js ───
echo cat ^> src/db.js ^<^< 'DBEOF'
type "%SRCDIR%src\db.js"
echo DBEOF
echo.

rem ─── src/settings.js ───
echo cat ^> src/settings.js ^<^< 'SETEOF'
type "%SRCDIR%src\settings.js"
echo SETEOF
echo.

rem ─── src/tunnel.js ───
echo cat ^> src/tunnel.js ^<^< 'TNEOF'
type "%SRCDIR%src\tunnel.js"
echo TNEOF
echo.

rem ─── src/smtp-engine.js ───
echo cat ^> src/smtp-engine.js ^<^< 'SMEOF'
type "%SRCDIR%src\smtp-engine.js"
echo SMEOF
echo.

rem ─── src/web-panel.js ───
echo cat ^> src/web-panel.js ^<^< 'WPEOF'
type "%SRCDIR%src\web-panel.js"
echo WPEOF
echo.

rem ─── src/index.js ───
echo cat ^> src/index.js ^<^< 'IDXEOF'
type "%SRCDIR%src\index.js"
echo IDXEOF
echo.

rem ─── public/index.html ───
echo echo "=== СОЗДАНИЕ HTML ==="
echo cat ^> public/index.html ^<^< 'HTMLEOF'
type "%SRCDIR%public\index.html"
echo HTMLEOF
echo.

rem ─── npm install + запуск ───
echo echo "=== УСТАНОВКА ЗАВИСИМОСТЕЙ ==="
echo npm install --production 2^>^&1 ^| tail -5
echo.
echo echo "═══════════════════════════════════════════"
echo echo "  ✅ ВСЁ ГОТОВО!"
echo echo "═══════════════════════════════════════════"
echo echo ""
echo echo "Запуск: cd ~/nexo-smtp-client ^&^&^ node src/index.js"
echo echo ""
echo IP=$(hostname -I 2^>/dev/null ^| awk '{print $1}')
echo echo "Панель: http://$IP:3000"
) | ssh %SERVER% "bash -s"

echo.
echo ════════════════════════════════════════════════
echo  ✅ ДЕПЛОЙ ЗАВЕРШЁН!
echo ════════════════════════════════════════════════
echo.
echo  Теперь на сервере:
echo    1. nano ~/nexo-smtp-client/.env  (измени адрес и токен)
echo    2. cd ~/nexo-smtp-client ^&^& node src/index.js
echo.
echo  Или создай systemd сервис для автозапуска.
echo.
pause
