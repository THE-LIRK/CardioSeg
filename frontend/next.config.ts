import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

export default withSentryConfig(nextConfig, {
  // Upload automatique des source maps pour un meilleur stack trace
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source maps : ne pas les exposer en prod
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Tunnel Sentry pour contourner les ad-blockers
  tunnelRoute: "/monitoring",

  // Tree-shaking automatique du SDK
  widenClientFileUpload: true,
});
