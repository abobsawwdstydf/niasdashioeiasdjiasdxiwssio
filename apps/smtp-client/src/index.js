// NEXO SMTP Client - Main Entry Point
// Запускает: веб-панель, туннель к серверу, SMTP-движок

const { startWebPanel } = require('./web-panel');
const { startTunnel } = require('./tunnel');
const { initDB } = require('./db');
const { loadSettings } = require('./settings');

async function main() {
  console.log('🚀 NEXO SMTP Client v1.0');
  console.log('─────────────────────────');

  // Инициализация БД
  initDB();
  console.log('✅ База данных готова');

  // Загрузка настроек
  const settings = loadSettings();
  console.log(`📡 Панель: http://0.0.0.0:${settings.panelPort}`);

  // Запуск веб-панели
  startWebPanel(settings);

  // Запуск туннеля (если настроен)
  if (settings.serverUrl && settings.tunnelToken) {
    startTunnel(settings);
  } else {
    console.log('⏳ Туннель не настроен — настройте в панели');
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
