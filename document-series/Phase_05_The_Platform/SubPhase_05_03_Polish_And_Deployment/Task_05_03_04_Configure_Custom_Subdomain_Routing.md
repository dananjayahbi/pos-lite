# Task 05.03.04 — Configure Custom Subdomain Routing

## Metadata

| Field | Value |
|---|---|
| Task ID | 05.03.04 |
| Task Name | Configure Custom Subdomain Routing |
| SubPhase | 05.03 — Production Deployment and Polish |
| Complexity | Medium |
| Estimated Duration | 2–3 hours |
| Assignee Role | Lead Developer |
| Dependencies | Tenant model in Prisma schema, existing src/middleware.ts |
| Output Files | src/middleware.ts (updated), Vercel DNS configuration documented |

## Objective

Update the VelvetPOS middleware so that requests arriving at tenant.velvetpos.com are automatically resolved to the correct tenant context. The middleware extracts the subdomain slug from the incoming hostname, validates it against the Tenant database table, and injects the resolved tenant identity into downstream request headers so that all route handlers and server components can read the current tenant without parsing the URL themselves. Document the Vercel DNS wildcard configuration required to make subdomain routing work in production.

## Instructions

**Step 1: Read the Hostname from the Incoming Request**

Open src/middleware.ts. Inside the exported middleware function, read the incoming hostname by calling req.headers.get("host") and storing the result in a hostHeader variable. If hostHeader is null or an empty string, skip the subdomain extraction logic and continue the middleware chain with NextResponse.next(). Strip any port suffix by splitting the hostHeader on the colon character ":" and taking the first element, storing the result in a hostname variable. This ensures the logic works correctly in local development where the host header typically includes a port such as ":3000".

**Step 2: Extract the Tenant Slug from the Subdomain**

Check whether the hostname ends with the string ".velvetpos.com" using the String.prototype.endsWith method. If the condition is true, compute the subdomain prefix by removing the ".velvetpos.com" suffix: use hostname.slice(0, hostname.length - ".velvetpos.com".length). Store the result in a slug variable. If the slug is an empty string, or equals "www", or equals "app", treat this as a root domain request (no tenant context) and continue the middleware chain normally. These reserved prefixes should not resolve to a tenant. If the condition from endsWith is false (the request arrived via localhost, a custom domain, or an IP address), proceed to the local development fallback described in Step 5.

**Step 3: Validate the Tenant Slug with an In-Memory Cache**

Performing a full Prisma database query inside middleware for every HTTP request would add unacceptable latency to every page load. Implement a module-scoped Map&lt;string, boolean&gt; variable named tenantSlugCache at the top of middleware.ts (outside the middleware function). When a slug is extracted, check whether tenantSlugCache.has(slug). If the cache contains the slug, read its boolean value directly. If the slug is not cached, import the Prisma client and call prisma.tenant.findFirst with a where clause matching slug equal to the extracted value and select only the id field to minimise the data returned. Store the boolean result (whether the record was found) in the cache using tenantSlugCache.set(slug, found). The cache is unbounded in this implementation — a production-grade follow-up would apply a TTL using a timestamp-keyed entry or migrate to an edge-compatible Redis cache.

**Step 4: Inject the Tenant Slug into Downstream Headers**

If the slug is found (cache value is true), attach it to the outgoing request headers. Create a modified headers object by cloning the incoming request headers with new Headers(req.headers). Call modifiedHeaders.set("X-Tenant-Slug", slug) to add the tenant identifier. Pass this modified headers object to NextResponse.next({ request: { headers: modifiedHeaders } }) and return the result. All downstream Server Components, Route Handlers, and API routes can now read the tenant by calling headers().get("X-Tenant-Slug") from next/headers without needing to parse the URL or accept the slug as a path parameter.

**Step 5: Handle Invalid Slugs and Local Development Fallback**

If the extracted slug is not found in the database (cache value is false) and the current NODE_ENV is "production", return NextResponse.redirect(new URL("/not-found", "https://velvetpos.com")). This redirects visitors who navigate to a mistyped or inactive subdomain to a friendly error page instead of showing a generic Next.js 404.

For local development and staging environments, the middleware applies a header-based fallback. After the hostname slug extraction fails or the host is not "*.velvetpos.com", check whether the incoming request already carries an X-Tenant-Slug header (req.headers.get("X-Tenant-Slug")). If present, pass it through unchanged. This allows developers to work locally on http://localhost:3000 by manually injecting the X-Tenant-Slug header using browser DevTools network request overrides, a Requestly browser extension, or a custom local proxy script. Document this workflow in the project README under the "Local Development" section with the instruction: "Set X-Tenant-Slug to your demo tenant slug via a browser request override when testing tenant-specific pages locally."

**Step 6: Document Vercel DNS Wildcard Configuration**

In your DNS provider's control panel (e.g., Cloudflare, Hetzner, Route 53), create a CNAME record with the name set to the single asterisk wildcard character "*" and the value pointing to cname.vercel-dns.com. This CNAME applies to all single-level subdomains of velvetpos.com — so tenant.velvetpos.com, demo.velvetpos.com, and acme-boutique.velvetpos.com all resolve to Vercel's edge network through the same single DNS record. In the Vercel project settings under Domains, add the custom domain *.velvetpos.com. Vercel automatically provisions TLS certificates for all matching subdomains via Let's Encrypt through its own certificate authority integration. The wildcard CNAME applies only to one level of subdomain nesting — a hostname like sub.tenant.velvetpos.com would not be covered and is not a supported pattern.

**Step 7: Add the Middleware Matcher Configuration**

Ensure the exported config object at the bottom of middleware.ts includes a matcher array that captures all routes that should run through the middleware. The matcher should use a negative lookahead pattern to exclude Next.js internals (_next/static, _next/image, favicon.ico) while matching all other routes. The subdomain extraction and tenant injection logic must run on every routable request, including API routes, so that handlers under /api/[tenantSlug]/ can reliably read X-Tenant-Slug from request headers.

## Expected Output

- src/middleware.ts — Updated with hostname-based subdomain extraction, in-memory tenant slug cache, X-Tenant-Slug header injection, production redirect for invalid slugs, and local dev header fallback

## Validation

- [ ] Visiting tenant.velvetpos.com in a production-like environment (or via a Vercel Preview deployment with a test subdomain) resolves to the correct tenant context
- [ ] The X-Tenant-Slug request header is available inside a Route Handler via headers().get("X-Tenant-Slug") after middleware runs
- [ ] Requesting www.velvetpos.com or velvetpos.com does not trigger the tenant extraction logic and proceeds without X-Tenant-Slug injection
- [ ] Requesting an unregistered slug (e.g., notarealshop.velvetpos.com) in production mode returns a redirect to https://velvetpos.com/not-found
- [ ] Middleware runs in under 10 milliseconds on a warm cache hit (no Prisma query is issued for a previously resolved slug)
- [ ] Local development works on http://localhost:3000 by injecting X-Tenant-Slug via browser DevTools request override
- [ ] The Vercel wildcard CNAME record is documented in ENV_VARS_CHECKLIST.md with exact DNS record syntax

## Notes

- The in-memory module-scope cache in middleware.ts is shared across all serverless function instances only within the same warm instance. In a high-traffic scaled-out Vercel deployment, different instances maintain independent caches. This is acceptable behaviour — the worst case is an extra Prisma query per cold start. It is not a consistency risk because tenant slugs are immutable once created.
- For enhanced security, never allow the X-Tenant-Slug header to be passed through by the middleware when it originates from an external client request. At the top of the middleware, strip any incoming X-Tenant-Slug headers from the request before injecting the middleware-verified value. Add a line calling req.headers.delete("X-Tenant-Slug") before the injection step to prevent header spoofing by malicious callers.
