/**
 * SMS provider adapter for marketing broadcasts.
 *
 * The deployment is provider-agnostic: point `SMS_API_URL` at any HTTP gateway
 * that accepts `{ to, message, sender }` and authenticates with a bearer token.
 * Missing credentials produce a structured `SMS_NOT_CONFIGURED` result instead
 * of a silent failure, matching the email/WhatsApp provider contract.
 */

import { formatPhoneNumber } from '@/lib/whatsapp';
import {
  SMS_NOT_CONFIGURED,
  warnProviderNotConfigured,
} from '@/lib/notifications/provider-status';

export interface SmsSendResult {
  success: boolean;
  error?: string;
  code?: string;
}

function getSmsConfig() {
  const url = process.env.SMS_API_URL;
  const apiKey = process.env.SMS_API_KEY;
  const senderId = process.env.SMS_SENDER_ID;
  if (!url || !apiKey) return null;
  return { url, apiKey, senderId: senderId ?? 'AyurPOS' };
}

export function isSmsConfigured(): boolean {
  return getSmsConfig() !== null;
}

export async function sendSmsMessage(
  phoneNumber: string,
  message: string,
): Promise<SmsSendResult> {
  let formattedPhone: string;
  try {
    formattedPhone = formatPhoneNumber(phoneNumber);
  } catch (err) {
    return {
      success: false,
      error: 'Invalid phone number: ' + (err instanceof Error ? err.message : String(err)),
    };
  }

  const config = getSmsConfig();
  if (!config) {
    warnProviderNotConfigured('sms');
    return {
      success: false,
      error: 'SMS is not configured. Missing SMS_API_URL / SMS_API_KEY.',
      code: SMS_NOT_CONFIGURED,
    };
  }

  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        to: formattedPhone,
        message,
        sender: config.senderId,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      console.error(`[SMS] ${formattedPhone}: gateway returned HTTP ${res.status}`, errorBody);
      return {
        success: false,
        error: `SMS dispatch failed. Gateway returned HTTP status ${res.status}.`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error(`[SMS] ${formattedPhone}: network error`, err);
    return { success: false, error: 'SMS dispatch failed due to a network error.' };
  }
}
