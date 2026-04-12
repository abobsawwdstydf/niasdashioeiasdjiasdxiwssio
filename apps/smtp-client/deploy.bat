@echo off
chcp 65001 >nul 2>&1
echo ========================================================
echo  NEXO SMTP Client — Полный Deploy на сервер
echo ========================================================
echo.
echo Подключаемся к серверу...
echo Введи пароль когда появится запрос: 0611.com
echo.
echo ========================================================
echo.

set SERVER=nexo-smtp@SERVER-NEXO-MSG-NEXO
set SRCDIR=%~dp0

echo [1/3] Создание файлов и установка на сервере...
echo.

type "%SRCDIR%setup-server.sh" | ssh %SERVER% "bash -s"

echo.
echo ========================================================
echo [2/3] Копирование веб-панели (HTML)...
echo ========================================================
echo.

scp "%SRCDIR%public\index.html" %SERVER%:~/nexo-smtp-client/public/

echo.
echo ========================================================
echo [3/3] Настройка .env...
echo ========================================================
echo.

echo Какой адрес сервера NEXO? (wss://...)
set /p SERVER_URL= Адрес: 
set /p TUNNEL_TOKEN= Токен туннеля: 

(
echo SERVER_URL=%SERVER_URL%
echo TUNNEL_TOKEN=%TUNNEL_TOKEN%
echo PANEL_PORT=3000
) | ssh %SERVER% "cat > ~/nexo-smtp-client/.env"

echo.
echo ========================================================
echo  ✅ ГОТОВО!
echo ========================================================
echo.
echo Запуск:
echo   ssh %SERVER%
echo   cd ~/nexo-smtp-client
echo   node src/index.js
echo.
echo Панель: http://SERVER_IP:3000
echo.
pause
