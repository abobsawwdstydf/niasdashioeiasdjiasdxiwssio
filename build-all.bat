@echo off
echo ========================================
echo   Nexo Messenger - Build All Apps
echo ========================================
echo.

echo Building Desktop EXE...
call build-desktop.bat

echo.
echo Building Mobile APK...
call build-mobile.bat

echo.
echo ========================================
echo   All Builds Complete!
echo ========================================
echo.
echo Desktop: desktop\dist\Nexo-Messenger-Setup-1.0.0.exe
echo Mobile:  mobile\android\app\build\outputs\apk\debug\app-debug.apk
echo.
pause
