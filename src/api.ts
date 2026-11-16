import type {
  FileItem,
  FolderItem,
  ItemsResponse,
  SortField,
  SortOrder,
  StorageSummary,
  WorkspaceView,
} from './types';

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Sunucu isteği başarısız oldu.';
    throw new Error(message);
  }
  return data as T;
}

export async function fetchItems(params: {
  folderId: string | null;
  view: WorkspaceView;
  search: string;
  sort: SortField;
  order: SortOrder;
}): Promise<ItemsResponse> {
  const query = new URLSearchParams();
  if (params.folderId) query.set('folderId', params.folderId);
  query.set('view', params.view);
  if (params.search.trim()) query.set('search', params.search.trim());
  query.set('sort', params.sort);
  query.set('order', params.order);

  const res = await fetch(`/api/items?${query.toString()}`);
  return parseJsonOrThrow<ItemsResponse>(res);
}

export async function fetchStorageSummary(): Promise<StorageSummary> {
  const res = await fetch('/api/storage/summary');
  return parseJsonOrThrow<StorageSummary>(res);
}

export async function createFolder(name: string, parentId: string | null): Promise<FolderItem> {
  const res = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId }),
  });
  return parseJsonOrThrow<FolderItem>(res);
}

export async function updateFolder(
  id: string,
  patch: { name?: string; parentId?: string | null; starred?: boolean }
): Promise<FolderItem> {
  const res = await fetch(`/api/folders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseJsonOrThrow<FolderItem>(res);
}

export async function deleteFolder(id: string): Promise<void> {
  const res = await fetch(`/api/folders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await parseJsonOrThrow(res);
}

export async function updateFile(
  id: string,
  patch: { name?: string; folderId?: string | null; starred?: boolean }
): Promise<FileItem> {
  const res = await fetch(`/api/files/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseJsonOrThrow<FileItem>(res);
}

export async function deleteFile(id: string): Promise<void> {
  const res = await fetch(`/api/files/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await parseJsonOrThrow(res);
}

export async function bulkDeleteItems(fileIds: string[], folderIds: string[]): Promise<void> {
  const res = await fetch('/api/items/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds, folderIds }),
  });
  await parseJsonOrThrow(res);
}

export function uploadFiles(
  files: File[],
  folderId: string | null,
  onProgress: (loaded: number, total: number) => void
): Promise<{ files: FileItem[] }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    if (folderId) {
      formData.append('folderId', folderId);
    }
    for (const file of files) {
      formData.append('files', file);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files/upload');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed as { files: FileItem[] });
        } else {
          reject(new Error(parsed?.error || 'Dosya yükleme başarısız oldu.'));
        }
      } catch {
        reject(new Error('Sunucu yanıtı çözümlenemedi.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Ağ bağlantısı nedeniyle yükleme tamamlanamadı.'));
    };

    xhr.send(formData);
  });
}

export function getDownloadUrl(fileId: string): string {
  return `/api/files/${encodeURIComponent(fileId)}/download`;
}

export function getPreviewUrl(fileId: string): string {
  return `/api/files/${encodeURIComponent(fileId)}/preview`;
}
