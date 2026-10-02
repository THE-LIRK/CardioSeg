"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CONFIG } from "@/lib/config";
import { FadeIn, AnimatedButton } from "@/components/Animations";
import { PulsingHeart, ScanLine } from "@/components/HeartAnimation";
import { useAuth } from "@/components/AuthProvider";

type Status = "idle" | "uploading" | "processing" | "done" | "error";

interface UserCredits {
  credits: number;
  freeUsedThisMonth: number;
  freeRemaining: number;
  totalAvailable: number;
}

function UploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [userCredits, setUserCredits] = useState<UserCredits | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Charger les crédits de l'utilisateur
  useEffect(() => {
    if (!user) return;
    const fetchCredits = async () => {
      try {
        const res = await fetch(`/api/credits?userId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setUserCredits(data);
        }
      } catch {
        console.error("Erreur chargement crédits");
      } finally {
        setCreditsLoading(false);
      }
    };
    fetchCredits();
  }, [user]);

  // Confirmer le paiement et ajouter les crédits quand l'utilisateur revient de Stripe
  useEffect(() => {
    if (!user) return;
    const sessionId = searchParams.get("session_id");
    const payment = searchParams.get("payment");

    if (payment === "success" && sessionId) {
      setPaymentSuccess(true);

      const confirmPayment = async () => {
        try {
          const res = await fetch("/api/confirm-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          if (res.ok) {
            // Recharger les crédits après confirmation
            const creditsRes = await fetch(`/api/credits?userId=${user.id}`);
            if (creditsRes.ok) {
              setUserCredits(await creditsRes.json());
            }
          }
        } catch {
          console.error("Erreur confirmation paiement");
        }
      };
      confirmPayment();

      // Nettoyer l'URL
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname);

      setTimeout(() => setPaymentSuccess(false), 5000);
    }
  }, [user, searchParams]);

  const validateFile = (f: File): string | null => {
    const name = f.name.toLowerCase();
    const validExt = CONFIG.ACCEPTED_EXTENSIONS.some((ext) =>
      name.endsWith(ext)
    );
    if (!validExt) return "Format invalide. Seuls les fichiers .nii et .nii.gz sont acceptés.";
    if (f.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024)
      return `Fichier trop volumineux (max ${CONFIG.MAX_FILE_SIZE_MB} Mo).`;
    return null;
  };

  const handleFile = (f: File) => {
    const err = validateFile(f);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    // Vérifier les crédits
    if (!userCredits || userCredits.totalAvailable <= 0) {
      setError("Crédits insuffisants. Achetez des crédits pour continuer.");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setProgress(0);
    setError("");

    try {
      // Consommer un crédit
      const creditRes = await fetch("/api/credits/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!creditRes.ok) {
        const creditData = await creditRes.json();
        if (creditData.needCredits) {
          setError("Crédits insuffisants. Achetez des crédits pour continuer.");
          setStatus("error");
          return;
        }
        throw new Error(creditData.error || "Erreur de crédit");
      }

      // Phase 1: Upload réel avec progression réelle (0% → 40%)
      // Phase 2: Traitement serveur avec simulation réaliste (40% → 90%)
      // Phase 3: Terminé (100%)
      setStatus("uploading");
      setProgress(0);

      const result = await new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Phase 1: Progression réelle de l'upload (0-40%)
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const uploadPercent = Math.round((event.loaded / event.total) * 40);
            setProgress(uploadPercent);
          }
        });

        xhr.upload.addEventListener("load", () => {
          // Upload terminé → Phase 2: traitement serveur
          setProgress(40);
          setStatus("processing");
        });

        // Phase 2: Simulation du traitement serveur (40% → 90%)
        let processingInterval: NodeJS.Timeout | null = null;
        xhr.upload.addEventListener("load", () => {
          const processingStart = Date.now();
          const estimatedProcessing = 50000; // ~50s estimé pour le GPU
          processingInterval = setInterval(() => {
            const elapsed = Date.now() - processingStart;
            // Courbe asymptotique: approche 90% sans jamais l'atteindre
            const processingProgress = 40 + 50 * (1 - Math.exp(-elapsed / (estimatedProcessing * 0.4)));
            setProgress(Math.min(90, Math.round(processingProgress)));
          }, 500);
        });

        xhr.addEventListener("load", () => {
          if (processingInterval) clearInterval(processingInterval);
          if (xhr.status >= 200 && xhr.status < 300) {
            // Créer une Response à partir du XHR
            const headers = new Headers();
            const processingTime = xhr.getResponseHeader("X-Processing-Time");
            if (processingTime) headers.set("X-Processing-Time", processingTime);
            resolve(new Response(xhr.response, { status: xhr.status, headers }));
          } else {
            reject(new Error(`Erreur serveur (${xhr.status})`));
          }
        });

        xhr.addEventListener("error", () => {
          if (processingInterval) clearInterval(processingInterval);
          reject(new Error("Erreur réseau"));
        });

        xhr.addEventListener("timeout", () => {
          if (processingInterval) clearInterval(processingInterval);
          reject(new Error("Timeout — le serveur a mis trop de temps"));
        });

        xhr.open("POST", CONFIG.API_URL);
        xhr.responseType = "blob";
        xhr.timeout = 300000; // 5 min max
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.send(file);
      });

      if (!result.ok) {
        throw new Error(`Erreur serveur (${result.status})`);
      }

      setProgress(100);
      setStatus("done");

      // Récupérer le blob résultat et le stocker dans sessionStorage
      const blob = await result.blob();
      const url = URL.createObjectURL(blob);
      const processingTime =
        result.headers.get("X-Processing-Time") || "N/A";

      // Créer un blob URL pour l'image originale
      const originalUrl = URL.createObjectURL(file);

      // Stocker les infos dans sessionStorage pour la page résultat
      sessionStorage.setItem(
        "segResult",
        JSON.stringify({
          downloadUrl: url,
          originalUrl: originalUrl,
          fileName: file.name.replace(/\.nii(\.gz)?$/, "_seg.nii.gz"),
          originalName: file.name,
          originalSize: file.size,
          resultSize: blob.size,
          processingTime,
        })
      );

      // Mettre à jour les crédits localement
      if (userCredits) {
        setUserCredits({
          ...userCredits,
          totalAvailable: userCredits.totalAvailable - 1,
        });
      }

      // Rediriger vers la page résultat
      setTimeout(() => router.push("/result"), 500);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Erreur inconnue"
      );
    }
  };

  const statusConfig = {
    idle: { text: "", color: "", icon: "" },
    uploading: {
      text: "Envoi du fichier...",
      color: "text-blue-800",
      icon: "↑",
    },
    processing: {
      text: "Segmentation en cours (~60s)...",
      color: "text-amber-800",
      icon: "⟳",
    },
    done: {
      text: "Segmentation terminée !",
      color: "text-green-800",
      icon: "✓",
    },
    error: { text: error, color: "text-red-800", icon: "⚠" },
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 pt-16 text-gray-900">
      <div className="w-full max-w-2xl">
        {/* Notification paiement réussi */}
        <AnimatePresence>
          {paymentSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 rounded-lg border border-green-700 bg-green-50 p-4 text-center text-sm text-green-800"
              role="status"
            >
              Paiement réussi ! Vos crédits ont été ajoutés.
            </motion.div>
          )}
        </AnimatePresence>

        <FadeIn>
          <h1 className="mb-2 text-3xl font-bold">Nouvelle segmentation</h1>
          <div className="mb-8 flex items-center justify-between">
            <p className="text-gray-700">
              Importez votre angioscanner cardiaque au format NIfTI (.nii.gz)
            </p>
            {/* Badge crédits */}
            {!creditsLoading && userCredits && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500 bg-red-950 px-3 py-1.5">
                <span className="text-sm text-gray-300">Crédits :</span>
                <span
                  className={`text-sm font-bold ${
                    userCredits.totalAvailable > 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {userCredits.totalAvailable}
                </span>
                {userCredits.totalAvailable <= 0 && (
                  <Link
                    href="/pricing"
                    className="ml-1 text-xs text-red-400 underline hover:text-red-300"
                  >
                    Acheter
                  </Link>
                )}
              </div>
            )}
          </div>
        </FadeIn>

        {/* Drop zone */}
        <FadeIn delay={0.15}>
        <motion.div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          animate={
            dragOver
              ? { scale: 1.02, borderColor: "rgba(29,78,216,1)" }
              : file
              ? { scale: 1, borderColor: "rgba(21,128,61,1)" }
              : { scale: 1, borderColor: "rgba(75,85,99,1)" }
          }
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 bg-gray-50 text-gray-900 transition-colors`}
        >
          <AnimatePresence mode="wait">
            {file ? (
              <motion.div
                key="file-info"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center"
              >
                <motion.div
                  className="mb-2 text-4xl"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  📁
                </motion.div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-700">
                  {(file.size / (1024 * 1024)).toFixed(1)} Mo
                </p>
                <button
                  onClick={() => {
                    setFile(null);
                    setStatus("idle");
                    setError("");
                  }}
                  className="mt-3 text-xs text-gray-700 underline hover:text-blue-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  Changer de fichier
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="drop-prompt"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                <PulsingHeart size={80} />
                <p className="mb-1 mt-4 font-medium text-gray-900">
                  Glissez-déposez votre fichier NIfTI ici
                </p>
                <p className="mb-4 text-sm text-gray-700">
                  ou cliquez pour sélectionner
                </p>
                <label className="cursor-pointer rounded-lg border border-gray-600 bg-white px-6 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-700">
                  Parcourir
                  <input
                    type="file"
                    accept=".nii,.nii.gz,.gz"
                    onChange={onFileSelect}
                    className="sr-only"
                  />
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        </FadeIn>

        {/* Progress bar */}
        <AnimatePresence>
        {status !== "idle" && status !== "error" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6"
          >
            <div className="mb-2 flex justify-between text-sm">
              <span className={statusConfig[status].color} role="status">
                <span aria-hidden="true">{statusConfig[status].icon} </span>
                {statusConfig[status].text}
              </span>
              <span className="text-gray-700">{progress}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Progression de la segmentation"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-3 overflow-hidden rounded-full border border-gray-600 bg-gray-200"
            >
              <motion.div
                className={`h-full rounded-full ${
                  status === "done" ? "bg-green-700" : "bg-blue-700"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            {status === "processing" && (
              <div className="relative mt-4 h-32 overflow-hidden rounded-xl border border-gray-800 bg-black/50">
                <ScanLine />
                <div className="flex h-full items-center justify-center">
                  <PulsingHeart size={60} />
                </div>
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>

        {/* Error message */}
        <AnimatePresence>
        {error && status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 rounded-lg border border-red-700 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            <span aria-hidden="true">⚠ </span>
            {error}
          </motion.div>
        )}
        </AnimatePresence>

        {/* Submit button */}
        <FadeIn delay={0.3}>
        {userCredits && userCredits.totalAvailable <= 0 ? (
          <Link href="/pricing">
            <div className="mt-6 w-full rounded-xl border-2 border-dashed border-red-700 bg-red-50 py-4 text-center text-lg font-semibold text-red-800 transition-colors hover:bg-red-100 cursor-pointer">
              Crédits épuisés — Acheter des crédits
            </div>
          </Link>
        ) : (
          <AnimatedButton
            onClick={handleUpload}
            disabled={!file || status === "processing" || status === "uploading"}
            className="mt-6 w-full rounded-xl bg-blue-700 py-4 text-lg font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:border disabled:border-gray-600 disabled:bg-gray-200 disabled:text-gray-700 disabled:hover:bg-gray-200"
          >
            {status === "processing"
              ? "Segmentation en cours..."
              : status === "uploading"
              ? "Envoi..."
              : `Lancer la segmentation (1 crédit)`}
          </AnimatedButton>
        )}
        </FadeIn>

        {/* Info */}
        <FadeIn delay={0.4}>
        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm text-gray-700">
          <div>
            <p className="font-medium text-gray-900">~60s</p>
            <p>Temps moyen</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">GPU A10G</p>
            <p>NVIDIA Cloud</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">9 structures</p>
            <p>Segmentées</p>
          </div>
        </div>
        </FadeIn>
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <PulsingHeart size={80} />
        </div>
      }
    >
      <UploadPageContent />
    </Suspense>
  );
}
