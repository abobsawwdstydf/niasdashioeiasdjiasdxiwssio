const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5032;

// Serve static files from web dist
const webDistPath = path.join(__dirname, '..', 'web', 'dist');
console.log('Serving web from:', webDistPath);

app.use(express.static(webDistPath));

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

// Proxy uploads
app.use('/uploads', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
}));

// All other routes serve index.html (SPA)
app.get('*', (req, res) => {
  const indexPath = path.join(webDistPath, 'index.html');
  console.log('Serving index.html from:', indexPath);
  res.sendFile(indexPath);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ⚡ Nexo Unified Server running on port ${PORT}`);
  console.log(`  📡 Web: http://localhost:${PORT}`);
  console.log(`  🔌 API: http://localhost:${PORT}/api\n`);
});
