import { randomBytes } from "crypto";

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}
