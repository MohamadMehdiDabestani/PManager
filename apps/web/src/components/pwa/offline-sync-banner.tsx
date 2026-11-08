'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, CloudUpload, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  listOutboxActions,
  syncOutboxWithServer,
  registerPwaServiceWorker,
  type OutboxAction,
} from '@/lib/offline-outbox';

export function OfflineSyncBanner() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [outbox, setOutbox] = useState<OutboxAction[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refreshOutbox = useCallback(async () => {
    const items = await listOutboxActions();
    setOutbox(items);
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await syncOutboxWithServer();
      await refreshOutbox();
      if (res.synced > 0) {
        router.refresh();
      }
    } finally {
      setSyncing(false);
    }
  }, [refreshOutbox, router]);

  useEffect(() => {
    registerPwaServiceWorker();
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    void refreshOutbox();

    const onOnline = () => {
      setIsOnline(true);
      void handleSync();
    };
    const onOffline = () => setIsOnline(false);
    const onOutboxChanged = () => {
      void refreshOutbox();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('cmms-outbox-changed', onOutboxChanged);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('cmms-outbox-changed', onOutboxChanged);
    };
  }, [refreshOutbox, handleSync]);

  const failedItems = outbox.filter((i) => i.status === 'FAILED');

  return (
    <div className="rounded-xl border border-border bg-card/85 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        {isOnline ? (
          <Badge variant="success" className="gap-1.5 py-1 px-2.5">
            <Wifi className="h-3.5 w-3.5" />
            آنلاین (متصل به سرور کارخانه)
          </Badge>
        ) : (
          <Badge variant="warning" className="gap-1.5 py-1 px-2.5">
            <WifiOff className="h-3.5 w-3.5" />
            حالت آفلاین (ذخیره در IndexedDB دستگاه)
          </Badge>
        )}

        {outbox.length > 0 ? (
          <span className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
            <CloudUpload className="h-4 w-4" />
            {outbox.length.toLocaleString('fa-IR')} عملیات در صف همگام‌سازی آفلاین
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            تمام اطلاعات با سرور همگام است (PWA Ready)
          </span>
        )}

        {failedItems.length > 0 && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            خطا: {failedItems[0]?.lastError}
          </span>
        )}
      </div>

      {outbox.length > 0 && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!isOnline || syncing}
          onClick={handleSync}
        >
          <RefreshCw className={`h-3.5 w-3.5 me-1.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'در حال ارسال...' : 'همگام‌سازی فوری صف'}
        </Button>
      )}
    </div>
  );
}
