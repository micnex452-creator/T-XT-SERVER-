import React from 'react';
import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
} from 'lucide-react';
import type { FileCategory } from '../types';

interface FileIconProps {
  isFolder?: boolean;
  category?: FileCategory;
  mimeType?: string;
  name?: string;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({
  isFolder = false,
  category = 'other',
  mimeType = '',
  name = '',
  className = 'w-5 h-5',
}) => {
  if (isFolder) {
    return <Folder className={`${className} text-blue-600 dark:text-blue-400 fill-blue-600/15 dark:fill-blue-400/15`} />;
  }

  const lower = name.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (category === 'images') {
    return <FileImage className={`${className} text-sky-600 dark:text-sky-400`} />;
  }

  if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/.test(lower)) {
    return <FileVideo className={`${className} text-indigo-600 dark:text-indigo-400`} />;
  }

  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/.test(lower)) {
    return <FileAudio className={`${className} text-emerald-600 dark:text-emerald-400`} />;
  }

  if (category === 'archives') {
    return <FileArchive className={`${className} text-amber-600 dark:text-amber-400`} />;
  }

  if (/\.(csv|xlsx?|ods)$/.test(lower) || mime.includes('spreadsheet')) {
    return <FileSpreadsheet className={`${className} text-emerald-600 dark:text-emerald-400`} />;
  }

  if (/\.(ts|tsx|js|jsx|json|html|css|py|java|kt|sql|xml|yaml|yml|sh)$/.test(lower)) {
    return <FileCode2 className={`${className} text-slate-600 dark:text-slate-300`} />;
  }

  if (category === 'documents') {
    return <FileText className={`${className} text-blue-600 dark:text-blue-400`} />;
  }

  return <File className={`${className} text-slate-500 dark:text-slate-400`} />;
};
