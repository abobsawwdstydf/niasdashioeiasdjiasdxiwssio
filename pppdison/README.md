# Nexo Messenger - Приложения для всех платформ

## 📱 Платформы

### Windows (EXE)
- **Папка**: `windows/app/`
- **Сборка**: `windows/build.bat`
- **Технология**: Electron
- **Форматы**: NSIS Installer, Portable EXE
- **Настройки**: URL сервера в меню "Файл > Настройки сервера"

### Android (APK)
- **Папка**: `android/app/`
- **Сборка**: `android/build.bat`
- **Технология**: Capacitor + WebView
- **Формат**: APK (Debug/Release)
- **Настройки**: URL сервера в capacitor.config.json

### macOS (DMG)
- **Папка**: `macos/app/`
- **Сборка**: `macos/build.sh`
- **Технология**: Electron
- **Форматы**: DMG, ZIP
- **Настройки**: URL сервера в меню "Nexo > Server Settings"

### Linux
- **Папка**: `linux/`
- Используйте Electron или Web версию

## 🚀 Быстрый запуск

### Способ 1: VBS Скрипт (Windows)
```
Двойной клик по run-nexo.vbs
```
Автоматически запустит сервер и откроет браузер

### Способ 2: Ручной запуск
```bash
npm run dev
```
Откройте http://localhost:3001

## 🔑 Общие функции всех приложений

### Авторизация
- **QR-код** - отсканируйте QR-код для быстрого входа
- **Ключ авторизации** - 37-символьный ключ формата `nexo-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Устройства** - просмотр всех активных сессий

### Настройки сервера
В каждом приложении можно указать URL сервера:
- По умолчанию: `http://localhost:3001`
- Можно изменить в настройках приложения

### Хранение файлов
Все файлы хранятся в **Telegram** через Telegram Bot API.

## 📦 Сборка приложений

### Windows EXE
```bash
cd pppdison/windows
build.bat
```
Результат: `windows/app/dist/Nexo Messenger Setup.exe`

### Android APK
```bash
cd pppdison/android
build.bat
```
Результат: `android/app/android/app/build/outputs/apk/debug/app-debug.apk`

### macOS DMG
```bash
cd pppdison/macos
./build.sh
```
Результат: `macos/app/dist/Nexo Messenger.dmg`

## 📊 Структура

```
pppdison/
├── android/          # Android приложение
│   ├── app/          # Исходный код
│   └── build.bat     # Скрипт сборки
├── windows/          # Windows приложение
│   ├── app/          # Исходный код (Electron)
│   └── build.bat     # Скрипт сборки
├── macos/            # macOS приложение
│   ├── app/          # Исходный код (Electron)
│   └── build.sh      # Скрипт сборки
├── linux/            # Linux приложение
│   └── README.md
├── QR_AUTH_PLAN.md   # План QR-авторизации
└── README.md         # Этот файл
```

## 🌐 API

Все приложения работают через единый API:
- REST API: `/api/*`
- WebSocket: Socket.IO
- Файлы: через Telegram Storage

## ⚙️ Требования

### Для сборки Windows
- Node.js 18+
- npm

### Для сборки Android
- Node.js 18+
- Android Studio с SDK
- Java JDK 11+

### Для сборки macOS
- macOS
- Node.js 18+
- Xcode Command Line Tools
