import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import { useChatStore } from './stores/chatStore';
import { api } from './lib/api';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import QRConfirmPage from './pages/QRConfirmPage';

export default function App() {
  const { token, user, checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();

    // Handle hash routes like #/@username
    const handleHashRoute = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/@')) {
        const username = hash.slice(3);
        window.location.href = `/?user=${username}`;
      } else if (hash.startsWith('#/channel/')) {
        const channelUsername = hash.slice(10);
        window.location.href = `/?channel=${channelUsername}`;
      }
    };

    handleHashRoute();
    window.addEventListener('hashchange', handleHashRoute);
    return () => window.removeEventListener('hashchange', handleHashRoute);
  }, [checkAuth]);

  // Check if we're on QR confirm page
  const isQRConfirm = window.location.pathname.startsWith('/auth/verify/');
  if (isQRConfirm) {
    return <QRConfirmPage />;
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <NexoLoader />
          <p className="text-zinc-500 text-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {token && user ? (
        <ChatPage key="chat" />
      ) : (
        <AuthPage key="auth" />
      )}
    </AnimatePresence>
  );
}

function NexoLoader() {
  return (
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-nexo-500 animate-spin" />
      <div
        className="absolute inset-1 rounded-full border-2 border-transparent border-t-nexo-400 animate-spin"
        style={{ animationDuration: '0.8s', animationDirection: 'reverse' }}
      />
      <div
        className="absolute inset-2 rounded-full border-2 border-transparent border-t-nexo-300 animate-spin"
        style={{ animationDuration: '0.6s' }}
      />
    </div>
  );
}
