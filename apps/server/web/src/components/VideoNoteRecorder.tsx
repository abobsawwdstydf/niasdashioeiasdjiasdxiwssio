import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Camera, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface VideoNoteRecorderProps {
  chatId: string;
  onClose: () => void;
  onSent: () => void;
}

export default function VideoNoteRecorder({ chatId, onClose, onSent }: VideoNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize camera
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 480 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setError(null);
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotFoundError') {
        setError('Камера не найдена. Подключите камеру и попробуйте снова.');
      } else if (err.name === 'NotAllowedError') {
        setError('Разрешите доступ к камере в настройках браузера.');
      } else if (err.name === 'NotReadableError') {
        setError('Камера используется другим приложением.');
      } else {
        setError('Не удалось получить доступ к камере.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: 750000, // 0.75 Mbps
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await sendVideoNote();
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          if (newDuration >= 90) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
    } catch (err) {
      console.error('Recording error:', err);
      setError('Не удалось начать запись.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const sendVideoNote = async () => {
    setIsSending(true);
    try {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('video', blob, 'video-note.webm');
      formData.append('chatId', chatId);
      formData.append('duration', duration.toString());

      await api.uploadVideoNote(formData);
      onSent();
      onClose();
    } catch (err) {
      console.error('Send error:', err);
      setError('Не удалось отправить видеокружок.');
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    chunksRef.current = [];
    onClose();
  };

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset } = info;
    
    // Swipe left/right to cancel
    if (Math.abs(offset.x) > 100) {
      handleCancel();
    }
    
    // Swipe up to lock recording
    if (offset.y < -100) {
      setIsPaused(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={handleCancel}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDrag}
          onClick={(e) => e.stopPropagation()}
          className="relative flex flex-col items-center gap-6 p-8"
        >
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={24} className="text-white" />
          </button>

          {/* Timer */}
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-white text-2xl font-bold"
            >
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              {formatTime(duration)} / 01:30
            </motion.div>
          )}

          {/* Video viewfinder */}
          <div className="relative">
            {/* Circular mask */}
            <div className="w-[480px] h-[480px] rounded-full overflow-hidden ring-4 ring-nexo-500/50 shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
              />
            </div>

            {/* Progress ring */}
            {isRecording && (
              <svg
                className="absolute inset-0 w-full h-full -rotate-90"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="rgba(99, 102, 241, 0.3)"
                  strokeWidth="2"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: duration / 90 }}
                  style={{
                    pathLength: duration / 90,
                    strokeDasharray: '0 1',
                  }}
                />
              </svg>
            )}

            {/* Camera switch button */}
            <button
              onClick={toggleCamera}
              disabled={isRecording}
              className="absolute top-4 right-4 p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors disabled:opacity-50"
            >
              <Camera size={24} className="text-white" />
            </button>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200 text-sm max-w-md text-center"
            >
              {error}
            </motion.div>
          )}

          {/* Record button */}
          {!isSending && (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!!error}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-white hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl`}
            >
              {isRecording ? (
                <div className="w-8 h-8 rounded bg-white" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-red-500" />
              )}
            </button>
          )}

          {/* Sending indicator */}
          {isSending && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 text-white"
            >
              <Loader2 size={24} className="animate-spin" />
              <span className="text-lg">Отправка...</span>
            </motion.div>
          )}

          {/* Hint */}
          {!isRecording && !error && (
            <p className="text-white/60 text-sm text-center max-w-md">
              Нажмите на кнопку для начала записи.<br />
              Смахните влево/вправо для отмены.<br />
              Смахните вверх для закрепления записи.
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
