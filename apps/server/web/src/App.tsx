import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import { useChatStore } from './stores/chatStore';
import { api } from './lib/api';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import ToastContainer from './components/ToastContainer';
import { NexoLoader } from './components/LoadingStates';
import { pageTransitionFade } from './lib/animations';

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

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full flex items-center justify-center bg-surface"
      >
        <div className="flex flex-col items-center gap-4">
          <NexoLoader size="lg" />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-500 text-sm"
          >
            Загрузка...
          </motion.p>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {token && user ? (
          <motion.div key="chat" {...pageTransitionFade}>
            <ChatPage />
          </motion.div>
        ) : (
          <motion.div key="auth" {...pageTransitionFade}>
            <AuthPage />
          </motion.div>
        )}
      </AnimatePresence>
      <ToastContainer />
    </>
  );
}
