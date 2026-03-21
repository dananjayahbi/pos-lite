'use server';

import { sendToPrinter, type PrinterConfig } from '@/lib/hardware/printer';

// ESC p pin0 on-time(60ms) off-time(60ms)
const DRAWER_KICK_CMD = Buffer.from([0x1b, 0x70, 0x00, 0x3c, 0x3c]);

/**
 * Sends ESC/POS cash drawer kick command via the network printer.
 * Fire-and-forget: catches all errors internally, never re-throws.
 */
export async function kickCashDrawer(printerConfig: PrinterConfig): Promise<void> {
  try {
    await sendToPrinter(printerConfig, DRAWER_KICK_CMD);
  } catch (err) {
    console.error('[CashDrawer] Failed to kick drawer:', err instanceof Error ? err.message : err);
  }
}

/**
 * Sends the same drawer kick command, but RE-THROWS errors
 * so the calling API route can surface them to the user.
 */
export async function testDrawer(printerConfig: PrinterConfig): Promise<void> {
  await sendToPrinter(printerConfig, DRAWER_KICK_CMD);
}
