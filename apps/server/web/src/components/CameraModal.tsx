import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Video, FlipHorizontal, Check, X as XIcon, Play, StopCircle } from 'lucide-react';

interface CameraModalProps {
  onClose: () => void;
  onCapture: (file: File, type: 'image' | 'video') => void;
}

export default function CameraModal({ onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Initialize camera
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
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: mode === 'video',
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Не удалось открыть камеру. Проверьте разрешения.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsReady(false);
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Take photo
  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip if using front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;

      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file, 'image');
      onClose();
    }, 'image/jpeg', 0.95);
  }, [facingMode, onCapture, onClose]);

  // Start/stop video recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      // Start recording
      startRecording();
    }
  }, [isRecording]);

  const startRecording = () => {
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
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const file = new File([blob], `video_${Date.now()}.webm`, { type: mimeType });
      onCapture(file, 'video');
      onClose();
    };

    recorder.start();
    setIsRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex flex-col"
    >
      {/* Close button */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          <X size={24} />
        </button>

        {/* Mode switcher */}
        <div className="flex gap-2 bg-black/50 backdrop-blur-sm rounded-full p-1">
          <button
            onClick={() => setMode('photo')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              mode === 'photo' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            <Camera size={16} />
            Фото
          </button>
          <button
            onClick={() => setMode('video')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              mode === 'video' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            <Video size={16} />
            Видео
          </button>
        </div>

        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Camera view */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {cameraError ? (
          <div className="text-center text-white p-8">
            <Camera size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Камера недоступна</p>
            <p className="text-sm text-white/60">{cameraError}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                <span className="text-white font-mono text-sm">{formatTime(recordingTime)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      {!cameraError && (
        <div className="bg-black p-8 pb-12 flex flex-col items-center gap-6">
          {/* Capture button */}
          <div className="flex items-center gap-8">
            {/* Flip camera */}
            <button
              onClick={flipCamera}
              className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <FlipHorizontal size={24} />
            </button>

            {/* Photo/Record button */}
            <button
              onClick={mode === 'photo' ? takePhoto : toggleRecording}
              disabled={!isReady}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                mode === 'photo'
                  ? 'bg-white hover:bg-white/90'
                  : isRecording
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-white hover:bg-white/90'
              } ${!isReady ? 'opacity-50' : ''}`}
            >
              {mode === 'photo' ? (
                <div className="w-16 h-16 rounded-full border-4 border-black/20" />
              ) : isRecording ? (
                <StopCircle size={32} className="text-white" />
              ) : (
                <div className="w-16 h-16 rounded-full border-4 border-red-500">
                  <div className="w-full h-full rounded-full bg-red-500/20" />
                </div>
              )}
            </button>

            {/* Spacer for flip */}
            <div className="w-12" />
          </div>

          {/* Hint text */}
          <p className="text-white/60 text-sm">
            {mode === 'photo' ? 'Нажмите для снимка' : isRecording ? 'Нажмите для остановки' : 'Нажмите для записи'}
          </p>
        </div>
      )}
    </motion.div>
  );
}
