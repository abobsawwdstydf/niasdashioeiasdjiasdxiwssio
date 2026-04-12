/**
 * Глобальный менеджер аудио — гарантирует что только одно аудио играет одновременно
 */
class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;

  play(audio: HTMLAudioElement): Promise<void> {
    // Останавливаем текущее
    if (this.currentAudio && this.currentAudio !== audio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    this.currentAudio = audio;
    return audio.play();
  }

  pause(audio: HTMLAudioElement) {
    if (this.currentAudio === audio) {
      audio.pause();
      this.currentAudio = null;
    }
  }

  isPlaying(audio: HTMLAudioElement): boolean {
    return this.currentAudio === audio && !audio.paused;
  }

  // Убить всё
  stopAll() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }
}

export const audioManager = new AudioManager();
