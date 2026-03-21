/**
 * CFD Event Emitter — Module-level singleton
 *
 * LIMITATION: This module-level EventEmitter works when all API route
 * invocations share a single Node.js process (local dev, traditional
 * server deployments). In Vercel's serverless mode, POST and GET handlers
 * may run in separate function instances that don't share module state.
 * Production upgrade path: Replace with Redis pub/sub (ioredis or Upstash).
 */
import { EventEmitter } from 'events';

export const cfdEmitter = new EventEmitter();
cfdEmitter.setMaxListeners(50);

export type CFDCartPayload = {
  tenantSlug: string;
  items: Array<{
    productName: string;
    variantName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  appliedPromotions: Array<{ id: string; name: string }>;
  customerName?: string;
  status: 'ACTIVE' | 'COMPLETE' | 'IDLE';
  change?: number;
};
