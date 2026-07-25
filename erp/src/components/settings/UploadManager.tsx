'use client';

import React, { createContext, useContext, useRef, useCallback } from 'react';

interface UploadContextValue {
  /** Register a file to be uploaded on save. Returns a unique key. */
  registerPending: (file: File) => string;
  /** Update the file for a previously registered key */
  updatePending: (key: string, file: File) => void;
  /** Unregister a pending upload (e.g., when user removes media) */
  unregisterPending: (key: string) => void;
  /** Mark an existing Cloudflare URL for deletion on save */
  markForDeletion: (url: string) => void;
  /** Unmark a URL from deletion */
  unmarkForDeletion: (url: string) => void;
  /** Process all pending uploads. Returns a map of key → uploaded URL. */
  processUploads: () => Promise<Map<string, string>>;
  /** Return the list of URLs to delete from Cloudflare. */
  getDeletionList: () => string[];
  /** Clear all pending state (after successful save). */
  reset: () => void;
  /** Whether there are pending uploads or deletions. */
  hasPending: () => boolean;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUploadManager() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploadManager must be used within UploadManagerProvider');
  return ctx;
}

export function UploadManagerProvider({ children }: { children: React.ReactNode }) {
  const pendingFiles = useRef<Map<string, File>>(new Map());
  const deletionUrls = useRef<Set<string>>(new Set());
  let keyCounter = 0;

  const registerPending = useCallback((file: File): string => {
    const key = `upload_${Date.now()}_${++keyCounter}`;
    pendingFiles.current.set(key, file);
    return key;
  }, []);

  const updatePending = useCallback((key: string, file: File) => {
    pendingFiles.current.set(key, file);
  }, []);

  const unregisterPending = useCallback((key: string) => {
    pendingFiles.current.delete(key);
  }, []);

  const markForDeletion = useCallback((url: string) => {
    if (url && url.trim()) {
      deletionUrls.current.add(url);
    }
  }, []);

  const unmarkForDeletion = useCallback((url: string) => {
    deletionUrls.current.delete(url);
  }, []);

  const processUploads = useCallback(async (): Promise<Map<string, string>> => {
    const result = new Map<string, string>();
    const entries = Array.from(pendingFiles.current.entries());

    for (const [key, file] of entries) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload/website-asset', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error((err as { error?: string }).error || `Upload failed (${response.status})`);
        }

        const data = (await response.json()) as { url: string };
        result.set(key, data.url);
      } catch (err) {
        console.error(`Failed to upload file for key ${key}:`, err);
        throw err;
      }
    }

    return result;
  }, []);

  const getDeletionList = useCallback((): string[] => {
    return Array.from(deletionUrls.current);
  }, []);

  const reset = useCallback(() => {
    pendingFiles.current.clear();
    deletionUrls.current.clear();
  }, []);

  const hasPending = useCallback((): boolean => {
    return pendingFiles.current.size > 0 || deletionUrls.current.size > 0;
  }, []);

  const value: UploadContextValue = {
    registerPending,
    updatePending,
    unregisterPending,
    markForDeletion,
    unmarkForDeletion,
    processUploads,
    getDeletionList,
    reset,
    hasPending,
  };

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
}
