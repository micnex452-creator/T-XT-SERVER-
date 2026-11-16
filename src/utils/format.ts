import type { FileCategory } from '../types';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? value.toFixed(i === 0 ? 0 : 1) : value.toFixed(2)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx <= 0 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toUpperCase().slice(0, 6);
}

export function getCategoryLabel(category: FileCategory): string {
  switch (category) {
    case 'images':
      return 'Görsel';
    case 'documents':
      return 'Belge';
    case 'media':
      return 'Medya';
    case 'archives':
      return 'Arşiv';
    default:
      return 'Dosya';
  }
}

export function isTextPreviewable(mimeType: string, filename: string): boolean {
  const mime = mimeType.toLowerCase();
  const lower = filename.toLowerCase();
  if (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('javascript')) {
    return true;
  }
  return /\.(txt|md|csv|json|xml|yaml|yml|log|ts|tsx|js|jsx|html|css|py|java|kt|sql|sh|env)$/.test(lower);
}
