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
  channelId: number;
  messageId: number;
  botId: number;
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

  constructor() {
    this.initializeBots();
  }

  private initializeBots() {
    this.bots = TELEGRAM_BOTS.map(bot => ({
      ...bot,
      client: axios.create({
        baseURL: `https://api.telegram.org/bot${bot.token}`,
        timeout: 30000,
      }),
      available: true,
    }));
    console.log(`\n🤖 TELEGRAM STORAGE:`);
    console.log(`  ✓ Инициализировано ${this.bots.length} Telegram ботов`);
    console.log(`  ✓ Каналов хранения: ${TELEGRAM_CHANNELS.length}`);
    TELEGRAM_CHANNELS.forEach((ch, i) => {
      console.log(`    ${i + 1}. ${ch.name} (${ch.chatId})`);
    });
    console.log('');
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
  ): Promise<{ messageId: number; botId: number }> {
    const bot = this.getNextBot();
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
      console.log(`   ✅ Чанк отправлен! Message ID: ${messageId}`);

      return {
        messageId,
        botId: bot.id,
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
    botId: number
  ): Promise<Buffer> {
    const bot = this.bots.find(b => b.id === botId) || this.getNextBot();

    try {
      // Get file info
      const fileResponse = await bot.client.get('/getMessage', {
        params: { chat_id: channelId, message_id: messageId },
      });

      const file = fileResponse.data.result.document;
      if (!file) {
        throw new Error('File not found in message');
      }

      // Download file
      const downloadResponse = await bot.client.get(`/file?file_id=${file.file_id}`, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });

      return Buffer.from(downloadResponse.data);
    } catch (error: any) {
      console.error('Download error:', error.response?.data || error.message);
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

      // Select channel (round-robin)
      const channel = TELEGRAM_CHANNELS[i % TELEGRAM_CHANNELS.length];

      console.log(`\n   📤 Чанк ${i + 1}/${chunkCount} → ${channel.name}`);

      const { messageId, botId } = await this.uploadChunk(
        chunk,
        `${fileId}_part${i}`,
        channel.chatId
      );

      chunks.push({
        channelId: channel.id,
        messageId,
        botId,
        chunkIndex: i,
        size: chunk.length,
      });

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n✅ ФАЙЛ ПОЛНОСТЬЮ ЗАГРУЖЕН В TELEGRAM!`);
    console.log(`   ${filename} → ${chunks.length} чанков в ${new Set(chunks.map(c => c.channelId)).size} каналах`);

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
    const chunkBuffers: Buffer[] = [];

    console.log(`  ⬇️ Скачивание ${chunks.length} чанков...`);

    // Download chunks in parallel (max 3 concurrent)
    const concurrency = 3;
    for (let i = 0; i < chunks.length; i += concurrency) {
      const batch = chunks.slice(i, i + concurrency);
      const promises = batch.map(async (chunk) => {
        const channel = TELEGRAM_CHANNELS.find(c => c.id === chunk.channelId);
        if (!channel) {
          throw new Error(`Channel ${chunk.channelId} not found`);
        }

        const buffer = await this.downloadChunk(
          channel.chatId,
          chunk.messageId,
          chunk.botId
        );
        return { index: chunk.chunkIndex, buffer };
      });

      const results = await Promise.all(promises);
      results.forEach(result => {
        chunkBuffers[result.index] = result.buffer;
      });

      console.log(`  ✓ Скачано ${Math.min(i + concurrency, chunks.length)}/${chunks.length} чанков`);
    }

    // Reassemble file
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
