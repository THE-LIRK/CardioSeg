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
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 pt-16 text-gray-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <PulsingHeart size={80} />
          <h1 className="mb-2 mt-4 text-2xl font-bold">Aucun résultat</h1>
          <p className="mb-6 text-gray-700">
            Lancez d&apos;abord une segmentation pour voir les résultats.
          </p>
          <Link href="/upload" className="inline-block rounded-xl bg-blue-700 px-8 py-3 font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Lancer une segmentation</Link>
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
    <div className="bg-white text-gray-900">
    <div className="mx-auto min-h-screen max-w-4xl px-6 pt-24">
      {/* Header */}
      <FadeIn>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Résultat de segmentation</h1>
            <p className="mt-1 text-gray-700">
              Pipeline terminé en {result.processingTime}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/upload" className="inline-block rounded-lg border border-gray-600 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Nouvelle segmentation</Link>
            <AnimatedButton
              onClick={handleDownload}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Télécharger .nii.gz
            </AnimatedButton>
          </div>
        </div>
      </FadeIn>

      {/* Stats */}
      <StaggerContainer className="mb-8 grid grid-cols-3 gap-4" staggerDelay={0.1}>
        <StaggerItem>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-white">
            <p className="text-sm text-gray-300">Fichier original</p>
            <p className="mt-1 text-lg font-bold text-white">
              {(result.originalSize / (1024 * 1024)).toFixed(1)} Mo
            </p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-white">
            <p className="text-sm text-gray-300">Masque résultat</p>
            <p className="mt-1 text-lg font-bold text-white">
              {(result.resultSize / 1024).toFixed(0)} Ko
            </p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-white">
            <p className="text-sm text-gray-300">Temps de traitement</p>
            <p className="mt-1 text-lg font-bold text-white">{result.processingTime}</p>
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* Viewer */}
      <FadeIn delay={0.2}>
        {viewerMode === "off" ? (
          <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-8 text-white">
            <div className="text-center">
              <h2 className="mb-2 text-lg font-semibold text-white">Visualisation</h2>
              <p className="mb-6 text-sm text-gray-300">
                Choisissez un mode adapté à votre machine
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setViewerMode("2d")}
                  className="group rounded-xl border border-gray-500 bg-gray-800 px-6 py-5 text-left text-white transition-all hover:border-blue-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <div className="mb-2 text-2xl">🖼️</div>
                  <p className="font-semibold text-white">Coupes 2D</p>
                  <p className="mt-1 text-xs text-gray-300">Axial · Coronal · Sagittal</p>
                  <p className="mt-2 text-xs text-green-400">✓ Léger — recommandé</p>
                </button>
                <button
                  onClick={() => setViewerMode("3d")}
                  className="group rounded-xl border border-gray-500 bg-gray-800 px-6 py-5 text-left text-white transition-all hover:border-blue-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <div className="mb-2 text-2xl">🧊</div>
                  <p className="font-semibold text-white">Vue 3D</p>
                  <p className="mt-1 text-xs text-gray-300">Rendu volumique interactif</p>
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
                className="text-sm text-gray-700 underline transition-colors hover:text-gray-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                ← Changer de mode
              </button>
              {viewerMode === "2d" && (
                <button
                  onClick={() => setViewerMode("3d")}
                  className="rounded-md border border-gray-900 bg-gray-900 px-3 py-1.5 text-xs font-medium text-yellow-300 transition-colors hover:bg-gray-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  🧊 Activer la vue 3D
                </button>
              )}
              {viewerMode === "3d" && (
                <button
                  onClick={() => setViewerMode("2d")}
                  className="rounded-md border border-gray-900 bg-gray-900 px-3 py-1.5 text-xs font-medium text-green-300 transition-colors hover:bg-gray-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
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
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-white">
        <h2 className="mb-4 font-semibold text-white">Structures segmentées</h2>
        <StaggerContainer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.08}>
          {labels.map(([value, info]) => (
            <StaggerItem key={value}>
              <motion.div
                className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-950 p-3 text-white"
                whileHover={{ scale: 1.05, borderColor: info.color }}
              >
                <motion.div
                  className="h-4 w-4 rounded-full ring-1 ring-white/70"
                  style={{ backgroundColor: info.color }}
                  whileHover={{ scale: 1.5 }}
                />
                <div>
                  <p className="text-sm font-medium text-white">{info.name}</p>
                  <p className="text-xs text-gray-300">Label {value}</p>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
      </FadeIn>

      {/* Instructions */}
      <FadeIn delay={0.4}>
      <div className="my-8 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-white">
        <h2 className="mb-3 font-semibold text-white">Comment visualiser le résultat</h2>
        <ol className="space-y-2 text-sm text-gray-400">
          <li>
            1. Téléchargez le fichier <code className="text-gray-300">.nii.gz</code>
          </li>
          <li>
            2. Ouvrez-le dans{" "}
            <a
              href="https://www.slicer.org/"
              target="_blank" rel="noopener noreferrer"
              className="text-blue-300 underline hover:text-blue-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              3D Slicer
            </a>{" "}
            ou{" "}
            <a
              href="http://www.itksnap.org/"
              target="_blank" rel="noopener noreferrer"
              className="text-blue-300 underline hover:text-blue-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
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
    </div>
  );
}
