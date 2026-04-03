import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { encryptText, decryptText, isEncryptionEnabled } from './encrypt';

// Create Prisma client with encryption extension
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseUrl
    }
  },
  log: [], // No logging for performance
}).$extends({
  query: {
    message: {
      async create({ args, query }: any) {
        if (args.data.content && typeof args.data.content === 'string') {
          args.data.content = encryptText(args.data.content);
        }
        if (args.data.quote && typeof args.data.quote === 'string') {
          args.data.quote = encryptText(args.data.quote);
        }
        const result = await query(args);
        decryptMessageFields(result);
        return result;
      },
      async update({ args, query }: any) {
        if (args.data.content && typeof args.data.content === 'string') {
          args.data.content = encryptText(args.data.content);
        }
        if (args.data.quote && typeof args.data.quote === 'string') {
          args.data.quote = encryptText(args.data.quote);
        }
        const result = await query(args);
        decryptMessageFields(result);
        return result;
      },
      async findMany({ args, query }: any) {
        const results = await query(args);
        for (const item of results) {
          decryptMessageFields(item);
        }
        return results;
      },
      async findFirst({ args, query }: any) {
        const result = await query(args);
        if (result) decryptMessageFields(result);
        return result;
      },
      async findUnique({ args, query }: any) {
        const result = await query(args);
        if (result) decryptMessageFields(result);
        return result;
      },
    },
    chat: {
      async findMany({ args, query }: any) {
        const results = await query(args);
        for (const chat of results) {
          decryptChatMessages(chat);
        }
        return results;
      },
      async findFirst({ args, query }: any) {
        const result = await query(args);
        if (result) decryptChatMessages(result);
        return result;
      },
      async findUnique({ args, query }: any) {
        const result = await query(args);
        if (result) decryptChatMessages(result);
        return result;
      },
    },
    pinnedMessage: {
      async findMany({ args, query }: any) {
        const results = await query(args);
        for (const item of results) {
          if (item && item.message) {
            decryptMessageFields(item.message);
          }
        }
        return results;
      },
      async findFirst({ args, query }: any) {
        const result = await query(args);
        if (result && result.message) {
          decryptMessageFields(result.message);
        }
        return result;
      },
    },
  },
});

/** Decrypt content/quote on a message-shaped object. */
function decryptMessageFields(obj: any): void {
  if (!obj || typeof obj !== 'object' || !isEncryptionEnabled()) return;
  if (typeof obj.content === 'string') obj.content = decryptText(obj.content);
  if (typeof obj.quote === 'string') obj.quote = decryptText(obj.quote);
  if (obj.replyTo && typeof obj.replyTo === 'object') {
    decryptMessageFields(obj.replyTo);
  }
}

/** Decrypt messages nested inside a chat object. */
function decryptChatMessages(chat: any): void {
  if (!chat || !isEncryptionEnabled()) return;
  if (Array.isArray(chat.messages)) {
    for (const msg of chat.messages) decryptMessageFields(msg);
  }
  if (Array.isArray(chat.pinnedMessages)) {
    for (const pm of chat.pinnedMessages) {
      if (pm && pm.message) {
        decryptMessageFields(pm.message);
      }
    }
  }
}
