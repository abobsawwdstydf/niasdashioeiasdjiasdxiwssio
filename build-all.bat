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
pause
