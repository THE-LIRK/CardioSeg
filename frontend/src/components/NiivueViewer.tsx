"use client";

import { useEffect, useRef, useState } from "react";

type ViewMode = "multiplanar" | "axial" | "coronal" | "sagittal" | "3d";

interface NiivueViewerProps {
  originalUrl?: string;
  segmentationUrl: string;
  initialMode?: ViewMode;
}

// ColorMap cardiaque pour les 10 labels (0-9)
// Format natif Niivue : R, G, B, A, I arrays
// Label 0 = background transparent (A=0), labels 1-7 = structures cardiaques, 8-9 = coronaires
// Ordre des classes (MM-WHS) : 4 = 550 = oreillette droite, 5 = 600 = ventricule droit
const CARDIAC_COLORMAP = {
  R: [0, 239, 59, 234, 34, 168, 249, 6, 163, 255],
  G: [0, 68, 130, 179, 197, 85, 115, 182, 230, 100],
  B: [0, 68, 246, 8, 94, 247, 22, 212, 53, 255],
  A: [0, 255, 255, 255, 255, 255, 255, 255, 255, 255],
  I: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  labels: [
    "Background",
    "Myocarde VG",
    "Oreillette gauche",
    "Ventricule gauche",
    "Oreillette droite",
    "Ventricule droit",
    "Aorte ascendante",
    "Artère pulmonaire",
    "Coronaire gauche",
    "Coronaire droite",
  ],
};

export default function NiivueViewer({
  originalUrl,
  segmentationUrl,
  initialMode = "multiplanar",
}: NiivueViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nvRef = useRef<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [opacity, setOpacity] = useState(0.7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    const init = async () => {
      try {
        const { Niivue } = await import("@niivue/niivue");
        if (cancelled) return;

        const nv = new Niivue({
          backColor: [0.05, 0.05, 0.1, 1],
          show3Dcrosshair: true,
          crosshairColor: [1, 0, 0, 0.5],
        });

        nv.attachToCanvas(canvasRef.current!);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const volumes: any[] = [];
        if (originalUrl) {
          volumes.push({
            url: originalUrl,
            name: "original.nii.gz",
            colormap: "gray",
            opacity: 1,
          });
        }
        volumes.push({
          url: segmentationUrl,
          name: "segmentation.nii.gz",
          colormap: "gray",
          opacity: opacity,
          cal_min: 0,
          cal_max: 9,
          colormapLabel: CARDIAC_COLORMAP,
        });

        await nv.loadVolumes(volumes);

        // Forcer l'application du LUT après chargement (sécurité)
        const segIdx = originalUrl ? 1 : 0;
        if (nv.volumes[segIdx]) {
          nv.volumes[segIdx].setColormapLabel(CARDIAC_COLORMAP);
          nv.updateGLVolume();
        }

        if (!cancelled) {
          nvRef.current = nv;
          applyViewMode(nv, viewMode);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Erreur chargement du viewer 3D");
          setLoading(false);
          console.error("Niivue error:", err);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentationUrl, originalUrl]);

  useEffect(() => {
    if (nvRef.current) applyViewMode(nvRef.current, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (nvRef.current && nvRef.current.volumes.length > 0) {
      const segIdx = originalUrl ? 1 : 0;
      if (nvRef.current.volumes[segIdx]) {
        nvRef.current.volumes[segIdx].opacity = opacity;
        nvRef.current.updateGLVolume();
      }
    }
  }, [opacity, originalUrl]);

  // Toggle affichage du volume original (le scanner)
  useEffect(() => {
    if (nvRef.current && originalUrl && nvRef.current.volumes.length > 1) {
      nvRef.current.volumes[0].opacity = showOriginal ? 1 : 0;
      nvRef.current.updateGLVolume();
    }
  }, [showOriginal, originalUrl]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  useEffect(() => {
    if (nvRef.current) setTimeout(() => nvRef.current.resizeListener(), 100);
  }, [isFullscreen]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyViewMode = (nv: any, mode: ViewMode) => {
    switch (mode) {
      case "multiplanar":
        nv.setSliceType(nv.sliceTypeMultiplanar);
        break;
      case "axial":
        nv.setSliceType(nv.sliceTypeAxial);
        break;
      case "coronal":
        nv.setSliceType(nv.sliceTypeCoronal);
        break;
      case "sagittal":
        nv.setSliceType(nv.sliceTypeSagittal);
        break;
      case "3d":
        nv.setSliceType(nv.sliceTypeRender);
        break;
    }
  };

  const viewButtons2D: { mode: ViewMode; label: string }[] = [
    { mode: "multiplanar", label: "Multi" },
    { mode: "axial", label: "Axial" },
    { mode: "coronal", label: "Coronal" },
    { mode: "sagittal", label: "Sagittal" },
  ];

  const containerClass = isFullscreen
    ? "fixed inset-0 z-[100] flex flex-col bg-black"
    : "relative flex flex-col rounded-2xl border border-gray-800 bg-gray-900 text-white overflow-hidden";

  return (
    <div className={containerClass}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {viewButtons2D.map((btn) => (
              <button
                key={btn.mode}
                onClick={() => setViewMode(btn.mode)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === btn.mode
                    ? "bg-red-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
          <div className="mx-1 h-5 w-px bg-gray-700" />
          <button
            onClick={() => setViewMode(viewMode === "3d" ? "multiplanar" : "3d")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "3d"
                ? "bg-red-600 text-white"
                : "border border-yellow-600/40 bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/40"
            }`}
            title="Le rendu 3D nécessite un bon GPU"
          >
            🧊 3D {viewMode !== "3d" && "⚠"}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {originalUrl && (
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                showOriginal
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
              title={showOriginal ? "Masquer le scanner original" : "Afficher le scanner original"}
            >
              {showOriginal ? "\uD83D\uDC41 Scanner" : "\uD83D\uDEAB Scanner"}
            </button>
          )}

          <label className="flex items-center gap-2 text-xs text-gray-400">
            Opacité
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-20 accent-red-500"
            />
            <span className="w-8 text-right text-gray-300">{Math.round(opacity * 100)}%</span>
          </label>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-md bg-gray-800 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            {isFullscreen ? "\u2715 Fermer" : "\u26F6 Plein \u00E9cran"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className={`relative ${isFullscreen ? "flex-1" : "h-96"}`}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
              <p className="text-sm text-gray-400">Chargement du viewer...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    </div>
  );
}
