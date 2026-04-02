// Telegram Bot API configuration
export const TELEGRAM_BOTS = [
  { id: 1, name: 'qwdjawdHU8QWEGY8QR_BOT', token: '8674460757:AAFm7WVkDx4ISkx22toTQyrQUeGQfLdF8QM' },
  { id: 2, name: 'wervsdfsdf_bot', token: '8733182475:AAFBitv4g4LVRuvGnssyqHQpttBydeAda9Y' },
  { id: 3, name: 'wervsdfsdfewrvs_bot', token: '8774720953:AAGvExABKj4Z-DYfKdqF-OMEdoeySeOeOoY' },
  { id: 4, name: 'wrvswadawdu8byusefyhu8sef_bot', token: '8141008503:AAEaCM1RrN2ppbZmUzhpW4EeLUgT1qQ2QS0' },
  { id: 5, name: 'dhdbshiww8ushxbxvxhusbot', token: '8687986079:AAGPYjnq4gdXCkf2wT81f0l2tQalKCIIyds' },
  { id: 6, name: 'wervsdfsdfewrvswadawd_bot', token: '8758985233:AAF7QfRApnccaByBYa1qjGs7u-erQ47OZcQ' },
  { id: 7, name: 'fwehfs8ug8s7g87t8f639t_bot', token: '8554202189:AAGN0wLfcgkqK3KJ9XOJFl40rp2kjkIcm1Y' },
  { id: 8, name: 'Nsjsjsjns8s8euhshxubot', token: '8748554768:AAEnJcHklmilbjih9glo3GITnQXSx4YmM_8' },
  { id: 9, name: 'asduhawiduhauwidybot', token: '8744960493:AAHB5bn3VxlZWKJjCr70yLYJnVTyXp2zHIs' },
  { id: 10, name: 'Dnnsiskehfu38bot', token: '8734408678:AAH7eTD97tepfwqdYKieNOoxsGZaEdPYWhI' },
  { id: 11, name: 'Bdjsuw8hdburbot', token: '8141208214:AAFOOel84oRN3Uj8rEOWI_6H3LaAaZ76Q0' },
  { id: 12, name: 'werawewerreebot', token: '8758209438:AAEnaXcJ7ke88fjjHNPwQVTt_u9LYrSzPFk' },
  { id: 13, name: 'Dygdgdu7ebot', token: '8680953724:AAFbz6yKdLC0ANkwTbLsZ0GSN78zVbTWUb8' },
  { id: 14, name: 'Sjeu7eufhdbot', token: '8743205528:AAF2V2Z8UU5A3aJiSd5JveswVen_immyp9E' },
];

// Telegram Channels for storage
export const TELEGRAM_CHANNELS = [
  { id: 1, chatId: '-1003850596987', name: 'Storage 1' },
  { id: 2, chatId: '-1003878106202', name: 'Storage 2' },
  { id: 3, chatId: '-1003868880877', name: 'Storage 3' },
  { id: 4, chatId: '-1003738083520', name: 'Storage 4' },
];

// Redis instances for caching
export const REDIS_INSTANCES = [
  { id: 1, url: 'redis://default:YmDlMjlsmXYjoFH13l0SWHPf0C23tXau@redis-18158.c14.us-east-1-2.ec2.cloud.redislabs.com:18158' },
  { id: 2, url: 'redis://default:x69uHtIDnVVRf371e3HYOb4BZNfBjNHS@redis-13102.c17.us-east-1-4.ec2.cloud.redislabs.com:13102' },
  { id: 3, url: 'redis://default:MGch5HFdB5uSNjyqgLQs20qyg02CmJMx@redis-10339.c11.us-east-1-3.ec2.cloud.redislabs.com:10339' },
  { id: 4, url: 'redis://default:XD4qOpGD62LlT6xtCjB7DJyJzZuuBLVq@redis-17550.c266.us-east-1-3.ec2.cloud.redislabs.com:17550' },
];

// File chunking configuration
export const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB per chunk

// Encryption levels
export const ENCRYPTION_LEVELS = {
  NONE: 0,
  BASIC: 1,    // AES-128
  STANDARD: 2, // AES-256
  MAX: 3,      // AES-256 + ChaCha20
};
