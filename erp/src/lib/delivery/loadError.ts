/** Error carrying the HTTP status so the detail can distinguish 404 from 403/500. */
export class DeliveryLoadError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'DeliveryLoadError';
    this.status = status;
  }
}

export function deliveryErrorStatus(error: unknown): number | null {
  return error instanceof DeliveryLoadError ? error.status : null;
}
