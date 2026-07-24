import type { z } from "zod";

export function parseQueryResult<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}
