export type FileCategory = 'images' | 'documents' | 'media' | 'archives' | 'other';

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
}

export interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  category: FileCategory;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export interface ItemsResponse {
  breadcrumbs: BreadcrumbItem[];
  folders: FolderItem[];
  files: FileItem[];
  allFolders: FolderItem[];
}

export interface StorageSummary {
  totalFiles: number;
  totalFolders: number;
  usedBytes: number;
  quotaBytes: number;
  byCategory: {
    images: number;
    documents: number;
    media: number;
    archives: number;
    other: number;
  };
}

export type WorkspaceView = 'all' | 'starred' | 'recent' | 'images' | 'documents';
export type SortField = 'name' | 'date' | 'size';
export type SortOrder = 'asc' | 'desc';
export type ViewMode = 'list' | 'grid';
