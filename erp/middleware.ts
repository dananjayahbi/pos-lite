import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * JWE decryption using only Web Crypto API (zero dependencies).
 * NextAuth v5 encrypts JWTs as JWE (JSON Web Encryption) with:
 *   - alg: "dir" (direct encryption)
 *   - enc: "A256CBC-HS512" (AES-256-CBC + HMAC-SHA-512)
 *
 * This implementation is a minimal, self-contained replacement for the
 * `decode()` function from `@auth/core/jwt`, targeting Vercel's Edge Runtime.
 */

// ── Base64URL helpers ──────────────────────────────────────────────────────

function b64uToBytes(b64u: string): Uint8Array {
  return new Uint8Array(
    Uint8Array.from(
      atob(b64u.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    ),
  );
}

function bytesToB64u(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ── JWE structure parsing / decryption ─────────────────────────────────────

async function deriveEncryptionKey(
  keyMaterial: string,
  salt: string,
  length: number,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(keyMaterial);

  const importedKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(keyBytes),
    { name: 'HKDF' },
    false,
    ['deriveBits'],
  );

  const info = enc.encode(`Auth.js Generated Encryption Key (${salt})`);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode(salt),
      info,
    },
    importedKey,
    length * 8,
  );

  return new Uint8Array(derivedBits);
}

// ── JWE decryption ─────────────────────────────────────────────────────────

async function decryptA256CbcHs512(
  encryptionKey: Uint8Array,
  headerB64: string, // base64url-encoded JWE Protected Header
  iv: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array,
): Promise<Uint8Array | null> {
  // The 64-byte CEK is split: first 32 for HMAC-SHA-512, last 32 for AES-256-CBC
  const macKey = encryptionKey.slice(0, 32);
  const encKey = encryptionKey.slice(32, 64);

  // Additional Authenticated Data: ASCII of the base64url-encoded header
  const aad = new TextEncoder().encode(headerB64);

  // AAD length in bits as 64-bit big-endian
  const al = new Uint8Array(8);
  new DataView(al.buffer).setBigUint64(0, BigInt(aad.length * 8), false);

  // HMAC input: AAD || IV || ciphertext || AL
  const hmacInput = new Uint8Array(aad.length + iv.length + ciphertext.length + 8);
  hmacInput.set(aad, 0);
  hmacInput.set(iv, aad.length);
  hmacInput.set(ciphertext, aad.length + iv.length);
  hmacInput.set(al, aad.length + iv.length + ciphertext.length);

  const hmacKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(macKey),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );

  const computedTag = new Uint8Array(
    await crypto.subtle.sign('HMAC', hmacKey, hmacInput),
  );
  // Authentication tag is the first half (16 bytes) of the HMAC output
  const halfTag = computedTag.slice(0, 16);

  // Constant-time comparison
  if (halfTag.length !== tag.length) return null;
  let diff = 0;
  for (let i = 0; i < tag.length; i++) {
    diff |= (halfTag[i] ?? 0) ^ (tag[i] ?? 0);
  }
  if (diff !== 0) return null;

  // AES-256-CBC decryption
  const aesKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(encKey),
    { name: 'AES-CBC', length: 256 },
    false,
    ['decrypt'],
  );

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: new Uint8Array(iv) },
      aesKey,
      new Uint8Array(ciphertext),
    );
    return new Uint8Array(decrypted);
  } catch {
    return null;
  }
}

async function decryptToken(
  token: string,
  secret: string,
  salt: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split('.');
  if (parts.length !== 5) return null;

  const headerB64 = parts[0]!;
  let header: Record<string, string>;
  try {
    header = JSON.parse(new TextDecoder().decode(b64uToBytes(headerB64)));
  } catch {
    return null;
  }

  const iv = b64uToBytes(parts[2]!);
  const ciphertext = b64uToBytes(parts[3]!);
  const tag = b64uToBytes(parts[4]!);

  const enc = header.enc ?? 'A256CBC-HS512';

  let keyLength: number;
  switch (enc) {
    case 'A256CBC-HS512':
      keyLength = 64;
      break;
    case 'A256GCM':
      keyLength = 32;
      break;
    default:
      return null;
  }

  const encryptionKey = await deriveEncryptionKey(secret, salt, keyLength);

  let plaintext: Uint8Array | null = null;

  if (enc === 'A256CBC-HS512') {
    plaintext = await decryptA256CbcHs512(encryptionKey, headerB64, iv, ciphertext, tag);
  } else if (enc === 'A256GCM') {
    // A256GCM uses the full key for AES-GCM
    try {
      const aesGcmKey = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(encryptionKey),
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt'],
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv), tagLength: 128 },
        aesGcmKey,
        new Uint8Array(ciphertext),
      );
      plaintext = new Uint8Array(decrypted);
    } catch {
      return null;
    }
  }

  if (!plaintext) return null;

  try {
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  }
}

// ── In-memory caches ───────────────────────────────────────────────────────

interface SessionVersionCacheEntry {
  sessionVersion: number;
  cachedAt: number;
}

const SESSION_VERSION_CACHE_TTL_MS = 5_000;
const sessionVersionCache = new Map<string, SessionVersionCacheEntry>();
const tenantSlugCache = new Map<string, boolean>();

const TENANT_DOMAIN_SUFFIX = '.ayurpos.com';
const RESERVED_SUBDOMAINS = new Set(['', 'www', 'app']);

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/pin-login',
  '/forgot-password',
  '/reset-password',
  '/api/auth/',
  '/api/webhooks/',
  '/api/public/',
  '/status',
  '/api/health',
  '/site',
  '/_next',
  '/fonts',
  '/icons',
  '/images',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isStorePath(pathname: string): boolean {
  if (pathname.startsWith('/superadmin')) return false;
  if (pathname.startsWith('/api')) return false;
  return !isPublicPath(pathname);
}

function isSuspensionBypassPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('/suspended') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/manifest')
  );
}

function clearSessionCookies(response: NextResponse): void {
  response.cookies.delete('authjs.session-token');
  response.cookies.delete('__Secure-authjs.session-token');
  response.cookies.delete('next-auth.session-token');
  response.cookies.delete('__Secure-next-auth.session-token');
}

function getCachedSessionVersion(userId: string): number | null {
  const cached = sessionVersionCache.get(userId);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > SESSION_VERSION_CACHE_TTL_MS) {
    sessionVersionCache.delete(userId);
    return null;
  }
  return cached.sessionVersion;
}

function setCachedSessionVersion(userId: string, sessionVersion: number): void {
  sessionVersionCache.set(userId, { sessionVersion, cachedAt: Date.now() });
}

interface SessionUser {
  id: string;
  role: string;
  tenantId: string | null;
  sessionVersion: number;
}

async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  // AUTH_SECRET / NEXTAUTH_SECRET must be defined in Vercel environment variables.
  // At build time, Next.js inlines the value. At runtime on Edge, process.env
  // still works for env vars that were available at build time.
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  let tokenValue: string | undefined;
  let cookieName: string | undefined;

  for (const name of [
    '__Secure-authjs.session-token',
    'authjs.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.session-token',
  ]) {
    const val = request.cookies.get(name)?.value;
    if (val) {
      tokenValue = val;
      cookieName = name;
      break;
    }
  }

  if (!tokenValue || !cookieName) return null;

  const payload = await decryptToken(tokenValue, secret, cookieName);
  if (!payload) return null;

  const id = (payload.id ?? payload.sub) as string | undefined;
  if (!id) return null;

  return {
    id,
    role: (payload.role as string) ?? 'UNKNOWN',
    tenantId: (payload.tenantId as string | null) ?? null,
    sessionVersion: (payload.sessionVersion as number) ?? 0,
  };
}

async function middlewareApi(
  request: NextRequest,
  body: Record<string, unknown>,
): Promise<Response> {
  const apiUrl = new URL('/api/internal/middleware', request.url);
  return fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Middleware handler ─────────────────────────────────────────────────────

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const user = await getSessionUser(request);
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/superadmin') && user.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (user.role === 'SUPER_ADMIN' && isStorePath(pathname)) {
    return NextResponse.redirect(new URL('/superadmin/dashboard', request.url));
  }

  const userId = user.id;
  const tokenSessionVersion = user.sessionVersion;

  if (userId) {
    let dbSessionVersion = getCachedSessionVersion(userId);

    if (dbSessionVersion === null) {
      const res = await middlewareApi(request, {
        action: 'checkSessionVersion',
        userId,
      });

      if (res.ok) {
        const data = await res.json();
        dbSessionVersion = data.sessionVersion;
        if (typeof dbSessionVersion === 'number') {
          setCachedSessionVersion(userId, dbSessionVersion);
        }
      }
    }

    if (
      typeof dbSessionVersion === 'number' &&
      typeof tokenSessionVersion === 'number' &&
      dbSessionVersion > tokenSessionVersion
    ) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('sessionExpired', 'true');

      const response = NextResponse.redirect(loginUrl);
      clearSessionCookies(response);

      middlewareApi(request, {
        action: 'createAuditLog',
        tenantId: user.tenantId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'User',
        entityId: user.id,
        auditAction: 'SESSION_INVALIDATED_BY_VERSION_MISMATCH',
        ipAddress: request.headers.get('x-forwarded-for') ?? 'unknown',
        userAgent: request.headers.get('user-agent') ?? undefined,
      }).catch(() => {});

      return response;
    }
  }

  if (!user.tenantId || isSuspensionBypassPath(pathname)) {
    return NextResponse.next();
  }

  if (isStorePath(pathname)) {
    const res = await middlewareApi(request, {
      action: 'checkTenantStatus',
      tenantId: user.tenantId,
    });

    if (res.ok) {
      const tenant = await res.json();
      if (tenant && tenant.deletedAt !== null) {
        return NextResponse.next();
      }
      if (user.role !== 'SUPER_ADMIN' && tenant?.status === 'SUSPENDED') {
        return NextResponse.redirect(new URL('/suspended', request.url));
      }
    }
  }

  const hostHeader = request.headers.get('host');
  const hostname = hostHeader?.split(':')[0] ?? '';
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-tenant-slug');

  if (hostname.endsWith(TENANT_DOMAIN_SUFFIX)) {
    const slug = hostname.slice(0, -TENANT_DOMAIN_SUFFIX.length);

    if (!RESERVED_SUBDOMAINS.has(slug)) {
      let exists = tenantSlugCache.get(slug);

      if (exists === undefined) {
        const res = await middlewareApi(request, {
          action: 'checkTenantSlug',
          slug,
        });

        if (res.ok) {
          const data = await res.json();
          exists = data.exists === true;
          tenantSlugCache.set(slug, exists);
        } else {
          exists = false;
        }
      }

      if (exists) {
        requestHeaders.set('x-tenant-slug', slug);
        return NextResponse.next({ request: { headers: requestHeaders } });
      }

      if (process.env.NODE_ENV === 'production') {
        return NextResponse.redirect(
          new URL('https://ayurpos.com/not-found'),
        );
      }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    const devSlug = request.headers.get('x-tenant-slug');
    if (devSlug) {
      return NextResponse.next();
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/|api/internal/|.*\\..*).*)',
  ],
};
