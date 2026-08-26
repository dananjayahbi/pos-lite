// Empty stub for the 'server-only' package when running unit tests under vitest.
// In a bundler 'server-only' throws if imported from a client bundle; in tests
// we want it to be a no-op so modules that import it can be exercised directly.
export {};
