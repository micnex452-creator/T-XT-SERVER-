import React from 'react';
import { HardDrive } from 'lucide-react';
import type { StorageSummary } from '../types';
import { formatBytes } from '../utils/format';
import { PWAInstallButton } from './PWAInstallButton';

interface StorageSidebarMeterProps {
  summary: StorageSummary | null;
}

export const StorageSidebarMeter: React.FC<StorageSidebarMeterProps> = ({ summary }) => {
  const used = summary?.usedBytes ?? 0;
  const quota = summary?.quotaBytes ?? 5 * 1024 * 1024 * 1024;
  const percent = Math.min(100, (used / quota) * 100);

  return (
    <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
        <span className="inline-flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span>Depolama Alanı</span>
        </span>
        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
          {percent < 0.1 && used > 0 ? '<0.1%' : `${percent.toFixed(1)}%`}
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${Math.max(used > 0 ? 2 : 0, percent)}%` }}
        />
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
        {formatBytes(used)} / {formatBytes(quota)} kullanılıyor
      </p>

      <PWAInstallButton />
    </div>
  );
};

interface StorageMobileViewProps {
  summary: StorageSummary | null;
}

export const StorageMobileView: React.FC<StorageMobileViewProps> = ({ summary }) => {
  const used = summary?.usedBytes ?? 0;
  const quota = summary?.quotaBytes ?? 5 * 1024 * 1024 * 1024;
  const percent = Math.min(100, (used / quota) * 100);

  const categories = [
    { key: 'images', label: 'Görseller', bytes: summary?.byCategory.images ?? 0, bar: 'bg-sky-600' },
    { key: 'documents', label: 'Belgeler', bytes: summary?.byCategory.documents ?? 0, bar: 'bg-blue-600' },
    { key: 'media', label: 'Video ve Ses', bytes: summary?.byCategory.media ?? 0, bar: 'bg-indigo-600' },
    { key: 'archives', label: 'Arşiv ve APK', bytes: summary?.byCategory.archives ?? 0, bar: 'bg-amber-600' },
    { key: 'other', label: 'Diğer Dosyalar', bytes: summary?.byCategory.other ?? 0, bar: 'bg-slate-500' },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Depolama Kullanımı
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {summary?.totalFolders ?? 0} klasör · {summary?.totalFiles ?? 0} dosya
            </p>
          </div>
          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatBytes(used)}
          </span>
        </div>

        <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full"
            style={{ width: `${Math.max(used > 0 ? 2 : 0, percent)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          <span>Kullanılan: {formatBytes(used)}</span>
          <span>Ücretsiz Kota: {formatBytes(quota)}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        {categories.map((cat) => {
          const share = used > 0 ? (cat.bytes / used) * 100 : 0;
          return (
            <div key={cat.key} className="px-5 py-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{cat.label}</span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {formatBytes(cat.bytes)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${cat.bar} rounded-full`}
                    style={{ width: `${cat.bytes > 0 ? Math.max(4, share) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Web ve Android Uygulaması
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          T2XT SERVER uygulamasını Android telefonunuzun veya bilgisayarınızın ana ekranına kurarak tam ekran deneyimle kullanabilirsiniz.
        </p>
        <PWAInstallButton />
      </div>
    </div>
  );
};
