import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          compact
            ? 'inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0'
            : 'w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 text-white text-sm font-medium hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Uygulamayı Kur</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={
          compact
            ? 'inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0'
            : 'w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Smartphone className="w-4 h-4 shrink-0" />
        <span>{isIOS ? 'iPhone / iPad Kurulumu' : isAndroid ? 'Android Uygulaması' : 'Cihaza Kur'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                T2XT SERVER Cihaz Kurulumu
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Kapat"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>1. Safari alt menüsündeki <strong>Paylaş</strong> simgesine dokunun.</p>
                <p>2. Aşağı kaydırıp <strong>Ana Ekrana Ekle</strong> seçeneğine dokunun.</p>
                <p>3. Sağ üstteki <strong>Ekle</strong> butonuna dokunarak uygulamayı başlatın.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  <strong>Android (Chrome):</strong> Sağ üst menüden (⋮) <strong>Ana ekrana ekle</strong> veya{' '}
                  <strong>Uygulamayı yükle</strong> seçeneğine dokunun.
                </p>
                <p>
                  <strong>Masaüstü (Chrome / Edge):</strong> Adres çubuğunun sağındaki{' '}
                  <strong>Yükle</strong> simgesine tıklayarak bağımsız pencere olarak kullanabilirsiniz.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-blue-600 text-white text-sm font-medium hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </>
  );
};
