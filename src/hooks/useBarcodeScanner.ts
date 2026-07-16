'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCartStore } from '@/stores/cartStore';

const INTER_KEY_THRESHOLD_MS = 50;
const FLUSH_TIMEOUT_MS = 100;
const MIN_BARCODE_LENGTH = 6;

interface BarcodeScanResult {
  id: string;
  sku: string;
  barcode: string | null;
  size: string | null;
  colour: string | null;
  retailPrice: number;
  stockQuantity: number;
  productName: string;
}

interface UseBarcodeScanner {
  onScan?: (productName: string, variantDescription: string) => void;
  enabled?: boolean;
}

export function useBarcodeScanner({ onScan, enabled = true }: UseBarcodeScanner = {}) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queryClient = useQueryClient();
  const addItem = useCartStore((s) => s.addItem);

  const flush = useCallback(async (scannedCode: string) => {
    const barcode = scannedCode.trim();
    if (barcode.length < MIN_BARCODE_LENGTH) return;

    try {
      const data = await queryClient.fetchQuery<BarcodeScanResult | null>({
        queryKey: ['variant-by-barcode', barcode],
        queryFn: async () => {
          const res = await fetch(`/api/store/variants/barcode/${encodeURIComponent(barcode)}`);
          if (res.status === 404) return null;
          if (!res.ok) throw new Error('Barcode lookup failed');
          const json = await res.json();
          return json.data as BarcodeScanResult;
        },
        staleTime: 5 * 60 * 1000, // 5 min cache
      });

      if (!data) {
        toast.error(`Unknown barcode: ${barcode}`);
        return;
      }

      if (data.stockQuantity <= 0) {
        const desc = [data.size, data.colour].filter(Boolean).join(' / ');
        toast.warning(`Out of stock: ${data.productName}${desc ? ` (${desc})` : ''}`);
        return;
      }

      const variantDescription = [data.size, data.colour].filter(Boolean).join(' / ') || 'Default';

      addItem({
        variantId: data.id,
        productName: data.productName,
        variantDescription,
        sku: data.sku,
        unitPrice: Number(data.retailPrice),
        quantity: 1,
      });

      onScan?.(data.productName, variantDescription);
    } catch {
      toast.error(`Barcode lookup failed for: ${barcode}`);
    }
  }, [queryClient, addItem, onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if focused on an input element
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }

      const now = Date.now();

      if (e.key === 'Enter') {
        // Flush buffer if it has enough characters
        if (bufferRef.current.length >= MIN_BARCODE_LENGTH) {
          e.preventDefault();
          const code = bufferRef.current;
          bufferRef.current = '';
          lastKeyTimeRef.current = 0;
          if (flushTimeoutRef.current !== undefined) {
            clearTimeout(flushTimeoutRef.current);
            flushTimeoutRef.current = undefined;
          }
          flush(code);
        }
        return;
      }

      // Only process printable characters (single character keys)
      if (e.key.length !== 1) return;

      const elapsed = now - lastKeyTimeRef.current;

      if (bufferRef.current.length === 0) {
        // Start new potential scan sequence
        bufferRef.current = e.key;
        lastKeyTimeRef.current = now;
        // Set flush timeout
        if (flushTimeoutRef.current !== undefined) clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = setTimeout(() => {
          bufferRef.current = '';
          lastKeyTimeRef.current = 0;
          flushTimeoutRef.current = undefined;
        }, FLUSH_TIMEOUT_MS);
        return;
      }

      if (elapsed <= INTER_KEY_THRESHOLD_MS) {
        // Fast keystroke — scanner input
        bufferRef.current += e.key;
        lastKeyTimeRef.current = now;
        // Reset flush timeout
        if (flushTimeoutRef.current !== undefined) clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = setTimeout(() => {
          // Auto-flush if we have enough chars (scanner might not send Enter)
          if (bufferRef.current.length >= MIN_BARCODE_LENGTH) {
            const code = bufferRef.current;
            bufferRef.current = '';
            lastKeyTimeRef.current = 0;
            flush(code);
          } else {
            bufferRef.current = '';
            lastKeyTimeRef.current = 0;
          }
          flushTimeoutRef.current = undefined;
        }, FLUSH_TIMEOUT_MS);
      } else {
        // Slow keystroke — human typing, clear buffer
        bufferRef.current = '';
        lastKeyTimeRef.current = 0;
        if (flushTimeoutRef.current !== undefined) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = undefined;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (flushTimeoutRef.current !== undefined) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, [enabled, flush]);
}
