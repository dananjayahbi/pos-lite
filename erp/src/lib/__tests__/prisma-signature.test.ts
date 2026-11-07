import { describe, expect, it } from 'vitest';
import {
  prismaModelSignature,
  shouldReusePrismaClient,
} from '@/lib/prisma-signature';

describe('prismaModelSignature', () => {
  it('is order independent so HMR reloads reuse the same client', () => {
    expect(prismaModelSignature(['User', 'PayrollRun', 'Sale'])).toBe(
      prismaModelSignature(['Sale', 'User', 'PayrollRun']),
    );
  });

  it('changes when prisma generate adds a model', () => {
    const before = prismaModelSignature(['User', 'Sale']);
    const after = prismaModelSignature(['User', 'Sale', 'PayrollRun']);

    expect(after).not.toBe(before);
  });

  it('changes when prisma generate removes a model', () => {
    const before = prismaModelSignature(['User', 'Sale']);
    const after = prismaModelSignature(['User']);

    expect(after).not.toBe(before);
  });
});

describe('shouldReusePrismaClient', () => {
  it('reuses the cached client when the generated model matches', () => {
    expect(shouldReusePrismaClient('PayrollRun|Sale|User', 'PayrollRun|Sale|User')).toBe(true);
  });

  it('rebuilds when the generated model changed', () => {
    expect(shouldReusePrismaClient('Sale|User', 'PayrollRun|Sale|User')).toBe(false);
  });

  it('rebuilds when there is no cached signature yet', () => {
    expect(shouldReusePrismaClient(undefined, 'Sale|User')).toBe(false);
  });
});
