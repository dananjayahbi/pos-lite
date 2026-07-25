"use client";

/**
 * Mounts the cart drawer at the React tree root. Add this once inside
 * `<WebsiteShell>` (or your layout) so the drawer can slide in over
 * any page.
 *
 * We intentionally render the drawer as a fixed-position overlay rather
 * than a Portal — Next.js App Router server components can't use
 * `createPortal` without a client wrapper, and this approach is simpler
 * and equally correct because the panel uses `fixed inset-0`.
 */

import React from 'react';
import { CartDrawer } from './CartDrawer';

interface CartDrawerHostProps {
  tenantSlug: string;
}

export function CartDrawerHost({ tenantSlug }: CartDrawerHostProps) {
  return <CartDrawer tenantSlug={tenantSlug} />;
}