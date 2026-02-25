"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center px-6">
          <div className="text-6xl mb-4">💔</div>
          <h1 className="text-2xl font-bold mb-2">Erreur inattendue</h1>
          <p className="text-gray-400 mb-6 max-w-md">
            Une erreur est survenue. Notre équipe a été notifiée automatiquement.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Réessayer
            </button>
            <Link
              href="/"
              className="rounded-lg border border-gray-700 px-6 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
