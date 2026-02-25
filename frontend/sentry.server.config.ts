import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance : capturer 20% des transactions côté serveur
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Ne pas envoyer en dev local
  enabled: process.env.NODE_ENV === "production",

  environment: process.env.NODE_ENV,
});
