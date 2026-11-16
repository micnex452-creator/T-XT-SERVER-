import React, { useEffect, useState } from 'react';
import { Folder, FolderPlus, MoveRight, Pencil, Trash2, X } from 'lucide-react';
import type { FolderItem } from '../types';

interface CreateFolderModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Lütfen bir klasör adı yazın.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onCreate(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klasör oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl"
      >
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Yeni Klasör Oluştur</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          <label htmlFor="new-folder-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            Klasör Adı
          </label>
          <input
            id="new-folder-name"
            type="text"
            autoFocus
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Proje Yedekleri"
            className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Oluşturuluyor...' : 'Oluştur'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface RenameModalProps {
  open: boolean;
  initialName: string;
  itemType: 'file' | 'folder';
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  open,
  initialName,
  itemType,
  onClose,
  onRename,
}) => {
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(null);
      setLoading(false);
    }
  }, [open, initialName]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Ad alanı boş bırakılamaz.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onRename(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yeniden adlandırma başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl"
      >
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Pencil className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {itemType === 'folder' ? 'Klasörü Yeniden Adlandır' : 'Dosyayı Yeniden Adlandır'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          <label htmlFor="rename-input" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            Yeni Ad
          </label>
          <input
            id="rename-input"
            type="text"
            autoFocus
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface MoveModalProps {
  open: boolean;
  itemName: string;
  itemType: 'file' | 'folder';
  itemId: string;
  currentParentId: string | null;
  allFolders: FolderItem[];
  onClose: () => void;
  onMove: (targetFolderId: string | null) => Promise<void>;
}

export const MoveModal: React.FC<MoveModalProps> = ({
  open,
  itemName,
  itemType,
  itemId,
  currentParentId,
  allFolders,
  onClose,
  onMove,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(currentParentId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedId(currentParentId);
      setError(null);
      setLoading(false);
    }
  }, [open, currentParentId]);

  if (!open) return null;

  const isInvalidTarget = (candidateId: string) => {
    if (itemType !== 'folder') return false;
    if (candidateId === itemId) return true;
    const map = new Map(allFolders.map((f) => [f.id, f]));
    let cur: string | null = candidateId;
    const seen = new Set<string>();
    while (cur) {
      if (cur === itemId) return true;
      if (seen.has(cur)) break;
      seen.add(cur);
      cur = map.get(cur)?.parentId ?? null;
    }
    return false;
  };

  const validFolders = allFolders.filter((f) => !isInvalidTarget(f.id));

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onMove(selectedId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Taşıma işlemi başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl"
      >
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <MoveRight className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
              Taşı: {itemName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Hedef klasörü seçin:</p>

        <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className={`w-full min-h-[44px] px-3.5 py-2.5 flex items-center gap-3 text-left text-sm transition-colors ${
              selectedId === null
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Folder className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>Ana Dizin</span>
          </button>

          {validFolders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => setSelectedId(folder.id)}
              className={`w-full min-h-[44px] px-3.5 py-2.5 flex items-center gap-3 text-left text-sm transition-colors ${
                selectedId === folder.id
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Folder className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="truncate">{folder.name}</span>
            </button>
          ))}
        </div>

        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={loading || selectedId === currentParentId}
            onClick={handleConfirm}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Taşınıyor...' : 'Buraya Taşı'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  open,
  title,
  description,
  onClose,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setLoading(false);
  }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl"
      >
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
        <div className="flex items-center gap-2.5">
          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        </div>

        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Siliniyor...' : 'Kalıcı Olarak Sil'}
          </button>
        </div>
      </div>
    </div>
  );
};
