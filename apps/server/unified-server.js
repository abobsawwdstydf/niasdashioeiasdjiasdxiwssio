const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5032;

// Serve static files from web dist
app.use(express.static(path.join(__dirname, 'apps/web/dist')));

// Proxy API requests to backend
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
}));

// Proxy socket.io
app.use('/socket.io', createProxyMiddleware({
  target: 'http://localhost:3001',
  ws: true,
  changeOrigin: true,
}));

// Serve uploads
app.use('/uploads', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
}));

// All other routes serve index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'apps/web/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ⚡ Nexo Unified Server running on port ${PORT}`);
  console.log(`  📡 Web: http://localhost:${PORT}`);
  console.log(`  🔌 API: http://localhost:${PORT}/api\n`);
});
