import { PrismaClient } from '@prisma/client';
import { encryptText, decryptText, isEncryptionEnabled } from './encrypt';

const prisma = new PrismaClient({
  log: [], // No logging for performance
});
