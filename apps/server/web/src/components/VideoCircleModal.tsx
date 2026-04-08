import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FlipHorizontal, Send, Loader2, Pause, MicOff } from 'lucide-react';

interface VideoCircleModalProps {
  onClose: () => void;
  onSend: (file: File) => void;
}

const MAX_DURATION = 90;

export default function VideoCircleModal({ onClose, onSend }: VideoCircleModalProps) {
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [muteAudio, setMuteAudio] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => { startCamera(); return () => { stopCamera(); if (timerRef.current) clearInterval(timerRef.current); }; }, [facingMode, muteAudio]);

  const startCamera = async () => {
    try {
      setCameraError(null); stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 720 }, height: { ideal: 720 } },
        audio: !muteAudio,
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) { videoPreviewRef.current.srcObject = stream; await videoPreviewRef.current.play(); }
    } catch (err) { console.error('Camera error:', err); setCameraError('Не удалось открыть камеру'); }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const flipCamera = () => setFacingMode(p => p === 'user' ? 'environment' : 'user');

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.start();
    setIsRecording(true); setIsPaused(false); setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => { if (prev >= MAX_DURATION - 1) { stopRecording(); return MAX_DURATION; } return prev + 1; });
    }, 1000);
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => { if (prev >= MAX_DURATION - 1) { stopRecording(); return MAX_DURATION; } return prev + 1; });
      }, 1000);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false); setIsPaused(false);
    if (timerRef.current) clearInterval(timerRef.current);

    setTimeout(() => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `videocircle_${Date.now()}.webm`, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setVideoFile(file);
      setIsPreview(true);
      stopCamera();
    }, 100);
  }, []);

  const handleSend = async () => {
    if (!videoFile) return;
    setIsSending(true);
    try { onSend(videoFile); onClose(); } catch (e) { console.error('Error sending video circle:', e); }
    finally { setIsSending(false); }
  };

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
  const progress = (recordingTime / MAX_DURATION) * 100;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget && !isPreview) onClose(); }}>
      <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm bg-surface-secondary/95 backdrop-blur-xl rounded-t-2xl sm:rounded-2xl border-t sm:border border-white/10 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/5">
          <div className="w-8" />
          <h3 className="text-sm font-semibold text-white">Видео-кружок</h3>
          <button onClick={onClose} disabled={isSending}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-50">
            <X size={14} />
          </button>
        </div>

        {cameraError && !isPreview ? (
          <div className="text-center text-white p-8"><p>Камера недоступна</p><p className="text-sm text-white/60">{cameraError}</p></div>
        ) : isPreview && previewUrl ? (
          /* Preview */
          <div className="flex flex-col items-center gap-4 p-6">
            <div className="relative w-48 h-48 rounded-full overflow-hidden border-2 border-white/20">
              <video src={previewUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
            </div>
            <p className="text-white/40 text-xs">Видео {formatTime(recordingTime)}</p>
            <div className="flex items-center gap-3">
              <button onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setVideoFile(null); setIsPreview(false); startCamera(); }}
                disabled={isSending} className="px-5 py-2.5 rounded-full bg-white/5 text-white text-sm hover:bg-white/10 disabled:opacity-50">
                Перезаписать
              </button>
              <button onClick={handleSend} disabled={isSending}
                className="w-12 h-12 rounded-full bg-nexo-500 hover:bg-nexo-600 flex items-center justify-center text-white disabled:opacity-50">
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        ) : (
          /* Recording */
          <div className="flex flex-col items-center gap-5 p-6">
            {/* Circle video */}
            <div className="relative w-48 h-48">
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-white/10 shadow-xl">
                <video ref={videoPreviewRef} autoPlay playsInline muted
                  className="w-full h-full object-cover" />
              </div>

              {/* Progress ring */}
              {isRecording && !isPaused && (
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                  <circle cx="50" cy="50" r="48" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 48}`}
                    strokeDashoffset={`${2 * Math.PI * 48 * (1 - progress / 100)}`}
                    className="transition-all duration-1000" />
                </svg>
              )}
            </div>

            {/* Timer - below circle */}
            {isRecording && (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-white font-mono text-sm">{formatTime(recordingTime)}</span>
                <span className="text-white/30 text-xs">/ 1:30</span>
              </div>
            )}

            {/* Controls row */}
            <div className="flex items-center gap-3">
              {/* Flip */}
              <button onClick={flipCamera}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <FlipHorizontal size={18} />
              </button>

              {/* Mute toggle */}
              <button onClick={() => { setMuteAudio(!muteAudio); }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${muteAudio ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}>
                <MicOff size={18} />
              </button>

              {/* Record/Pause/Stop */}
              {!isRecording ? (
                <button onClick={startRecording}
                  className="w-16 h-16 rounded-full bg-white hover:bg-white/90 flex items-center justify-center transition-all">
                  <div className="w-12 h-12 rounded-full border-4 border-red-500" />
                </button>
              ) : isPaused ? (
                <button onClick={resumeRecording}
                  className="w-16 h-16 rounded-full bg-nexo-500 hover:bg-nexo-600 flex items-center justify-center text-white transition-all">
                  <Send size={24} />
                </button>
              ) : (
                <button onClick={pauseRecording}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all">
                  <Pause size={24} />
                </button>
              )}

              {/* Stop recording (send immediately) */}
              {isRecording && (
                <button onClick={stopRecording}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                  <div className="w-4 h-4 rounded-sm bg-current" />
                </button>
              )}
            </div>

            <p className="text-white/40 text-xs">
              {!isRecording ? 'Нажмите для записи' : isPaused ? 'Пауза' : 'Нажмите для паузы'}
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
