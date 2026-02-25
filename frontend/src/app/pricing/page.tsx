"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CONFIG } from "@/lib/config";
import { FadeIn, AnimatedButton, StaggerContainer, StaggerItem } from "@/components/Animations";
import { PulsingHeart } from "@/components/HeartAnimation";
import { useAuth } from "@/components/AuthProvider";

export default function PricingPage() {
  const { user } = useAuth();
  const [loadingPack, setLoadingPack] = useState<string | null>(null);

  const handleBuy = async (priceId: string, packId: string) => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }

    setLoadingPack(packId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          userId: user.id,
          userEmail: user.email,
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Erreur lors de la création du paiement");
      }
    } catch {
      alert("Erreur de connexion");
    } finally {
      setLoadingPack(null);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 pt-24 pb-16">
      {/* Header */}
      <FadeIn>
        <div className="mb-4 text-center">
          <PulsingHeart size={60} />
          <h1 className="mt-4 text-4xl font-bold">Crédits de segmentation</h1>
          <p className="mt-3 text-lg text-gray-400">
            2 segmentations gratuites par mois, puis achetez des crédits
          </p>
        </div>
      </FadeIn>

      {/* Free tier */}
      <FadeIn delay={0.1}>
        <div className="mx-auto mb-12 max-w-md rounded-2xl border border-green-500/30 bg-green-500/5 p-6 text-center">
          <div className="mb-2 text-2xl font-bold text-green-400">Gratuit</div>
          <p className="text-gray-300">
            <span className="text-3xl font-bold text-white">2</span>{" "}
            segmentations / mois
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Aucune carte bancaire requise
          </p>
          <AnimatedButton className="mt-4 rounded-lg border border-green-500/50 px-6 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/10">
            <Link href={user ? "/upload" : "/auth"}>
              {user ? "Commencer" : "Créer un compte"}
            </Link>
          </AnimatedButton>
        </div>
      </FadeIn>

      {/* Divider */}
      <div className="mb-12 flex items-center gap-4">
        <div className="h-px flex-1 bg-gray-800" />
        <span className="text-sm text-gray-500">Besoin de plus ?</span>
        <div className="h-px flex-1 bg-gray-800" />
      </div>

      {/* Packs */}
      <StaggerContainer
        className="grid gap-6 md:grid-cols-3"
        staggerDelay={0.15}
      >
        {CONFIG.CREDIT_PACKS.map((pack) => (
          <StaggerItem key={pack.id}>
            <motion.div
              whileHover={{ y: -5 }}
              className={`relative rounded-2xl border p-6 transition-colors ${
                pack.popular
                  ? "border-red-500/50 bg-red-500/5"
                  : "border-gray-800 bg-gray-900"
              }`}
            >
              {pack.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-4 py-1 text-xs font-semibold text-white">
                  Populaire
                </div>
              )}

              <div className="mb-4 text-center">
                <h3 className="text-lg font-semibold">{pack.name}</h3>
                <div className="mt-2">
                  <span className="text-4xl font-bold">{pack.price}€</span>
                </div>
                <p className="mt-1 text-sm text-gray-400">
                  {pack.credits} segmentations
                </p>
                <p className="text-xs text-gray-500">
                  {(pack.price / pack.credits).toFixed(2)}€ / segmentation
                </p>
              </div>

              <ul className="mb-6 space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  {pack.credits} crédits de segmentation
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  GPU NVIDIA A10G
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  7 structures cardiaques
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  Viewer 3D intégré
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  Crédits sans expiration
                </li>
              </ul>

              <AnimatedButton
                onClick={() => handleBuy(pack.priceId, pack.id)}
                disabled={loadingPack === pack.id}
                className={`w-full rounded-lg py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  pack.popular
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {loadingPack === pack.id
                  ? "Redirection..."
                  : `Acheter ${pack.credits} crédits`}
              </AnimatedButton>
            </motion.div>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* FAQ */}
      <FadeIn delay={0.5}>
        <div className="mt-16 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Questions fréquentes</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-gray-200">
                Les crédits gratuits se cumulent-ils ?
              </p>
              <p className="mt-1 text-gray-400">
                Non, les 2 crédits gratuits sont remis à zéro chaque mois.
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-200">
                Les crédits achetés expirent-ils ?
              </p>
              <p className="mt-1 text-gray-400">
                Non, les crédits achetés n&apos;expirent jamais.
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-200">
                Quels formats sont acceptés ?
              </p>
              <p className="mt-1 text-gray-400">
                Fichiers NIfTI (.nii et .nii.gz) — IRM cardiaques.
              </p>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
