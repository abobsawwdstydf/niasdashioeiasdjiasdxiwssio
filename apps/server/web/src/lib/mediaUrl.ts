/**
 * Convert Telegram file URL to downloadable URL
 * tg://fileId -> /api/files/fileId/download
 */
export function getMediaUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('tg://')) {
    const fileId = url.replace('tg://', '');
    return `/api/files/${fileId}/download`;
  }
  return url;
}
