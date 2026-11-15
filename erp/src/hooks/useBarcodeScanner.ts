'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCartStore } from '@/stores/cartStore';

const INTER_KEY_THRESHOLD_MS = 50;
const FLUSH_TIMEOUT_MS = 100;
const MIN_BARCODE_LENGTH = 6;

/**
 * Barcodes accepted by `/api/store/variants/barcode/[barcode]` (mirrors the
 * route's pattern). Anything else is a search term, not a scan — so the
 * always-focused search box can press Enter without a spurious
 * "unknown barcode" toast.
 */
const BARCODE_API_PATTERN = /^[a-zA-Z0-9-]{8,20}$/;

interface BarcodeScanResult {
  id: string;
  sku: string;
  barcode: string | null;
  form: string | null;
  packSize: string | null;
  retailPrice: number;
  stockQuantity: number;
  productName: string;
}

interface UseBarcodeScanner {
  onScan?: (productName: string, variantDescription: string) => void;
  enabled?: boolean;
}

export interface ScanBarcodeOptions {
  /** Show the "unknown barcode" toast. Off when the caller routes searches too. */
  notifyUnknown?: boolean;
}

export interface ScanBarcodeResult {
  ok: boolean;
  productName?: string;
  variantDescription?: string;
}

/**
 * Resolves a scanned code and adds it to the cart.
 *
 * Shared by the global keyboard-wedge listener and the always-focused POS
 * scan input, so both pathways have identical lookup/stock/toast behaviour.
 */
export function useBarcodeScanToCart(onScan?: (productName: string, variantDescription: string) => void) {
  const queryClient = useQueryClient();
  const addItem = useCartStore((s) => s.addItem);

  const scanBarcode = useCallback(
    async (rawCode: string, options: ScanBarcodeOptions = {}): Promise<ScanBarcodeResult> => {
      const barcode = rawCode.trim();
      if (barcode.length < MIN_BARCODE_LENGTH) return { ok: false };
      if (!BARCODE_API_PATTERN.test(barcode)) return { ok: false };

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
          if (options.notifyUnknown) toast.error(`Unknown barcode: ${barcode}`);
          return { ok: false };
        }

        const variantDescription =
          [data.form, data.packSize].filter(Boolean).join(' / ') || 'Default';

        if (data.stockQuantity <= 0) {
          toast.warning(`Out of stock: ${data.productName}${variantDescription !== 'Default' ? ` (${variantDescription})` : ''}`);
          return { ok: false, productName: data.productName, variantDescription };
        }

        addItem({
          variantId: data.id,
          productName: data.productName,
          variantDescription,
          sku: data.sku,
          unitPrice: Number(data.retailPrice),
          quantity: 1,
        });

        onScan?.(data.productName, variantDescription);
        return { ok: true, productName: data.productName, variantDescription };
      } catch {
        if (options.notifyUnknown) toast.error(`Barcode lookup failed for: ${barcode}`);
        return { ok: false };
      }
    },
    [queryClient, addItem, onScan],
  );

  return { scanBarcode };
}

/**
 * Global keyboard-wedge scanner.
 *
 * Kept as a fallback for scans typed while focus sits outside a text field
 * (for example after the cashier taps a product card). When the always-focused
 * POS scan input owns the keystrokes, this listener stays out of the way and
 * the input's own handler performs the lookup.
 */
export function useBarcodeScanner({ onScan, enabled = true }: UseBarcodeScanner = {}) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { scanBarcode } = useBarcodeScanToCart(onScan);

  const flush = useCallback(
    async (scannedCode: string) => {
      await scanBarcode(scannedCode, { notifyUnknown: true });
    },
    [scanBarcode],
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Text fields own their keystrokes: the POS scan box (or any other
      // input) resolves scans through its own Enter/burst handler.
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
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
          void flush(code);
        }
        return;
      }

      // Only single characters
      if (e.key.length !== 1) return;

      // Reset buffer if too much time has passed
      if (now - lastKeyTimeRef.current > INTER_KEY_THRESHOLD_MS) {
        bufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      bufferRef.current += e.key;

      // Schedule a flush in case no Enter is pressed
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = setTimeout(() => {
        if (bufferRef.current.length >= MIN_BARCODE_LENGTH) {
          const code = bufferRef.current;
          bufferRef.current = '';
          void flush(code);
        }
      }, FLUSH_TIMEOUT_MS);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    };
  }, [flush, enabled]);
}
