import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { TELEGRAM_BOTS, TELEGRAM_CHANNELS, CHUNK_SIZE } from './telegram';
import { createReadStream } from 'fs';

interface TelegramBot {
  id: number;
  name: string;
  token: string;
  client: AxiosInstance;
  available: boolean;
}

interface UploadedChunk {
  channelId: number; // Index in TELEGRAM_CHANNELS array (0-based)
  messageId: number;
  botId: number;     // Index in bots array (0-based)
  chunkIndex: number;
  size: number;
}

interface StoredFile {
  fileId: string;
  originalName: string;
  mimeType: string;
  totalSize: number;
  encryptionLevel: number;
  chunks: UploadedChunk[];
  createdAt: string;
  userId: string;
}

class TelegramStorage {
  private bots: TelegramBot[] = [];
  private botIndex = 0;
  private initialized = false;

  constructor() {
    // Sync init — bots initialized on first use
    this.bots = TELEGRAM_BOTS.map(bot => ({
      ...bot,
      client: axios.create({
        baseURL: `https://api.telegram.org/bot${bot.token}`,
        timeout: 30000,
      }),
      available: true,
    }));
    
    console.log(`\n🤖 TELEGRAM STORAGE:`);
    console.log(`  ✓ Инициализировано ${this.bots.length} ботов`);
    console.log(`  ✓ Каналов хранения: ${TELEGRAM_CHANNELS.length}`);
    TELEGRAM_CHANNELS.forEach((ch, i) => {
      console.log(`    ${i + 1}. ${ch.name} (${ch.chatId})`);
    });
    console.log('');
  }

  private async ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;
    
    // Test each bot async on first use
    for (const bot of this.bots) {
      try {
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 10000)
        );
        const response = await Promise.race([
          bot.client.get('/getMe'),
          timeout
        ]) as any;

        if (!response.data?.ok) {
          bot.available = false;
          console.warn(`[TelegramStorage] ❌ Бот ${bot.name} недоступен`);
        }
      } catch (error) {
        bot.available = false;
        console.warn(`[TelegramStorage] ❌ Бот ${bot.name} недоступен`);
      }
    }

    const availableCount = this.bots.filter(b => b.available).length;
    console.log(`[TelegramStorage] ✓ ${availableCount}/${this.bots.length} ботов доступны`);
    if (availableCount === 0) {
      console.error('[TelegramStorage] ⚠️ НЕТ ДОСТУПНЫХ БОТОВ! Загрузка файлов не работает!');
    }
  }

  private getNextBot(): TelegramBot {
    const availableBots = this.bots.filter(b => b.available);
    if (availableBots.length === 0) {
      throw new Error('Нет доступных ботов');
    }
    const bot = availableBots[this.botIndex % availableBots.length];
    this.botIndex++;
    return bot;
  }

  private async getChannelMembers(chatId: string): Promise<number[]> {
    const bot = this.getNextBot();
    try {
      const response = await bot.client.get('/getChatMembersCount', {
        params: { chat_id: chatId },
      });
      return [bot.id]; // Bot is in channel
    } catch (error) {
      console.error(`Bot ${bot.name} not in channel ${chatId}`);
      return [];
    }
  }

  async uploadChunk(
    chunkBuffer: Buffer,
    filename: string,
    channelId: string
  ): Promise<{ messageId: number; botIndex: number }> {
    const bot = this.getNextBot();
    const botIndex = this.bots.indexOf(bot);
    const formData = new FormData();
    formData.append('chat_id', channelId);
    formData.append('document', chunkBuffer, {
      filename: `${filename}.chunk`,
      contentType: 'application/octet-stream',
    });

    try {
      console.log(`   ⬆️ Отправка чанка в канал ${channelId}...`);
      const response = await bot.client.post('/sendDocument', formData, {
        headers: formData.getHeaders(),
        timeout: 60000,
      });

      const messageId = response.data.result.message_id;
      console.log(`   ✅ Чанк отправлен! Message ID: ${messageId}, Bot index: ${botIndex}`);

      return {
        messageId,
        botIndex,
      };
    } catch (error: any) {
      console.error(`   ❌ ОШИБКА отправки чанка:`, error.response?.data || error.message);
      bot.available = false;
      throw error;
    }
  }

  async downloadChunk(
    channelId: string,
    messageId: number,
    botIndex: number
  ): Promise<Buffer> {
    const bot = this.bots[botIndex] || this.getNextBot();

    try {
      // Get file info
      const fileResponse = await bot.client.get('/getMessage', {
        params: { chat_id: channelId, message_id: messageId },
      });

      const msg = fileResponse.data.result;
      // Document could be in document, video, audio, or photo field
      const file = msg.document || msg.video || msg.audio || (msg.photo && msg.photo[msg.photo.length - 1]);
      if (!file) {
        throw new Error(`No file in message ${messageId}. Keys: ${Object.keys(msg).join(', ')}`);
      }

      // Download file
      const downloadResponse = await bot.client.get(`/file?file_id=${file.file_id}`, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });

      return Buffer.from(downloadResponse.data);
    } catch (error: any) {
      console.error(`Download error for msg ${messageId}:`, error.response?.data?.description || error.message);
      throw error;
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    userId: string,
    encryptionLevel: number = 0
  ): Promise<StoredFile> {
    await this.ensureInitialized();
    const fileId = `tg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const chunks: UploadedChunk[] = [];

    // Split file into chunks
    const chunkCount = Math.ceil(fileBuffer.length / CHUNK_SIZE);
    const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
    
    console.log(`\n📦 ФАЙЛ: ${filename}`);
    console.log(`   Размер: ${fileSizeMB} MB`);
    console.log(`   MIME: ${mimeType}`);
    console.log(`   Пользователь: ${userId}`);
    console.log(`   Чанков: ${chunkCount}`);
    console.log(`   File ID: ${fileId}`);

    for (let i = 0; i < chunkCount; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileBuffer.length);
      const chunk = fileBuffer.slice(start, end);

      // Select channel (round-robin) — use array index (0-based)
      const channelIndex = i % TELEGRAM_CHANNELS.length;
      const channel = TELEGRAM_CHANNELS[channelIndex];

      console.log(`\n   📤 Чанк ${i + 1}/${chunkCount} → channel[${channelIndex}] ${channel.chatId}`);

      const { messageId, botIndex } = await this.uploadChunk(
        chunk,
        `${fileId}_part${i}`,
        channel.chatId
      );

      chunks.push({
        channelId: channelIndex,
        messageId,
        botId: botIndex,
        chunkIndex: i,
        size: chunk.length,
      });

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n✅ ФАЙЛ ПОЛНОСТЬЮ ЗАГРУЖЕН В TELEGRAM!`);
    console.log(`   ${filename} → ${chunks.length} чанков`);

    const storedFile: StoredFile = {
      fileId,
      originalName: filename,
      mimeType,
      totalSize: fileBuffer.length,
      encryptionLevel,
      chunks,
      createdAt: new Date().toISOString(),
      userId,
    };

    return storedFile;
  }

  async downloadFile(fileId: string, chunks: UploadedChunk[]): Promise<Buffer> {
    await this.ensureInitialized();
    const chunkBuffers: Buffer[] = [];

    console.log(`  ⬇️ Скачивание ${chunks.length} чанков для ${fileId}...`);

    // Download chunks in parallel (max 3 concurrent)
    const concurrency = 3;
    for (let i = 0; i < chunks.length; i += concurrency) {
      const batch = chunks.slice(i, i + concurrency);
      const promises = batch.map(async (chunk) => {
        // Try channels: stored one first, then all others as fallback
        const channelIndices = [chunk.channelId, ...TELEGRAM_CHANNELS.map((_, i) => i).filter(i => i !== chunk.channelId)];
        const lastErrorPerChannel: Record<number, string> = {};

        for (const chIdx of channelIndices) {
          const channel = TELEGRAM_CHANNELS[chIdx];
          if (!channel) continue;

          // Try the stored bot first, then fall back to other bots
          let lastError: Error | null = null;
          const allBotIndices = Array.from({ length: this.bots.length }, (_, i) => i);
          const storedBotIdx = chunk.botId >= 0 && chunk.botId < this.bots.length ? chunk.botId : 0;
          const orderedIndices = [storedBotIdx, ...allBotIndices.filter(i => i !== storedBotIdx)];

          for (const botIdx of orderedIndices.slice(0, 3)) {
            try {
              const bot = this.bots[botIdx];
              if (!bot || !bot.available) continue;

              const buffer = await this.downloadChunk(
                channel.chatId,
                chunk.messageId,
                botIdx
              );
              if (chIdx !== chunk.channelId) {
                console.log(`  ⚠️ Chunk ${chunk.chunkIndex} downloaded from channel[${chIdx}] instead of [${chunk.channelId}]`);
              }
              return { index: chunk.chunkIndex, buffer };
            } catch (err: any) {
              lastError = err;
            }
          }

          if (lastError) lastErrorPerChannel[chIdx] = lastError.message;
        }

        // All channels and bots failed
        const errors = Object.entries(lastErrorPerChannel).map(([ch, msg]) => `ch[${ch}]: ${msg}`).join('; ');
        throw new Error(`All channels/bots failed for chunk ${chunk.chunkIndex}: ${errors}`);
      });

      const results = await Promise.all(promises);
      results.forEach(result => {
        chunkBuffers[result.index] = result.buffer;
      });

      console.log(`  ✓ Скачано ${Math.min(i + concurrency, chunks.length)}/${chunks.length} чанков`);
    }

    // Reassemble file
    const totalSize = chunkBuffers.reduce((sum, b) => sum + b.length, 0);
    console.log(`  ✅ Файл собран: ${totalSize} bytes`);
    return Buffer.concat(chunkBuffers);
  }

  async deleteFile(chunks: UploadedChunk[]): Promise<void> {
    const promises = chunks.map(async (chunk) => {
      const channel = TELEGRAM_CHANNELS.find(c => c.id === chunk.channelId);
      const bot = this.bots.find(b => b.id === chunk.botId) || this.getNextBot();
      
      if (!channel) return;

      try {
        await bot.client.post('/deleteMessage', {
          chat_id: channel.chatId,
          message_id: chunk.messageId,
        });
      } catch (error) {
        console.error('Failed to delete chunk:', error);
      }
    });

    await Promise.all(promises);
  }

  getStats() {
    return {
      totalBots: this.bots.length,
      availableBots: this.bots.filter(b => b.available).length,
      channels: TELEGRAM_CHANNELS.length,
    };
  }
}

export const telegramStorage = new TelegramStorage();
