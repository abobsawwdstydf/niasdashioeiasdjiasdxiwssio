import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Telegram bots configuration
const BOTS = [
  { id: 'bot1', token: '8674460757:AAFm7WVkDx4ISkx22toTQyrQUeGQfLdF8QM' },
  { id: 'bot2', token: '8733182475:AAFBitv4g4LVRuvGnssyqHQpttBydeAda9Y' },
  { id: 'bot3', token: '8774720953:AAGvExABKj4Z-DYfKdqF-OMEdoeySeOeOoY' },
  { id: 'bot4', token: '8141008503:AAEaCM1RrN2ppbZmUzhpW4EeLUgT1qQ2QS0' },
  { id: 'bot5', token: '8687986079:AAGPYjnq4gdXCkf2wT81f0l2tQalKCIIyds' },
  { id: 'bot6', token: '8758985233:AAF7QfRApnccaByBYa1qjGs7u-erQ47OZcQ' },
  { id: 'bot7', token: '8554202189:AAGN0wLfcgkqK3KJ9XOJFl40rp2kjkIcm1Y' },
  { id: 'bot8', token: '8748554768:AAEnJcHklmilbjih9glo3GITnQXSx4YmM_8' },
  { id: 'bot9', token: '8744960493:AAHB5bn3VxlZWKJjCr70yLYJnVTyXp2zHIs' },
  { id: 'bot10', token: '8734408678:AAH7eTD97tepfwqdYKieNOoxsGZaEdPYWhI' },
  { id: 'bot11', token: '8141208214:AAFOOel84oRN3Uj8rEOWI_6H3LaAa6Z76Q0' },
  { id: 'bot12', token: '8758209438:AAEnaXcJ7ke88fjjHNPwQVTt_u9LYrSzPFk' },
  { id: 'bot13', token: '8680953724:AAFbz6yKdLC0ANkwTbLsZ0GSN78zVbTWUb8' },
  { id: 'bot14', token: '8743205528:AAF2V2Z8UU5A3aJiSd5JveswVen_immyp9E' },
];

// Telegram storage channels
const CHANNELS = [
  '-1003850596987',
  '-1003878106202',
  '-1003868880877',
  '-1003738083520',
];

// Chunk size: 19MB
const CHUNK_SIZE = 19 * 1024 * 1024;

// Round-robin index for bots and channels
let botIndex = 0;
let channelIndex = 0;

function getNextBot() {
  const bot = BOTS[botIndex % BOTS.length];
  botIndex++;
  return bot;
}

function getNextChannel() {
  const channel = CHANNELS[channelIndex % CHANNELS.length];
  channelIndex++;
  return channel;
}

export interface UploadedFile {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunks: Array<{
    messageId: number;
    channelId: string;
    botId: string;
    chunkIndex: number;
  }>;
  uploadedAt: Date;
}

/**
 * Upload file to Telegram channels in chunks
 */
export async function uploadFileToTelegram(
  filePath: string,
  fileName: string,
  mimeType: string
): Promise<UploadedFile> {
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  
  const fileId = crypto.randomUUID();
  const chunks: UploadedFile['chunks'] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const chunkBuffer = fileBuffer.slice(start, end);

    const bot = getNextBot();
    const channel = getNextChannel();

    // Send chunk as document to Telegram channel
    const formData = new FormData();
    const blob = new Blob([chunkBuffer]);
    formData.append('chat_id', channel);
    formData.append('document', blob, `${fileId}_chunk_${i}.dat`);
    formData.append('caption', JSON.stringify({
      fileId,
      chunkIndex: i,
      totalChunks,
      fileName,
      mimeType,
      fileSize
    }));

    const response = await axios.post(
      `https://api.telegram.org/bot${bot.token}/sendDocument`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      }
    );

    if (!response.data.ok) {
      throw new Error(`Failed to upload chunk ${i}: ${response.data.description}`);
    }

    chunks.push({
      messageId: response.data.result.message_id,
      channelId: channel,
      botId: bot.id,
      chunkIndex: i
    });

    console.log(`Uploaded chunk ${i + 1}/${totalChunks} to channel ${channel}`);
  }

  return {
    fileId,
    fileName,
    fileSize,
    mimeType,
    chunks,
    uploadedAt: new Date()
  };
}

/**
 * Download file from Telegram channels
 */
export async function downloadFileFromTelegram(
  fileData: UploadedFile
): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for (const chunk of fileData.chunks) {
    const bot = BOTS.find(b => b.id === chunk.botId) || BOTS[0];
    
    // Get file from Telegram
    const response = await axios.get(
      `https://api.telegram.org/bot${bot.token}/getFile`,
      {
        params: { file_id: chunk.messageId.toString() },
        timeout: 30000
      }
    );

    if (!response.data.ok) {
      throw new Error(`Failed to get file info for chunk ${chunk.chunkIndex}`);
    }

    const filePath = response.data.result.file_path;
    const fileResponse = await axios.get(
      `https://api.telegram.org/file/bot${bot.token}/${filePath}`,
      { responseType: 'arraybuffer', timeout: 60000 }
    );

    chunks.push(Buffer.from(fileResponse.data));
  }

  return Buffer.concat(chunks);
}

/**
 * Get file URL for direct access (if possible)
 */
export async function getFileUrl(fileData: UploadedFile): Promise<string[]> {
  const urls: string[] = [];

  for (const chunk of fileData.chunks) {
    const bot = BOTS.find(b => b.id === chunk.botId) || BOTS[0];
    
    const response = await axios.get(
      `https://api.telegram.org/bot${bot.token}/getFile`,
      {
        params: { file_id: chunk.messageId.toString() },
        timeout: 30000
      }
    );

    if (response.data.ok && response.data.result.file_path) {
      urls.push(
        `https://api.telegram.org/file/bot${bot.token}/${response.data.result.file_path}`
      );
    }
  }

  return urls;
}

/**
 * Delete file from Telegram channels
 */
export async function deleteFileFromTelegram(fileData: UploadedFile): Promise<void> {
  for (const chunk of fileData.chunks) {
    const bot = BOTS.find(b => b.id === chunk.botId) || BOTS[0];
    
    try {
      await axios.post(
        `https://api.telegram.org/bot${bot.token}/deleteMessage`,
        {
          chat_id: chunk.channelId,
          message_id: chunk.messageId
        },
        { timeout: 10000 }
      );
    } catch (e) {
      console.error(`Failed to delete chunk ${chunk.chunkIndex}:`, e);
    }
  }
}

/**
 * Check if bot is working
 */
export async function checkBot(botToken: string): Promise<{ ok: boolean; username?: string; error?: string }> {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${botToken}/getMe`,
      { timeout: 10000 }
    );
    
    if (response.data.ok) {
      return { ok: true, username: response.data.result.username };
    }
    return { ok: false, error: response.data.description };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/**
 * Check if channel is accessible
 */
export async function checkChannel(botToken: string, channelId: string): Promise<{ ok: boolean; title?: string; members?: number; error?: string }> {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${botToken}/getChat`,
      {
        params: { chat_id: channelId },
        timeout: 10000
      }
    );
    
    if (response.data.ok) {
      return {
        ok: true,
        title: response.data.result.title,
        members: response.data.result.members_count
      };
    }
    return { ok: false, error: response.data.description };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
