// WhatsApp Business messaging via Meta Cloud API v18.0.
// Server-side only — references process.env.

export interface WhatsAppReceiptPayload {
  storeName: string;
  saleReference: string;
  itemsSummary: string;
  totalAmount: string;
}

export function formatPhoneNumber(raw: string): string {
  let cleaned = raw.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '94' + cleaned.slice(1);
  }
  const result = '+' + cleaned;
  if (!/^\+\d{7,15}$/.test(result)) {
    throw new TypeError(
      'Invalid phone number format: the number provided cannot be converted to a valid E.164 format.',
    );
  }
  return result;
}

function formatReceiptTemplateComponents(payload: WhatsAppReceiptPayload) {
  const itemsSummary =
    payload.itemsSummary.length > 60
      ? payload.itemsSummary.slice(0, 57) + '…'
      : payload.itemsSummary;

  return [
    {
      type: 'body' as const,
      parameters: [
        { type: 'text' as const, text: payload.storeName },
        { type: 'text' as const, text: payload.saleReference },
        { type: 'text' as const, text: itemsSummary },
        { type: 'text' as const, text: payload.totalAmount },
      ],
    },
  ];
}

export async function sendWhatsAppReceiptMessage(
  phoneNumber: string,
  saleId: string,
  saleData: WhatsAppReceiptPayload,
): Promise<{ success: boolean; error?: string }> {
  let formattedPhone: string;
  try {
    formattedPhone = formatPhoneNumber(phoneNumber);
  } catch (err) {
    return {
      success: false,
      error: 'Invalid phone number: ' + (err instanceof Error ? err.message : String(err)),
    };
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;

  if (!phoneNumberId || !accessToken || !templateName) {
    return {
      success: false,
      error: 'WhatsApp is not configured. Missing environment variables.',
    };
  }

  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(phoneNumberId)}/messages`;
  const components = formatReceiptTemplateComponents(saleData);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components,
        },
      }),
    });

    if (res.status !== 200 && res.status !== 201) {
      const errorBody = await res.text();
      console.error(`[WhatsApp] Sale ${saleId}: API returned HTTP ${res.status}`, errorBody);
      return {
        success: false,
        error: `WhatsApp dispatch failed. Meta API returned HTTP status ${res.status}.`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error(`[WhatsApp] Sale ${saleId}: Network error`, err);
    return { success: false, error: 'WhatsApp dispatch failed due to a network error.' };
  }
}

export async function sendWhatsAppTextMessage(
  phoneNumber: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  let formattedPhone: string;
  try {
    formattedPhone = formatPhoneNumber(phoneNumber);
  } catch (err) {
    return {
      success: false,
      error: 'Invalid phone number: ' + (err instanceof Error ? err.message : String(err)),
    };
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      error: 'WhatsApp is not configured. Missing environment variables.',
    };
  }

  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(phoneNumberId)}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: { body: message },
      }),
    });

    if (res.status !== 200 && res.status !== 201) {
      const errorBody = await res.text();
      console.error(`[WhatsApp] Text message to ${phoneNumber}: API returned HTTP ${res.status}`, errorBody);
      return { success: false, error: `WhatsApp dispatch failed. Meta API returned HTTP status ${res.status}.` };
    }

    return { success: true };
  } catch (err) {
    console.error(`[WhatsApp] Text message to ${phoneNumber}: Network error`, err);
    return { success: false, error: 'WhatsApp dispatch failed due to a network error.' };
  }
}
