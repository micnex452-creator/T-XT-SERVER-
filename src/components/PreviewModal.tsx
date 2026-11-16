import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, FileWarning, X } from 'lucide-react';
import { getDownloadUrl, getPreviewUrl } from '../api';
import type { FileItem } from '../types';
import { formatBytes, formatDate, isTextPreviewable } from '../utils/format';
import { FileIcon } from './FileIcon';

interface PreviewModalProps {
  file: FileItem | null;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ file, onClose }) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);

  const isText = file ? isTextPreviewable(file.mimeType, file.name) : false;
  const isImage = file?.category === 'images';
  const isPdf = file ? file.mimeType.includes('pdf') || file.name.toLowerCase().endsWith('.pdf') : false;
  const isVideo = file ? file.mimeType.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name) : false;
  const isAudio = file ? file.mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(file.name) : false;

  useEffect(() => {
    setImgError(false);
    setTextContent(null);
    setTextError(false);
    setCopied(false);

    if (!file || !isText) return;

    if (file.size > 2 * 1024 * 1024) {
      setTextError(true);
      return;
    }

    let cancelled = false;
    setTextLoading(true);
    fetch(getPreviewUrl(file.id))
      .then((res) => {
        if (!res.ok) throw new Error('Preview failed');
        return res.text();
      })
      .then((txt) => {
        if (!cancelled) setTextContent(txt);
      })
      .catch(() => {
        if (!cancelled) setTextError(true);
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file, isText]);

  if (!file) return null;

  const previewUrl = getPreviewUrl(file.id);
  const downloadUrl = getDownloadUrl(file.id);

  const handleCopyText = async () => {
    if (!textContent) return;
    await navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl flex flex-col bg-white dark:bg-slate-900 sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileIcon category={file.category} mimeType={file.mimeType} name={file.name} className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                {file.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                {formatBytes(file.size)} · {formatDate(file.updatedAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {textContent !== null && (
              <button
                type="button"
                onClick={handleCopyText}
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
              </button>
            )}
            <a
              href={downloadUrl}
              download={file.name}
              className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs sm:text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>İndir</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Önizlemeyi kapat"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 flex items-center justify-center min-h-[300px]">
          {isImage && !imgError ? (
            <img
              src={previewUrl}
              alt={file.name}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="max-w-full max-h-[70vh] object-contain rounded-lg border border-slate-200 dark:border-slate-800"
            />
          ) : isPdf ? (
            <iframe
              src={previewUrl}
              title={file.name}
              className="w-full h-[70vh] rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
            />
          ) : isVideo ? (
            <video
              src={previewUrl}
              controls
              className="max-w-full max-h-[70vh] rounded-lg bg-black"
            />
          ) : isAudio ? (
            <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
              <FileIcon category={file.category} mimeType={file.mimeType} name={file.name} className="w-12 h-12 mx-auto" />
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{file.name}</p>
              <audio src={previewUrl} controls className="w-full" />
            </div>
          ) : isText ? (
            <div className="w-full h-full max-h-[70vh] overflow-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
              {textLoading ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">İçerik yükleniyor...</div>
              ) : textError ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Dosya önizleme sınırından büyük veya okunamıyor.
                  </p>
                  <a
                    href={downloadUrl}
                    download={file.name}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    <span>Dosyayı İndir</span>
                  </a>
                </div>
              ) : (
                <pre className="font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                  {textContent}
                </pre>
              )}
            </div>
          ) : (
            <div className="text-center max-w-sm p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <FileWarning className="w-12 h-12 mx-auto text-slate-400" />
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Önizleme Kullanılamıyor
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Bu dosya biçimi doğrudan tarayıcıda görüntülenemiyor. Cihazınıza indirerek açabilirsiniz.
                </p>
              </div>
              <a
                href={downloadUrl}
                download={file.name}
                className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Cihaza İndir ({formatBytes(file.size)})</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
