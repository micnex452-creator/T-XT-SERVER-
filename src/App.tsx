import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckSquare,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Folder,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  LayoutList,
  Moon,
  MoreVertical,
  MoveRight,
  Pencil,
  Plus,
  Search,
  Square,
  Star,
  Sun,
  Trash2,
  Upload,
  X,
  FileText,
} from 'lucide-react';
import {
  bulkDeleteItems,
  createFolder,
  deleteFile,
  deleteFolder,
  fetchItems,
  fetchStorageSummary,
  getDownloadUrl,
  updateFile,
  updateFolder,
  uploadFiles,
} from './api';
import {
  CreateFolderModal,
  DeleteConfirmModal,
  MoveModal,
  RenameModal,
} from './components/ActionModals';
import { FileIcon } from './components/FileIcon';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PreviewModal } from './components/PreviewModal';
import { StorageMobileView, StorageSidebarMeter } from './components/StoragePanel';
import type {
  BreadcrumbItem,
  FileItem,
  FolderItem,
  SortField,
  SortOrder,
  StorageSummary,
  ViewMode,
  WorkspaceView,
} from './types';
import { formatBytes, formatDate, getCategoryLabel, getFileExtension } from './utils/format';

type ActiveActionSheet =
  | { type: 'folder'; item: FolderItem }
  | { type: 'file'; item: FileItem }
  | null;

type RenameTarget =
  | { type: 'folder'; id: string; name: string }
  | { type: 'file'; id: string; name: string }
  | null;

type MoveTarget =
  | { type: 'folder'; id: string; name: string; parentId: string | null }
  | { type: 'file'; id: string; name: string; parentId: string | null }
  | null;

type DeleteTarget =
  | { type: 'folder'; id: string; name: string }
  | { type: 'file'; id: string; name: string }
  | { type: 'bulk'; fileIds: string[]; folderIds: string[] }
  | null;

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('t2xt-theme') === 'dark';
  });

  const [view, setView] = useState<WorkspaceView>('all');
  const [mobileTab, setMobileTab] = useState<'files' | 'starred' | 'recent' | 'storage'>('files');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [sort, setSort] = useState<SortField>('date');
  const [order, setOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'Ana Dizin' }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [summary, setSummary] = useState<StorageSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Selection
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Upload progress & drag/drop
  const [uploading, setUploading] = useState<{
    active: boolean;
    count: number;
    loaded: number;
    total: number;
  }>({ active: false, count: 0, loaded: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Modals & sheets
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [mobileCreateSheetOpen, setMobileCreateSheetOpen] = useState(false);
  const [actionSheet, setActionSheet] = useState<ActiveActionSheet>(null);
  const [desktopMenuId, setDesktopMenuId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('t2xt-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('t2xt-theme', 'light');
    }
  }, [darkMode]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((prev) => (prev === message ? null : prev));
    }, 3200);
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, summaryRes] = await Promise.all([
        fetchItems({ folderId: currentFolderId, view, search, sort, order }),
        fetchStorageSummary(),
      ]);
      setBreadcrumbs(itemsRes.breadcrumbs);
      setFolders(itemsRes.folders);
      setFiles(itemsRes.files);
      setAllFolders(itemsRes.allFolders);
      setSummary(summaryRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veriler sunucudan alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, view, search, sort, order]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWorkspace();
    }, search ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace, search]);

  useEffect(() => {
    setSelectedFolderIds(new Set());
    setSelectedFileIds(new Set());
    setDesktopMenuId(null);
  }, [currentFolderId, view]);

  useEffect(() => {
    const closeMenus = () => setDesktopMenuId(null);
    window.addEventListener('click', closeMenus);
    return () => window.removeEventListener('click', closeMenus);
  }, []);

  const handleUploadList = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;

    const targetFolderId = view === 'all' ? currentFolderId : null;
    const totalBytes = arr.reduce((acc, f) => acc + f.size, 0);
    setUploading({ active: true, count: arr.length, loaded: 0, total: totalBytes });

    try {
      await uploadFiles(arr, targetFolderId, (loaded, total) => {
        setUploading({ active: true, count: arr.length, loaded, total });
      });
      showToast(arr.length === 1 ? `"${arr[0].name}" yüklendi.` : `${arr.length} dosya yüklendi.`);
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Dosya yükleme başarısız oldu.');
    } finally {
      setUploading({ active: false, count: 0, loaded: 0, total: 0 });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      dragDepthRef.current += 1;
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleUploadList(e.dataTransfer.files);
    }
  };

  const openFolder = (folderId: string | null) => {
    setView('all');
    setMobileTab('files');
    setSearch('');
    setCurrentFolderId(folderId);
  };

  const handleSwitchView = (nextView: WorkspaceView) => {
    setView(nextView);
    if (nextView === 'starred') setMobileTab('starred');
    else if (nextView === 'recent') setMobileTab('recent');
    else setMobileTab('files');

    if (nextView !== 'all') {
      setCurrentFolderId(null);
    }
  };

  const handleSortClick = (field: SortField) => {
    if (sort === field) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(field);
      setOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  const toggleFolderSelection = (id: string) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFileSelection = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalSelected = selectedFolderIds.size + selectedFileIds.size;
  const allSelected =
    folders.length + files.length > 0 &&
    selectedFolderIds.size === folders.length &&
    selectedFileIds.size === files.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedFolderIds(new Set());
      setSelectedFileIds(new Set());
    } else {
      setSelectedFolderIds(new Set(folders.map((f) => f.id)));
      setSelectedFileIds(new Set(files.map((f) => f.id)));
    }
  };

  const handleToggleStarFolder = async (folder: FolderItem) => {
    try {
      await updateFolder(folder.id, { starred: !folder.starred });
      await loadWorkspace();
      showToast(folder.starred ? 'Yıldız kaldırıldı.' : 'Yıldızlılara eklendi.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'İşlem başarısız oldu.');
    }
  };

  const handleToggleStarFile = async (file: FileItem) => {
    try {
      await updateFile(file.id, { starred: !file.starred });
      await loadWorkspace();
      showToast(file.starred ? 'Yıldız kaldırıldı.' : 'Yıldızlılara eklendi.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'İşlem başarısız oldu.');
    }
  };

  const triggerDownload = (file: FileItem) => {
    const link = document.createElement('a');
    link.href = getDownloadUrl(file.id);
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const viewTitleMap: Record<WorkspaceView, string> = {
    all: breadcrumbs[breadcrumbs.length - 1]?.name ?? 'Ana Dizin',
    starred: 'Yıldızlı Öğeler',
    recent: 'Son Yüklenenler',
    images: 'Görseller ve Medya',
    documents: 'Belgeler',
  };

  const currentPageTitle =
    mobileTab === 'storage' ? 'Depolama' : search.trim() ? `"${search.trim()}" sonuçları` : viewTitleMap[view];

  const parentBreadcrumb = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;

  const navItems: Array<{ id: WorkspaceView; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'Tüm Dosyalar', icon: <Folder className="w-4 h-4 shrink-0" /> },
    { id: 'recent', label: 'Son Yüklenenler', icon: <Clock className="w-4 h-4 shrink-0" /> },
    { id: 'starred', label: 'Yıldızlılar', icon: <Star className="w-4 h-4 shrink-0" /> },
    { id: 'images', label: 'Görsel ve Medya', icon: <ImageIcon className="w-4 h-4 shrink-0" /> },
    { id: 'documents', label: 'Belgeler', icon: <FileText className="w-4 h-4 shrink-0" /> },
  ];

  const uploadPercent =
    uploading.total > 0 ? Math.min(100, Math.round((uploading.loaded / uploading.total) * 100)) : 0;

  return (
    <div
      className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden multi-file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            void handleUploadList(e.target.files);
          }
        }}
      />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-[260px] lg:shrink-0 lg:flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => openFolder(null)}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            T2XT SERVER
          </button>
        </div>

        <div className="p-4 space-y-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Dosya Yükle</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateFolderOpen(true)}
            className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4 shrink-0" />
            <span>Yeni Klasör</span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto" aria-label="Ana menü">
          {navItems.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSwitchView(item.id)}
                className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <StorageSidebarMeter summary={summary} />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top App Bar (48px height, well within 15% sticky cap) */}
        <header className="lg:hidden sticky top-0 z-30 h-12 px-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            {parentBreadcrumb && mobileTab === 'files' && !search ? (
              <button
                type="button"
                onClick={() => openFolder(parentBreadcrumb.id)}
                aria-label="Üst klasöre dön"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 active:bg-slate-100 dark:active:bg-slate-800"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : null}
            <span className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 truncate pl-1">
              {currentPageTitle === 'Ana Dizin' ? 'T2XT SERVER' : currentPageTitle}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label="Ara"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === 'list' ? 'grid' : 'list'))}
              aria-label="Görünümü değiştir"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300"
            >
              {viewMode === 'list' ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label="Temayı değiştir"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Mobile expandable search row */}
        {mobileSearchOpen && (
          <div className="lg:hidden px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Dosya veya klasör ara..."
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Desktop Top Header (3-zone contract) */}
        <header className="hidden lg:flex h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 items-center justify-between gap-8 sticky top-0 z-30">
          {/* Zone 1: Breadcrumbs */}
          <nav aria-label="Klasör yolu" className="flex items-center gap-1.5 min-w-0 text-sm">
            {view === 'all' && !search ? (
              breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.id ?? 'root'}>
                    {idx > 0 && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                    <button
                      type="button"
                      onClick={() => openFolder(crumb.id)}
                      className={`px-2 py-1 rounded-lg truncate max-w-[200px] whitespace-nowrap transition-colors ${
                        isLast
                          ? 'font-semibold text-slate-900 dark:text-slate-100'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                );
              })
            ) : (
              <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                {currentPageTitle}
              </span>
            )}
          </nav>

          {/* Zone 2: Search input */}
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tüm dosya ve klasörlerde ara..."
              className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Aramayı temizle"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Zone 3: View + Theme + Primary CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="Liste görünümü"
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Izgara görünümü"
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label="Açık/Koyu tema"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          {mobileTab === 'storage' ? (
            <div className="lg:hidden">
              <StorageMobileView summary={summary} />
            </div>
          ) : (
            <>
              {/* Upload progress bar */}
              {uploading.active && (
                <div className="mb-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
                    <span className="text-slate-800 dark:text-slate-200">
                      {uploading.count} dosya yükleniyor...
                    </span>
                    <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400">
                      {uploadPercent}% · {formatBytes(uploading.loaded)} / {formatBytes(uploading.total)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-150"
                      style={{ width: `${uploadPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Bulk selection action bar */}
              {totalSelected > 0 && (
                <div className="mb-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFolderIds(new Set());
                        setSelectedFileIds(new Set());
                      }}
                      className="min-h-[36px] px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <span>{totalSelected} öğe seçildi</span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({
                        type: 'bulk',
                        fileIds: Array.from(selectedFileIds),
                        folderIds: Array.from(selectedFolderIds),
                      })
                    }
                    className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs sm:text-sm font-medium hover:bg-red-700 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Seçilenleri Sil</span>
                  </button>
                </div>
              )}

              {/* Mobile Breadcrumb strip */}
              {view === 'all' && !search && breadcrumbs.length > 1 && (
                <div className="lg:hidden mb-3 flex items-center gap-1 overflow-x-auto text-xs text-slate-500 dark:text-slate-400 pb-1">
                  {breadcrumbs.map((crumb, idx) => (
                    <React.Fragment key={crumb.id ?? 'mroot'}>
                      {idx > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                      <button
                        type="button"
                        onClick={() => openFolder(crumb.id)}
                        className={`px-2 py-1 rounded-md whitespace-nowrap ${
                          idx === breadcrumbs.length - 1
                            ? 'font-semibold text-slate-900 dark:text-slate-100'
                            : 'hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* Workspace Header Row (summary + sort controls) */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                  {folders.length} klasör · {files.length} dosya
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSortClick('name')}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                      sort === 'name'
                        ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>Ad</span>
                    {sort === 'name' && (order === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSortClick('date')}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                      sort === 'date'
                        ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>Tarih</span>
                    {sort === 'date' && (order === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSortClick('size')}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                      sort === 'size'
                        ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>Boyut</span>
                    {sort === 'size' && (order === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </button>
                </div>
              </div>

              {/* Error State */}
              {error && (
                <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 flex items-center justify-between gap-4">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  <button
                    type="button"
                    onClick={() => void loadWorkspace()}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium whitespace-nowrap"
                  >
                    Yeniden Dene
                  </button>
                </div>
              )}

              {/* Loading Skeleton */}
              {loading ? (
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="px-4 py-3.5 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-48 rounded bg-slate-200 dark:bg-slate-800" />
                        <div className="h-2.5 w-28 rounded bg-slate-100 dark:bg-slate-800/70" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : folders.length === 0 && files.length === 0 ? (
                /* Empty State */
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 p-10 sm:p-14 text-center">
                  <Upload className="w-10 h-10 mx-auto text-slate-400" />
                  <h2 className="mt-4 text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {search ? 'Eşleşen öğe bulunamadı' : 'Bu klasör henüz boş'}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {search
                      ? 'Farklı bir anahtar kelime deneyin veya aramayı temizleyin.'
                      : 'Dosyalarınızı buraya sürükleyip bırakabilir veya aşağıdaki butonlardan yükleyebilirsiniz.'}
                  </p>
                  {!search && (
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        <span>İlk Dosyayı Yükle</span>
                      </button>
                      {view === 'all' && (
                        <button
                          type="button"
                          onClick={() => setCreateFolderOpen(true)}
                          className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                        >
                          <FolderPlus className="w-4 h-4" />
                          <span>Klasör Oluştur</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : viewMode === 'list' ? (
                /* List / Table View */
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-visible">
                  {/* Table Header (Desktop) */}
                  <div className="hidden md:grid md:grid-cols-[36px_minmax(0,1fr)_120px_110px_170px_104px] items-center gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      aria-label="Tümünü seç"
                      className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {allSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                    </button>
                    <span>Ad</span>
                    <span>Tür</span>
                    <span className="text-right">Boyut</span>
                    <span className="text-right">Güncelleme</span>
                    <span className="text-right">İşlem</span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Folders */}
                    {folders.map((folder) => {
                      const selected = selectedFolderIds.has(folder.id);
                      const menuOpen = desktopMenuId === `folder-${folder.id}`;
                      return (
                        <div
                          key={folder.id}
                          className={`group px-3 sm:px-4 py-2.5 md:grid md:grid-cols-[36px_minmax(0,1fr)_120px_110px_170px_104px] flex items-center justify-between gap-3 transition-colors ${
                            selected ? 'bg-blue-50/70 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleFolderSelection(folder.id)}
                            aria-label={`${folder.name} seç`}
                            className="hidden md:flex w-7 h-7 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            {selected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => openFolder(folder.id)}
                            className="flex-1 min-w-0 min-h-[44px] flex items-center gap-3 text-left"
                          >
                            <FileIcon isFolder className="w-5 h-5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {folder.name}
                                </span>
                                {folder.starred && (
                                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                )}
                              </div>
                              <p className="md:hidden text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                                Klasör · {folder.itemCount ?? 0} öğe · {formatDate(folder.updatedAt)}
                              </p>
                            </div>
                          </button>

                          <span className="hidden md:block text-xs text-slate-500 dark:text-slate-400">Klasör</span>
                          <span className="hidden md:block text-right font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {folder.itemCount ?? 0} öğe
                          </span>
                          <span className="hidden md:block text-right font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {formatDate(folder.updatedAt)}
                          </span>

                          <div className="flex items-center justify-end gap-1 shrink-0 relative">
                            <button
                              type="button"
                              onClick={() => void handleToggleStarFolder(folder)}
                              aria-label="Yıldızla"
                              className="hidden md:flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Star className={`w-4 h-4 ${folder.starred ? 'text-amber-500 fill-amber-500' : ''}`} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.innerWidth < 1024) {
                                  setActionSheet({ type: 'folder', item: folder });
                                } else {
                                  setDesktopMenuId(menuOpen ? null : `folder-${folder.id}`);
                                }
                              }}
                              aria-label="Klasör işlemleri"
                              className="min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {menuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-10 z-40 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg py-1.5 text-sm"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDesktopMenuId(null);
                                    setRenameTarget({ type: 'folder', id: folder.id, name: folder.name });
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  <Pencil className="w-4 h-4" />
                                  <span>Yeniden Adlandır</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDesktopMenuId(null);
                                    setMoveTarget({
                                      type: 'folder',
                                      id: folder.id,
                                      name: folder.name,
                                      parentId: folder.parentId,
                                    });
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  <MoveRight className="w-4 h-4" />
                                  <span>Taşı</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDesktopMenuId(null);
                                    setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name });
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>Sil</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Files */}
                    {files.map((file) => {
                      const selected = selectedFileIds.has(file.id);
                      const menuOpen = desktopMenuId === `file-${file.id}`;
                      const ext = getFileExtension(file.name);
                      return (
                        <div
                          key={file.id}
                          className={`group px-3 sm:px-4 py-2.5 md:grid md:grid-cols-[36px_minmax(0,1fr)_120px_110px_170px_104px] flex items-center justify-between gap-3 transition-colors ${
                            selected ? 'bg-blue-50/70 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleFileSelection(file.id)}
                            aria-label={`${file.name} seç`}
                            className="hidden md:flex w-7 h-7 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            {selected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => setPreviewFile(file)}
                            className="flex-1 min-w-0 min-h-[44px] flex items-center gap-3 text-left"
                          >
                            <FileIcon
                              category={file.category}
                              mimeType={file.mimeType}
                              name={file.name}
                              className="w-5 h-5 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {file.name}
                                </span>
                                {file.starred && (
                                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                )}
                              </div>
                              <p className="md:hidden text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                                {ext ? `${ext} · ` : ''}
                                {formatBytes(file.size)} · {formatDate(file.updatedAt)}
                              </p>
                            </div>
                          </button>

                          <span className="hidden md:block text-xs text-slate-500 dark:text-slate-400 truncate">
                            {ext ? `${ext} · ${getCategoryLabel(file.category)}` : getCategoryLabel(file.category)}
                          </span>
                          <span className="hidden md:block text-right font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {formatBytes(file.size)}
                          </span>
                          <span className="hidden md:block text-right font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {formatDate(file.updatedAt)}
                          </span>

                          <div className="flex items-center justify-end gap-1 shrink-0 relative">
                            <button
                              type="button"
                              onClick={() => triggerDownload(file)}
                              aria-label={`${file.name} indir`}
                              className="min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.innerWidth < 1024) {
                                  setActionSheet({ type: 'file', item: file });
                                } else {
                                  setDesktopMenuId(menuOpen ? null : `file-${file.id}`);
                                }
                              }}
                              aria-label="Dosya işlemleri"
                              className="min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {menuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-10 z-40 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg py-1.5 text-sm"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDesktopMenuId(null);
                                    setPreviewFile(file);
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span>Önizle</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDesktopMenuId(null);
                                    triggerDownload(file);
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  <Download className="w-4 h-4" />
                                  <span>İndir</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDesktopMenuId(null);
                                    void handleToggleStarFile(file);
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  <Star className={`w-4 h-4 ${file.starred ? 'text-amber-500 fill-amber-500' : ''}`} />
                                  <span>{file.starred ? 'Yıldızı Kaldır' : 'Yıldızla'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDesktopMenuId(null);
                                    setRenameTarget({ type: 'file', id: file.id, name: file.name });
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  <Pencil className="w-4 h-4" />
                                  <span>Yeniden Adlandır</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDesktopMenuId(null);
                                    setMoveTarget({
                                      type: 'file',
                                      id: file.id,
                                      name: file.name,
                                      parentId: file.folderId,
                                    });
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  <MoveRight className="w-4 h-4" />
                                  <span>Taşı</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDesktopMenuId(null);
                                    setDeleteTarget({ type: 'file', id: file.id, name: file.name });
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>Sil</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Grid View */
                <div className="space-y-6">
                  {folders.length > 0 && (
                    <section>
                      <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                        Klasörler
                      </h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {folders.map((folder) => (
                          <div
                            key={folder.id}
                            className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-2 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() => openFolder(folder.id)}
                              className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                            >
                              <FileIcon isFolder className="w-5 h-5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {folder.name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                  {folder.itemCount ?? 0} öğe
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActionSheet({ type: 'folder', item: folder })}
                              aria-label="Klasör işlemleri"
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {files.length > 0 && (
                    <section>
                      <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                        Dosyalar
                      </h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {files.map((file) => (
                          <div
                            key={file.id}
                            className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-3 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() => setPreviewFile(file)}
                              className="text-left space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <FileIcon
                                  category={file.category}
                                  mimeType={file.mimeType}
                                  name={file.name}
                                  className="w-7 h-7"
                                />
                                {file.starred && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {file.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                                  {formatBytes(file.size)} · {getCategoryLabel(file.category)}
                                </p>
                              </div>
                            </button>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => triggerDownload(file)}
                                className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 inline-flex items-center gap-1"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>İndir</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActionSheet({ type: 'file', item: file })}
                                aria-label="Dosya işlemleri"
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Floating Action Button (thumb zone above bottom nav) */}
      {mobileTab !== 'storage' && (
        <button
          type="button"
          onClick={() => setMobileCreateSheetOpen(true)}
          aria-label="Yeni dosya yükle veya klasör oluştur"
          className="lg:hidden fixed right-4 bottom-18 z-30 w-13 h-13 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Mobile Fixed Bottom Thumb Navigation Bar (56px height) */}
      <nav
        aria-label="Mobil alt menü"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe"
      >
        <div className="grid grid-cols-4 h-14 items-center">
          <button
            type="button"
            onClick={() => {
              setMobileTab('files');
              setView('all');
            }}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              mobileTab === 'files'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Folder className="w-5 h-5" />
            <span className="text-[10px] font-medium">Dosyalar</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchView('recent')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              mobileTab === 'recent'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] font-medium">Son</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchView('starred')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              mobileTab === 'starred'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Star className="w-5 h-5" />
            <span className="text-[10px] font-medium">Yıldızlı</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('storage')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              mobileTab === 'storage'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <HardDrive className="w-5 h-5" />
            <span className="text-[10px] font-medium">Depolama</span>
          </button>
        </div>
      </nav>

      {/* Drag and Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-blue-600/15 backdrop-blur-xs flex items-center justify-center p-6 pointer-events-none">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-blue-600 px-10 py-8 text-center shadow-2xl">
            <Upload className="w-10 h-10 mx-auto text-blue-600" />
            <p className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              Yüklemek için dosyaları bırakın
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {currentFolderId ? `Hedef: ${breadcrumbs[breadcrumbs.length - 1]?.name}` : 'Hedef: Ana Dizin'}
            </p>
          </div>
        </div>
      )}

      {/* Mobile Create Bottom Sheet */}
      {mobileCreateSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center"
          onClick={() => setMobileCreateSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-5 pb-8 space-y-2"
          >
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 px-2 pb-1">
              T2XT SERVER Ekle
            </h3>
            <button
              type="button"
              onClick={() => {
                setMobileCreateSheetOpen(false);
                fileInputRef.current?.click();
              }}
              className="w-full min-h-[52px] px-4 rounded-xl flex items-center gap-3.5 text-left text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Cihazdan Dosya Yükle</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileCreateSheetOpen(false);
                setCreateFolderOpen(true);
              }}
              className="w-full min-h-[52px] px-4 rounded-xl flex items-center gap-3.5 text-left text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <FolderPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Yeni Klasör Oluştur</span>
            </button>
          </div>
        </div>
      )}

      {/* Item Context Action Bottom Sheet */}
      {actionSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setActionSheet(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 pb-7 space-y-1.5"
          >
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center gap-3 px-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              {actionSheet.type === 'folder' ? (
                <FileIcon isFolder className="w-5 h-5 shrink-0" />
              ) : (
                <FileIcon
                  category={actionSheet.item.category}
                  mimeType={actionSheet.item.mimeType}
                  name={actionSheet.item.name}
                  className="w-5 h-5 shrink-0"
                />
              )}
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {actionSheet.item.name}
              </span>
            </div>

            {actionSheet.type === 'file' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const f = actionSheet.item;
                    setActionSheet(null);
                    setPreviewFile(f);
                  }}
                  className="w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Eye className="w-4 h-4" />
                  <span>Önizle</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const f = actionSheet.item;
                    setActionSheet(null);
                    triggerDownload(f);
                  }}
                  className="w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-4 h-4" />
                  <span>İndir</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                const current = actionSheet;
                setActionSheet(null);
                if (current.type === 'folder') {
                  void handleToggleStarFolder(current.item);
                } else {
                  void handleToggleStarFile(current.item);
                }
              }}
              className="w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Star className={`w-4 h-4 ${actionSheet.item.starred ? 'text-amber-500 fill-amber-500' : ''}`} />
              <span>{actionSheet.item.starred ? 'Yıldızı Kaldır' : 'Yıldızla'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const current = actionSheet;
                setActionSheet(null);
                setRenameTarget({
                  type: current.type,
                  id: current.item.id,
                  name: current.item.name,
                });
              }}
              className="w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Pencil className="w-4 h-4" />
              <span>Yeniden Adlandır</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const current = actionSheet;
                setActionSheet(null);
                setMoveTarget({
                  type: current.type,
                  id: current.item.id,
                  name: current.item.name,
                  parentId: current.type === 'folder' ? current.item.parentId : current.item.folderId,
                });
              }}
              className="w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <MoveRight className="w-4 h-4" />
              <span>Taşı</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const current = actionSheet;
                setActionSheet(null);
                setDeleteTarget({
                  type: current.type,
                  id: current.item.id,
                  name: current.item.name,
                });
              }}
              className="w-full min-h-[48px] px-3 rounded-xl flex items-center gap-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-4 h-4" />
              <span>Sil</span>
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateFolderModal
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        onCreate={async (name) => {
          await createFolder(name, view === 'all' ? currentFolderId : null);
          showToast(`"${name}" klasörü oluşturuldu.`);
          await loadWorkspace();
        }}
      />

      <RenameModal
        open={!!renameTarget}
        initialName={renameTarget?.name ?? ''}
        itemType={renameTarget?.type ?? 'file'}
        onClose={() => setRenameTarget(null)}
        onRename={async (newName) => {
          if (!renameTarget) return;
          if (renameTarget.type === 'folder') {
            await updateFolder(renameTarget.id, { name: newName });
          } else {
            await updateFile(renameTarget.id, { name: newName });
          }
          showToast('Ad güncellendi.');
          await loadWorkspace();
        }}
      />

      <MoveModal
        open={!!moveTarget}
        itemName={moveTarget?.name ?? ''}
        itemType={moveTarget?.type ?? 'file'}
        itemId={moveTarget?.id ?? ''}
        currentParentId={moveTarget?.parentId ?? null}
        allFolders={allFolders}
        onClose={() => setMoveTarget(null)}
        onMove={async (targetFolderId) => {
          if (!moveTarget) return;
          if (moveTarget.type === 'folder') {
            await updateFolder(moveTarget.id, { parentId: targetFolderId });
          } else {
            await updateFile(moveTarget.id, { folderId: targetFolderId });
          }
          showToast('Öğe taşındı.');
          await loadWorkspace();
        }}
      />

      <DeleteConfirmModal
        open={!!deleteTarget}
        title={
          deleteTarget?.type === 'bulk'
            ? 'Seçili Öğeleri Sil'
            : deleteTarget?.type === 'folder'
              ? 'Klasörü Sil'
              : 'Dosyayı Sil'
        }
        description={
          deleteTarget?.type === 'bulk'
            ? `Seçili ${deleteTarget.folderIds.length} klasör ve ${deleteTarget.fileIds.length} dosya kalıcı olarak silinecektir. Bu işlem geri alınamaz.`
            : deleteTarget?.type === 'folder'
              ? `"${deleteTarget.name}" klasörü ve içindeki tüm alt klasörler/dosyalar kalıcı olarak silinecektir.`
              : `"${deleteTarget?.name ?? ''}" dosyası sunucudan kalıcı olarak silinecektir.`
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'bulk') {
            await bulkDeleteItems(deleteTarget.fileIds, deleteTarget.folderIds);
            setSelectedFileIds(new Set());
            setSelectedFolderIds(new Set());
            showToast('Seçili öğeler silindi.');
          } else if (deleteTarget.type === 'folder') {
            await deleteFolder(deleteTarget.id);
            showToast('Klasör silindi.');
          } else {
            await deleteFile(deleteTarget.id);
            showToast('Dosya silindi.');
          }
          await loadWorkspace();
        }}
      />

      <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-5 right-4 z-50 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 text-xs sm:text-sm font-medium shadow-lg"
        >
          {toast}
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}
