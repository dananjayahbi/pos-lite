import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "velvetpos",
  project: process.env.SENTRY_PROJECT || "velvetpos",
  silent: process.env.NODE_ENV === "production",
  sourcemaps: { disable: true },
});
