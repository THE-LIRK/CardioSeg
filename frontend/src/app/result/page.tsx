"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { CONFIG } from "@/lib/config";
import { FadeIn, StaggerContainer, StaggerItem, AnimatedButton } from "@/components/Animations";
import { PulsingHeart } from "@/components/HeartAnimation";

const NiivueViewer = dynamic(() => import("@/components/NiivueViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
        <p className="text-sm text-gray-400">Chargement du viewer...</p>
      </div>
    </div>
  ),
});

interface SegResult {
  downloadUrl: string;
  originalUrl?: string;
  fileName: string;
  originalName?: string;
  originalSize: number;
  resultSize: number;
  processingTime: string;
}

export default function ResultPage() {
  const [result, setResult] = useState<SegResult | null>(null);
  const [viewerMode, setViewerMode] = useState<"off" | "2d" | "3d">("off");

  useEffect(() => {
    const stored = sessionStorage.getItem("segResult");
    if (stored) {
      setResult(JSON.parse(stored));
    }
  }, []);

  if (!result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 pt-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <PulsingHeart size={80} />
          <h1 className="mb-2 mt-4 text-2xl font-bold">Aucun résultat</h1>
          <p className="mb-6 text-gray-400">
            Lancez d&apos;abord une segmentation pour voir les résultats.
          </p>
          <AnimatedButton className="rounded-xl bg-red-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-red-700">
            <Link href="/upload">Lancer une segmentation</Link>
          </AnimatedButton>
        </motion.div>
      </div>
    );
  }

  const labels = Object.entries(CONFIG.CARDIAC_LABELS) as [
    string,
    { name: string; color: string }
  ][];

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = result.downloadUrl;
    a.download = result.fileName;
    a.click();
  };

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 pt-24">
      {/* Header */}
      <FadeIn>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Résultat de segmentation</h1>
            <p className="mt-1 text-gray-400">
              Pipeline terminé en {result.processingTime}
            </p>
          </div>
          <div className="flex gap-3">
            <AnimatedButton className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500">
              <Link href="/upload">Nouvelle segmentation</Link>
            </AnimatedButton>
            <AnimatedButton
              onClick={handleDownload}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Télécharger .nii.gz
            </AnimatedButton>
          </div>
        </div>
      </FadeIn>

      {/* Stats */}
      <StaggerContainer className="mb-8 grid grid-cols-3 gap-4" staggerDelay={0.1}>
        <StaggerItem>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-sm text-gray-400">Fichier original</p>
            <p className="mt-1 text-lg font-semibold">
              {(result.originalSize / (1024 * 1024)).toFixed(1)} Mo
            </p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-sm text-gray-400">Masque résultat</p>
            <p className="mt-1 text-lg font-semibold">
              {(result.resultSize / 1024).toFixed(0)} Ko
            </p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-sm text-gray-400">Temps de traitement</p>
            <p className="mt-1 text-lg font-semibold">{result.processingTime}</p>
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* Viewer */}
      <FadeIn delay={0.2}>
        {viewerMode === "off" ? (
          <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-8">
            <div className="text-center">
              <h2 className="mb-2 text-lg font-semibold">Visualisation</h2>
              <p className="mb-6 text-sm text-gray-400">
                Choisissez un mode adapté à votre machine
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setViewerMode("2d")}
                  className="group rounded-xl border border-gray-700 bg-gray-800 px-6 py-5 text-left transition-all hover:border-red-500"
                >
                  <div className="mb-2 text-2xl">🖼️</div>
                  <p className="font-semibold text-white">Coupes 2D</p>
                  <p className="mt-1 text-xs text-gray-400">Axial · Coronal · Sagittal</p>
                  <p className="mt-2 text-xs text-green-400">✓ Léger — recommandé</p>
                </button>
                <button
                  onClick={() => setViewerMode("3d")}
                  className="group rounded-xl border border-gray-700 bg-gray-800 px-6 py-5 text-left transition-all hover:border-red-500"
                >
                  <div className="mb-2 text-2xl">🧊</div>
                  <p className="font-semibold text-white">Vue 3D</p>
                  <p className="mt-1 text-xs text-gray-400">Rendu volumique interactif</p>
                  <p className="mt-2 text-xs text-yellow-400">⚠ Nécessite un bon GPU</p>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => setViewerMode("off")}
                className="text-xs text-gray-400 transition-colors hover:text-white"
              >
                ← Changer de mode
              </button>
              {viewerMode === "2d" && (
                <button
                  onClick={() => setViewerMode("3d")}
                  className="rounded-md border border-yellow-600/50 bg-yellow-900/20 px-3 py-1.5 text-xs text-yellow-400 transition-colors hover:bg-yellow-900/40"
                >
                  🧊 Activer la vue 3D
                </button>
              )}
              {viewerMode === "3d" && (
                <button
                  onClick={() => setViewerMode("2d")}
                  className="rounded-md border border-green-600/50 bg-green-900/20 px-3 py-1.5 text-xs text-green-400 transition-colors hover:bg-green-900/40"
                >
                  🖼️ Revenir en 2D (plus léger)
                </button>
              )}
            </div>
            <NiivueViewer
              key={viewerMode}
              originalUrl={result.originalUrl}
              segmentationUrl={result.downloadUrl}
              initialMode={viewerMode === "3d" ? "3d" : "multiplanar"}
            />
          </div>
        )}
      </FadeIn>

      {/* Structures détectées */}
      <FadeIn delay={0.3}>
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 font-semibold">Structures segmentées</h2>
        <StaggerContainer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.08}>
          {labels.map(([value, info]) => (
            <StaggerItem key={value}>
              <motion.div
                className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-950 p-3"
                whileHover={{ scale: 1.05, borderColor: info.color }}
              >
                <motion.div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: info.color }}
                  whileHover={{ scale: 1.5 }}
                />
                <div>
                  <p className="text-sm font-medium">{info.name}</p>
                  <p className="text-xs text-gray-500">Label {value}</p>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
      </FadeIn>

      {/* Instructions */}
      <FadeIn delay={0.4}>
      <div className="my-8 rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-3 font-semibold">Comment visualiser le résultat</h2>
        <ol className="space-y-2 text-sm text-gray-400">
          <li>
            1. Téléchargez le fichier <code className="text-gray-300">.nii.gz</code>
          </li>
          <li>
            2. Ouvrez-le dans{" "}
            <a
              href="https://www.slicer.org/"
              target="_blank"
              className="text-red-400 hover:text-red-300"
            >
              3D Slicer
            </a>{" "}
            ou{" "}
            <a
              href="http://www.itksnap.org/"
              target="_blank"
              className="text-red-400 hover:text-red-300"
            >
              ITK-SNAP
            </a>
          </li>
          <li>
            3. Superposez-le sur votre image originale pour visualiser la
            segmentation
          </li>
        </ol>
      </div>
      </FadeIn>
    </div>
  );
}
