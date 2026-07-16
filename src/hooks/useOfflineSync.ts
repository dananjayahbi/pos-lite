'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { getQueuedSale, dequeueOfflineSale, enqueueOfflineSale } from '@/lib/idb-store';

interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  hasPendingSale: boolean;
  syncError: string | null;
}

const MAX_RETRIES = 3;

export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState(true); // always start as online (safe SSR default)
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasPendingSale, setHasPendingSale] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const prevOnlineRef = useRef(isOnline);

  // Sync initial value from navigator.onLine after hydration
  useEffect(() => {
    setIsOnline(navigator.onLine);
  }, []);

  // Check for pending sales on mount
  const checkPending = useCallback(async () => {
    try {
      const queued = await getQueuedSale();
      setHasPendingSale(queued !== null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkPending();
  }, [checkPending]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync when coming back online
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (!isOnline) return;
    if (!wasOffline && !hasPendingSale) return;

    (async () => {
      const queued = await getQueuedSale();
      if (!queued) {
        setHasPendingSale(false);
        return;
      }

      setIsSyncing(true);
      setSyncError(null);

      try {
        const payload = queued.payload as Record<string, unknown>;
        const enrichedPayload = { ...payload, queued_at: queued.queuedAt };

        const res = await fetch('/api/store/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(enrichedPayload),
        });

        if (res.ok) {
          const json = await res.json();
          await dequeueOfflineSale(queued.key);
          setHasPendingSale(false);
          setIsSyncing(false);
          window.dispatchEvent(
            new CustomEvent('velvetpos:offlineSaleSynced', { detail: json.data }),
          );
          toast.success('Offline sale synced successfully');
        } else if (res.status === 410) {
          await dequeueOfflineSale(queued.key);
          setHasPendingSale(false);
          setIsSyncing(false);
          const msg = 'Offline sale was too old to process and has been discarded. Please re-enter the sale.';
          setSyncError(msg);
          toast.warning(msg);
        } else {
          setIsSyncing(false);
          // Check retry count
          const retryCount = ((payload.retryCount as number) ?? 0) + 1;
          if (retryCount > MAX_RETRIES) {
            await dequeueOfflineSale(queued.key);
            setHasPendingSale(false);
            const msg = 'Offline sale failed to sync after 3 attempts and has been discarded.';
            setSyncError(msg);
            toast.error(msg);
          } else {
            // Update retry count in the queued payload
            await dequeueOfflineSale(queued.key);
            await enqueueOfflineSale({ ...payload, retryCount });
            setHasPendingSale(true);
            const errText = await res.text().catch(() => 'Unknown error');
            setSyncError(`Sync failed (attempt ${retryCount}/${MAX_RETRIES}): ${errText}`);
          }
        }
      } catch (err) {
        setIsSyncing(false);
        const payload = queued.payload as Record<string, unknown>;
        const retryCount = ((payload.retryCount as number) ?? 0) + 1;
        if (retryCount > MAX_RETRIES) {
          await dequeueOfflineSale(queued.key);
          setHasPendingSale(false);
          const msg = 'Offline sale failed to sync after 3 attempts and has been discarded.';
          setSyncError(msg);
          toast.error(msg);
        } else {
          await dequeueOfflineSale(queued.key);
          await enqueueOfflineSale({ ...payload, retryCount });
          setHasPendingSale(true);
          setSyncError(`Sync failed (attempt ${retryCount}/${MAX_RETRIES}): ${err instanceof Error ? err.message : 'Network error'}`);
        }
      }
    })();
  }, [isOnline, hasPendingSale]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isOnline, isSyncing, hasPendingSale, syncError };
}
