import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // DEBUG: temporairement à 100% pour vérifier que tout arrive
  tracesSampleRate: 1.0,

  // Session Replay : 100% temporairement pour tester
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],

  // Actif en production
  enabled: process.env.NODE_ENV === "production",

  // Debug: affiche dans la console si Sentry envoie bien
  debug: true,

  // Filtrer les erreurs de bruit
  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection",
    "AbortError",
    "Network request failed",
  ],

  environment: process.env.NODE_ENV,
});
