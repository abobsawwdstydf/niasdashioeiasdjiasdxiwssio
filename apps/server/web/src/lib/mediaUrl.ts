import { API_URL } from '../config';

/**
 * Нормализует медиа URL.
 * Если URL относительный (начинается с /) — добавляет API_URL.
 * Если уже полный (http/https) или data URI — возвращает как есть.
 */
export function normalizeMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  // Относительный путь — добавляем API_URL
  const base = API_URL.replace(/\/$/, ''); // убираем trailing slash
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}
