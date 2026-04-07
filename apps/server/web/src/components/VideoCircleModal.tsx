import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FlipHorizontal, Send, Loader2 } from 'lucide-react';

interface VideoCircleModalProps {
  onClose: () => void;
  onSend: (file: File) => void;
}

const MAX_DURATION = 90; // 1.5 minutes

export default function VideoCircleModal({ onClose, onSend }: VideoCircleModalProps) {
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Cache camera stream to avoid repeated permission requests
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        await videoPreviewRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Не удалось открыть камеру');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start();
    setIsRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= MAX_DURATION - 1) {
          stopRecording();
          return MAX_DURATION;
        }
        return prev + 1;
      });
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    // Create preview and file
    setTimeout(() => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `videocircle_${Date.now()}.webm`, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setVideoFile(file);
      setIsPreview(true);
      stopCamera();
    }, 100);
  }, []);

  const handleSend = async () => {
    if (!videoFile) return;
    setIsSending(true);
    try {
      onSend(videoFile);
      onClose();
    } catch (e) {
      console.error('Error sending video circle:', e);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = (recordingTime / MAX_DURATION) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        disabled={isSending}
        className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-50"
      >
        <X size={20} />
      </button>

      {cameraError && !isPreview ? (
        <div className="text-center text-white p-8">
          <p className="text-lg font-medium mb-2">Камера недоступна</p>
          <p className="text-sm text-white/60">{cameraError}</p>
        </div>
      ) : isPreview && previewUrl ? (
        /* Preview mode */
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-72 h-72 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl">
            <video
              src={previewUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          <p className="text-white/60 text-sm">Видео {formatTime(recordingTime)}</p>

          <div className="flex items-center gap-4">
            {/* Retake */}
            <button
              onClick={() => {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                setVideoFile(null);
                setIsPreview(false);
                startCamera();
              }}
              disabled={isSending}
              className="px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm text-white font-medium hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              Перезаписать
            </button>

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={isSending}
              className="w-14 h-14 rounded-full bg-nexo-500 hover:bg-nexo-600 flex items-center justify-center text-white transition-all disabled:opacity-50 shadow-lg shadow-nexo-500/30"
            >
              {isSending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Recording mode */
        <div className="flex flex-col items-center gap-8">
          {/* Circular video preview */}
          <div className="relative w-72 h-72">
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-white/20 shadow-2xl">
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />
            </div>

            {/* Progress ring */}
            {isRecording && (
              <>
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="48"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="48"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 48}`}
                    strokeDashoffset={`${2 * Math.PI * 48 * (1 - progress / 100)}`}
                    className="transition-all duration-1000"
                  />
                </svg>

                {/* Timer */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white font-mono text-sm">{formatTime(recordingTime)}</span>
                </div>
              </>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            {/* Flip camera */}
            {!isRecording && (
              <button
                onClick={flipCamera}
                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <FlipHorizontal size={20} />
              </button>
            )}

            {/* Record/Stop button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-white hover:bg-white/90'
              }`}
            >
              {isRecording ? (
                <div className="w-8 h-8 rounded-sm bg-white" />
              ) : (
                <div className="w-16 h-16 rounded-full border-4 border-red-500" />
              )}
            </button>

            {/* Spacer */}
            <div className="w-12" />
          </div>

          <p className="text-white/60 text-sm">
            {isRecording ? 'Нажмите для остановки' : 'Нажмите для записи'}
          </p>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
}
