'use client';

/** Submit a hidden form to the PayHere gateway with the given hidden fields. */
export function submitPayHereRedirect(
  payhereUrl: string,
  payload: Record<string, string>,
): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = payhereUrl;
  form.style.display = 'none';

  for (const [key, value] of Object.entries(payload)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
