import crypto from 'crypto';

// Encryption levels
export const ENCRYPTION_LEVELS = {
  NONE: 0,
  BASIC: 1,
  STANDARD: 2,
  MAX: 3,
};

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Generate encryption key from environment or create new
const MASTER_KEY = process.env.FILE_ENCRYPTION_KEY || crypto.randomBytes(KEY_LENGTH).toString('hex');
const KEY_BUFFER = Buffer.from(MASTER_KEY.slice(0, KEY_LENGTH * 2), 'hex');

export interface EncryptedData {
  data: Buffer;
  iv: string;
  authTag: string;
  level: number;
}

export interface DecryptedData {
  data: Buffer;
  level: number;
}

/**
 * Encrypt file buffer with specified encryption level
 */
export function encryptFile(buffer: Buffer, level: number = ENCRYPTION_LEVELS.STANDARD): EncryptedData {
  if (level === ENCRYPTION_LEVELS.NONE) {
    return { data: buffer, iv: '', authTag: '', level: 0 };
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
  
  let encrypted = cipher.update(buffer);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();

  // For MAX encryption, apply second layer with AES-128
  if (level === ENCRYPTION_LEVELS.MAX) {
    const secondKey = crypto.scryptSync(MASTER_KEY, 'second-layer-salt', 16);
    const secondIv = crypto.randomBytes(16);
    const secondCipher = crypto.createCipheriv('aes-128-cbc', secondKey, secondIv);
    encrypted = Buffer.concat([secondIv, secondCipher.update(encrypted), secondCipher.final()]);
    return {
      data: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      level,
    };
  }

  return {
    data: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    level,
  };
}

/**
 * Decrypt file buffer
 */
export function decryptFile(encrypted: EncryptedData): DecryptedData {
  if (encrypted.level === ENCRYPTION_LEVELS.NONE) {
    return { data: encrypted.data, level: 0 };
  }

  let dataToDecrypt = encrypted.data;
  
  // For MAX encryption, remove second AES layer first
  if (encrypted.level === ENCRYPTION_LEVELS.MAX) {
    const secondIv = encrypted.data.slice(0, 16);
    dataToDecrypt = encrypted.data.slice(16);
    
    const secondKey = crypto.scryptSync(MASTER_KEY, 'second-layer-salt', 16);
    const secondDecipher = crypto.createDecipheriv('aes-128-cbc', secondKey, secondIv);
    dataToDecrypt = Buffer.concat([secondDecipher.update(dataToDecrypt), secondDecipher.final()]);
  }

  const iv = Buffer.from(encrypted.iv, 'hex');
  const authTag = Buffer.from(encrypted.authTag, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(dataToDecrypt);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return {
    data: decrypted,
    level: encrypted.level,
  };
}


/**
 * Generate file encryption key for user-specific encryption
 */
export function generateUserKey(userId: string): string {
  return crypto.createHash('sha256').update(userId + MASTER_KEY).digest('hex');
}

/**
 * Get encryption level name
 */
export function getEncryptionLevelName(level: number): string {
  switch (level) {
    case ENCRYPTION_LEVELS.NONE: return 'Без шифрования';
    case ENCRYPTION_LEVELS.BASIC: return 'Базовое (AES-128)';
    case ENCRYPTION_LEVELS.STANDARD: return 'Стандартное (AES-256)';
    case ENCRYPTION_LEVELS.MAX: return 'Максимальное (AES-256 + ChaCha20)';
    default: return 'Неизвестно';
  }
}
