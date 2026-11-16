import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';

type FileCategory = 'images' | 'documents' | 'media' | 'archives' | 'other';

interface StoredFolder {
  id: string;
  name: string;
  parentId: string | null;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoredFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  diskName: string;
  category: FileCategory;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StorageIndex {
  folders: StoredFolder[];
  files: StoredFile[];
}

const PORT = Number(process.env.PORT || 3000);
const QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB free workspace quota
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB per file

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

function ensureStorageReady(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(INDEX_FILE)) {
    const now = new Date().toISOString();
    const welcomeId = crypto.randomUUID();
    const welcomeDiskName = `${welcomeId}.txt`;
    const welcomeContent = [
      'T2XT SERVER — Bulut Dosya Depolama',
      '===================================',
      '',
      'T2XT SERVER çalışma alanınıza hoş geldiniz.',
      'Bu dosya, indirme ve uygulama içi önizleme özelliklerini hemen test edebilmeniz için oluşturulmuştur.',
      '',
      'Özellikler:',
      '- Sürükle-bırak veya seçerek çoklu dosya yükleme (100 MB/dosya)',
      '- Sınırsız iç içe klasör oluşturma, yeniden adlandırma ve taşıma',
      '- Tek dokunuşla indirme ve tarayıcı içi önizleme',
      '- Web ve Android ana ekrana PWA kurulumu',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(UPLOADS_DIR, welcomeDiskName), welcomeContent, 'utf8');
    const welcomeSize = Buffer.byteLength(welcomeContent, 'utf8');

    const docsFolderId = crypto.randomUUID();
    const initialIndex: StorageIndex = {
      folders: [
        {
          id: docsFolderId,
          name: 'Belgeler',
          parentId: null,
          starred: false,
          createdAt: now,
          updatedAt: now,
        },
      ],
      files: [
        {
          id: welcomeId,
          name: 'T2XT_SERVER_Kullanim.txt',
          mimeType: 'text/plain; charset=utf-8',
          size: welcomeSize,
          folderId: null,
          diskName: welcomeDiskName,
          category: 'documents',
          starred: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
    writeIndex(initialIndex);
  }
}

function readIndex(): StorageIndex {
  ensureStorageReady();
  const raw = fs.readFileSync(INDEX_FILE, 'utf8');
  return JSON.parse(raw) as StorageIndex;
}

function writeIndex(data: StorageIndex): void {
  const tempPath = `${INDEX_FILE}.tmp.${process.pid}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, INDEX_FILE);
}

function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.trim().replace(/[/\\?%*:|"<>]/g, '-');
}

function decodeOriginalFilename(rawName: string): string {
  try {
    // Multer encodes non-ASCII filenames as latin1 by default; recover UTF-8 when needed
    const hasNonAsciiLatin1 = /[\u0080-\u00ff]/.test(rawName);
    if (hasNonAsciiLatin1) {
      const converted = Buffer.from(rawName, 'latin1').toString('utf8');
      if (!converted.includes('\ufffd')) {
        return sanitizeName(converted) || 'dosya';
      }
    }
  } catch {
    // Fallback to rawName
  }
  return sanitizeName(rawName) || 'dosya';
}

function categorizeFile(mimeType: string, filename: string): FileCategory {
  const lower = filename.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico|heic|avif)$/.test(lower)) {
    return 'images';
  }
  if (
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    /\.(mp4|webm|mov|mkv|avi|mp3|wav|ogg|m4a|flac)$/.test(lower)
  ) {
    return 'media';
  }
  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('rar') ||
    mime.includes('7z') ||
    mime.includes('compressed') ||
    /\.(zip|rar|7z|tar|gz|bz2|apk|dmg|iso)$/.test(lower)
  ) {
    return 'archives';
  }
  if (
    mime.startsWith('text/') ||
    mime.includes('pdf') ||
    mime.includes('document') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|json|ts|tsx|js|jsx|html|css|py|java|kt|sql|log)$/.test(lower)
  ) {
    return 'documents';
  }
  return 'other';
}

function buildBreadcrumbs(folders: StoredFolder[], folderId: string | null) {
  const crumbs: Array<{ id: string | null; name: string }> = [];
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  let currentId: string | null = folderId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const folder = folderMap.get(currentId);
    if (!folder) break;
    crumbs.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }

  crumbs.unshift({ id: null, name: 'Ana Dizin' });
  return crumbs;
}

function isDescendantFolder(folders: StoredFolder[], potentialParentId: string, folderId: string): boolean {
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  let current: string | null = potentialParentId;
  const visited = new Set<string>();
  while (current) {
    if (current === folderId) return true;
    if (visited.has(current)) break;
    visited.add(current);
    current = folderMap.get(current)?.parentId ?? null;
  }
  return false;
}

function collectDescendantFolderIds(folders: StoredFolder[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    }
  }
  return ids;
}

function deleteFileFromDisk(diskName: string): void {
  const safeName = path.basename(diskName);
  const fullPath = path.join(UPLOADS_DIR, safeName);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureStorageReady();
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 16).replace(/[^a-zA-Z0-9.]/g, '');
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 20,
  },
});

async function startServer() {
  ensureStorageReady();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, server: 'T2XT SERVER' });
  });

  // Storage summary
  app.get('/api/storage/summary', (_req, res) => {
    const idx = readIndex();
    const byCategory = {
      images: 0,
      documents: 0,
      media: 0,
      archives: 0,
      other: 0,
    };
    let usedBytes = 0;

    for (const file of idx.files) {
      usedBytes += file.size;
      byCategory[file.category] += file.size;
    }

    res.json({
      totalFiles: idx.files.length,
      totalFolders: idx.folders.length,
      usedBytes,
      quotaBytes: QUOTA_BYTES,
      byCategory,
    });
  });

  // List folders and files
  app.get('/api/items', (req, res) => {
    const idx = readIndex();
    const folderIdParam = typeof req.query.folderId === 'string' && req.query.folderId.length > 0 ? req.query.folderId : null;
    const view = typeof req.query.view === 'string' ? req.query.view : 'all';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'date';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';

    if (folderIdParam && !idx.folders.some((f) => f.id === folderIdParam)) {
      res.status(404).json({ error: 'Klasör bulunamadı.' });
      return;
    }

    let folders = idx.folders;
    let files = idx.files;

    if (search) {
      folders = folders.filter((f) => f.name.toLowerCase().includes(search));
      files = files.filter((f) => f.name.toLowerCase().includes(search));
    } else if (view === 'starred') {
      folders = folders.filter((f) => f.starred);
      files = files.filter((f) => f.starred);
    } else if (view === 'recent') {
      folders = [];
      files = [...files].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
    } else if (view === 'images') {
      folders = [];
      files = files.filter((f) => f.category === 'images' || f.category === 'media');
    } else if (view === 'documents') {
      folders = [];
      files = files.filter((f) => f.category === 'documents');
    } else {
      folders = folders.filter((f) => f.parentId === folderIdParam);
      files = files.filter((f) => f.folderId === folderIdParam);
    }

    const folderCounts = new Map<string, number>();
    for (const f of idx.folders) {
      if (f.parentId) folderCounts.set(f.parentId, (folderCounts.get(f.parentId) ?? 0) + 1);
    }
    for (const file of idx.files) {
      if (file.folderId) folderCounts.set(file.folderId, (folderCounts.get(file.folderId) ?? 0) + 1);
    }

    const dir = order === 'asc' ? 1 : -1;

    const sortedFolders = folders
      .map((f) => ({ ...f, itemCount: folderCounts.get(f.id) ?? 0 }))
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name, 'tr') * dir;
        if (sort === 'size') return ((a.itemCount ?? 0) - (b.itemCount ?? 0)) * dir;
        return a.updatedAt.localeCompare(b.updatedAt) * dir;
      });

    const sortedFiles = files
      .map(({ diskName: _diskName, ...rest }) => rest)
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name, 'tr') * dir;
        if (sort === 'size') return (a.size - b.size) * dir;
        return a.updatedAt.localeCompare(b.updatedAt) * dir;
      });

    const breadcrumbs =
      view === 'all' && !search
        ? buildBreadcrumbs(idx.folders, folderIdParam)
        : [{ id: null, name: 'Ana Dizin' }];

    res.json({
      breadcrumbs,
      folders: sortedFolders,
      files: sortedFiles,
      allFolders: idx.folders.sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    });
  });

  // Create folder
  app.post('/api/folders', (req, res) => {
    const idx = readIndex();
    const rawName = sanitizeName(req.body?.name);
    const parentId = typeof req.body?.parentId === 'string' && req.body.parentId.length > 0 ? req.body.parentId : null;

    if (!rawName || rawName.length > 120) {
      res.status(400).json({ error: 'Geçerli bir klasör adı girin (1–120 karakter).' });
      return;
    }

    if (parentId && !idx.folders.some((f) => f.id === parentId)) {
      res.status(404).json({ error: 'Üst klasör bulunamadı.' });
      return;
    }

    const duplicate = idx.folders.some(
      (f) => f.parentId === parentId && f.name.toLowerCase() === rawName.toLowerCase()
    );
    if (duplicate) {
      res.status(409).json({ error: 'Bu konumda aynı isimde bir klasör zaten mevcut.' });
      return;
    }

    const now = new Date().toISOString();
    const newFolder: StoredFolder = {
      id: crypto.randomUUID(),
      name: rawName,
      parentId,
      starred: false,
      createdAt: now,
      updatedAt: now,
    };

    idx.folders.push(newFolder);
    writeIndex(idx);
    res.status(201).json({ ...newFolder, itemCount: 0 });
  });

  // Update folder (rename, move, star)
  app.patch('/api/folders/:id', (req, res) => {
    const idx = readIndex();
    const folder = idx.folders.find((f) => f.id === req.params.id);
    if (!folder) {
      res.status(404).json({ error: 'Klasör bulunamadı.' });
      return;
    }

    if (req.body?.name !== undefined) {
      const nextName = sanitizeName(req.body.name);
      if (!nextName || nextName.length > 120) {
        res.status(400).json({ error: 'Geçerli bir klasör adı girin.' });
        return;
      }
      const duplicate = idx.folders.some(
        (f) => f.id !== folder.id && f.parentId === folder.parentId && f.name.toLowerCase() === nextName.toLowerCase()
      );
      if (duplicate) {
        res.status(409).json({ error: 'Aynı konumda bu isimde bir klasör zaten var.' });
        return;
      }
      folder.name = nextName;
    }

    if (req.body?.parentId !== undefined) {
      const nextParentId = typeof req.body.parentId === 'string' && req.body.parentId.length > 0 ? req.body.parentId : null;
      if (nextParentId === folder.id || (nextParentId && isDescendantFolder(idx.folders, nextParentId, folder.id))) {
        res.status(400).json({ error: 'Klasör kendisinin veya alt klasörünün içine taşınamaz.' });
        return;
      }
      if (nextParentId && !idx.folders.some((f) => f.id === nextParentId)) {
        res.status(404).json({ error: 'Hedef klasör bulunamadı.' });
        return;
      }
      folder.parentId = nextParentId;
    }

    if (typeof req.body?.starred === 'boolean') {
      folder.starred = req.body.starred;
    }

    folder.updatedAt = new Date().toISOString();
    writeIndex(idx);
    res.json(folder);
  });

  // Delete folder recursively
  app.delete('/api/folders/:id', (req, res) => {
    const idx = readIndex();
    const folderExists = idx.folders.some((f) => f.id === req.params.id);
    if (!folderExists) {
      res.status(404).json({ error: 'Klasör bulunamadı.' });
      return;
    }

    const toDeleteFolderIds = collectDescendantFolderIds(idx.folders, req.params.id);
    const remainingFiles: StoredFile[] = [];
    for (const file of idx.files) {
      if (file.folderId && toDeleteFolderIds.has(file.folderId)) {
        deleteFileFromDisk(file.diskName);
      } else {
        remainingFiles.push(file);
      }
    }

    idx.folders = idx.folders.filter((f) => !toDeleteFolderIds.has(f.id));
    idx.files = remainingFiles;
    writeIndex(idx);
    res.json({ deletedFolderIds: Array.from(toDeleteFolderIds) });
  });

  // Upload files
  app.post('/api/files/upload', upload.array('files', 20), (req, res) => {
    const uploaded = req.files as Express.Multer.File[] | undefined;
    if (!uploaded || uploaded.length === 0) {
      res.status(400).json({ error: 'Yüklenecek dosya seçilmedi.' });
      return;
    }

    const idx = readIndex();
    const rawFolderId = typeof req.body?.folderId === 'string' && req.body.folderId.length > 0 ? req.body.folderId : null;

    if (rawFolderId && !idx.folders.some((f) => f.id === rawFolderId)) {
      for (const f of uploaded) {
        deleteFileFromDisk(f.filename);
      }
      res.status(404).json({ error: 'Hedef klasör bulunamadı.' });
      return;
    }

    const currentUsed = idx.files.reduce((sum, f) => sum + f.size, 0);
    const incomingTotal = uploaded.reduce((sum, f) => sum + f.size, 0);
    if (currentUsed + incomingTotal > QUOTA_BYTES) {
      for (const f of uploaded) {
        deleteFileFromDisk(f.filename);
      }
      res.status(413).json({ error: 'Ücretsiz depolama kotası (5 GB) aşılıyor.' });
      return;
    }

    const now = new Date().toISOString();
    const createdFiles = [];

    for (const file of uploaded) {
      const displayName = decodeOriginalFilename(file.originalname);
      const mimeType = file.mimetype || 'application/octet-stream';
      const entry: StoredFile = {
        id: crypto.randomUUID(),
        name: displayName,
        mimeType,
        size: file.size,
        folderId: rawFolderId,
        diskName: file.filename,
        category: categorizeFile(mimeType, displayName),
        starred: false,
        createdAt: now,
        updatedAt: now,
      };
      idx.files.push(entry);
      const { diskName: _diskName, ...publicEntry } = entry;
      createdFiles.push(publicEntry);
    }

    writeIndex(idx);
    res.status(201).json({ files: createdFiles });
  });

  // Download file
  app.get('/api/files/:id/download', (req, res) => {
    const idx = readIndex();
    const file = idx.files.find((f) => f.id === req.params.id);
    if (!file) {
      res.status(404).json({ error: 'Dosya bulunamadı.' });
      return;
    }

    const fullPath = path.join(UPLOADS_DIR, path.basename(file.diskName));
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Dosya içeriği sunucuda bulunamadı.' });
      return;
    }

    const encodedName = encodeURIComponent(file.name);
    const asciiFallback = file.name.replace(/[^\x20-\x7e]/g, '_');
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`
    );
    res.setHeader('Content-Length', String(file.size));
    fs.createReadStream(fullPath).pipe(res);
  });

  // Preview file inline
  app.get('/api/files/:id/preview', (req, res) => {
    const idx = readIndex();
    const file = idx.files.find((f) => f.id === req.params.id);
    if (!file) {
      res.status(404).json({ error: 'Dosya bulunamadı.' });
      return;
    }

    const fullPath = path.join(UPLOADS_DIR, path.basename(file.diskName));
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Dosya içeriği bulunamadı.' });
      return;
    }

    const encodedName = encodeURIComponent(file.name);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Length', String(file.size));
    fs.createReadStream(fullPath).pipe(res);
  });

  // Update file (rename, move, star)
  app.patch('/api/files/:id', (req, res) => {
    const idx = readIndex();
    const file = idx.files.find((f) => f.id === req.params.id);
    if (!file) {
      res.status(404).json({ error: 'Dosya bulunamadı.' });
      return;
    }

    if (req.body?.name !== undefined) {
      const nextName = sanitizeName(req.body.name);
      if (!nextName || nextName.length > 200) {
        res.status(400).json({ error: 'Geçerli bir dosya adı girin.' });
        return;
      }
      file.name = nextName;
      file.category = categorizeFile(file.mimeType, nextName);
    }

    if (req.body?.folderId !== undefined) {
      const nextFolderId = typeof req.body.folderId === 'string' && req.body.folderId.length > 0 ? req.body.folderId : null;
      if (nextFolderId && !idx.folders.some((f) => f.id === nextFolderId)) {
        res.status(404).json({ error: 'Hedef klasör bulunamadı.' });
        return;
      }
      file.folderId = nextFolderId;
    }

    if (typeof req.body?.starred === 'boolean') {
      file.starred = req.body.starred;
    }

    file.updatedAt = new Date().toISOString();
    writeIndex(idx);
    const { diskName: _diskName, ...publicFile } = file;
    res.json(publicFile);
  });

  // Delete single file
  app.delete('/api/files/:id', (req, res) => {
    const idx = readIndex();
    const target = idx.files.find((f) => f.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Dosya bulunamadı.' });
      return;
    }

    deleteFileFromDisk(target.diskName);
    idx.files = idx.files.filter((f) => f.id !== target.id);
    writeIndex(idx);
    res.json({ deletedId: target.id });
  });

  // Bulk delete files & folders
  app.post('/api/items/bulk-delete', (req, res) => {
    const idx = readIndex();
    const fileIds = Array.isArray(req.body?.fileIds) ? (req.body.fileIds as string[]) : [];
    const folderIds = Array.isArray(req.body?.folderIds) ? (req.body.folderIds as string[]) : [];

    const allDeletedFolders = new Set<string>();
    for (const fid of folderIds) {
      if (idx.folders.some((f) => f.id === fid)) {
        for (const desc of collectDescendantFolderIds(idx.folders, fid)) {
          allDeletedFolders.add(desc);
        }
      }
    }

    const fileIdSet = new Set(fileIds);
    const remainingFiles: StoredFile[] = [];
    for (const file of idx.files) {
      if (fileIdSet.has(file.id) || (file.folderId && allDeletedFolders.has(file.folderId))) {
        deleteFileFromDisk(file.diskName);
      } else {
        remainingFiles.push(file);
      }
    }

    idx.folders = idx.folders.filter((f) => !allDeletedFolders.has(f.id));
    idx.files = remainingFiles;
    writeIndex(idx);

    res.json({ ok: true });
  });

  // Multer error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'Dosya boyutu 100 MB sınırını aşıyor.' });
        return;
      }
      res.status(400).json({ error: `Yükleme hatası: ${err.message}` });
      return;
    }
    next(err);
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`T2XT SERVER listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start T2XT SERVER:', err);
  process.exit(1);
});
