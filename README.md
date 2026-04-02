# Nexo Messenger

Modern real-time messenger with end-to-end encryption.

## Features

- 💬 Real-time messaging
- 🔐 End-to-end encryption (AES-256-GCM)
- 📁 File sharing (up to 25GB)
- 🎤 Voice messages
- 📞 Voice/Video calls (WebRTC)
- 📱 Mobile responsive
- 🌓 Dark theme

## Tech Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS
- **Backend:** Node.js, Express, Socket.io
- **Database:** SQLite (dev) / PostgreSQL (prod)
- **ORM:** Prisma

## Quick Start

### Development

```bash
npm install
npm run dev
```

### Docker

```bash
docker build -t nexo-messenger .
docker run -p 3001:3001 nexo-messenger
```

### Docker Compose

```bash
docker-compose up -d
```

## Environment Variables

```env
# Server
PORT=3001
NODE_ENV=production

# Security
JWT_SECRET=your-secret-key-here
ENCRYPTION_KEY=your-encryption-key-here

# CORS
CORS_ORIGINS=https://your-domain.com

# Rate Limiting
MAX_REGISTRATIONS_PER_IP=10
```

## Deployment

### Render

1. Connect GitHub repository
2. Create Web Service
3. Build Command: `npm install && npm run build`
4. Start Command: `node apps/server/dist/index.js`
5. Add environment variables

### VPS

```bash
# Clone repository
git clone <your-repo-url>
cd nexo-messenger

# Install dependencies
npm install

# Build
npm run build

# Start with PM2
pm2 start apps/server/dist/index.js --name nexo
```

## API Endpoints

- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/users/search` - Search users
- `GET /api/chats` - Get chats
- `GET /api/messages/:chatId` - Get messages
- `POST /api/messages` - Send message

## License

MIT
