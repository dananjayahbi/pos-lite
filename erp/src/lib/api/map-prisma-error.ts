import 'server-only';

import { Prisma } from '@/generated/prisma/client';

import { ApiError } from './errors';

/**
 * INF-02 — single Prisma-error → HTTP mapper.
 *
 * Recognises `PrismaClientKnownRequestError` codes and turns them into typed
 * `ApiError`s with friendly messages. The raw Prisma dump (which echoes source
 * lines, server paths and constraint names) is NEVER surfaced — that leak is
 * the BUG-21/26/29 information-disclosure family.
 */

/** Turn a snake_case column / camelCase field into a human label. */
function humanizeField(field: string): string {
  return field
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
}

function describeTarget(target: unknown): string {
  if (Array.isArray(target) && target.length > 0) {
    return target.map((t) => humanizeField(String(t))).join(' and ');
  }
  if (typeof target === 'string' && target.length > 0) {
    return humanizeField(target);
  }
  return 'the selected fields';
}

export function mapPrismaError(error: unknown): ApiError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = (error.meta as { target?: unknown } | undefined)?.target;
        return ApiError.conflict(`A record with this ${describeTarget(target)} already exists.`);
      }
      case 'P2003': {
        const field = (error.meta as { field?: unknown } | undefined)?.field;
        return typeof field === 'string' && field.length > 0
          ? ApiError.conflict(`The related ${humanizeField(field)} record does not exist.`)
          : ApiError.conflict('A related record is missing or already referenced.');
      }
      case 'P2025':
        return ApiError.notFound('The requested record was not found.');
      case 'P2011':
        return ApiError.badRequest('A required related value is missing.');
      case 'P2012':
        return ApiError.badRequest('A required field is missing.');
      case 'P2023':
        return ApiError.badRequest('The provided value is out of range or invalid.');
      default:
        return ApiError.badRequest('The request could not be processed.');
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    // Validation errors carry the raw input in their message — never echo it.
    return ApiError.validation('One or more fields are invalid.');
  }

  // Numeric / date overflow thrown from Decimal or Date coercion paths.
  if (error instanceof RangeError) {
    return ApiError.badRequest('A numeric or date value is out of range.');
  }

  return null;
}
