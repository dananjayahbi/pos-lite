/**
 * Clipboard helpers for client components.
 *
 * The browser Clipboard API (`navigator.clipboard`) is only available in
 * secure contexts (https / localhost). We fall back to the legacy
 * `document.execCommand('copy')` path so copying still works on non-secure
 * deployments (e.g. an admin panel served over plain http on an intranet).
 */

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Legacy fallback — injects a temporary textarea and execCommand('copy')
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
