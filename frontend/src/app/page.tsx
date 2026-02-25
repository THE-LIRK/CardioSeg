"use client";

import Link from "next/link";
import {
  FadeIn,
  StaggerContainer,
  StaggerItem,
  HoverCard,
  AnimatedButton,
} from "@/components/Animations";
import { PulsingHeart, FloatingParticles, HeartbeatWave } from "@/components/HeartAnimation";
import { motion } from "framer-motion";

const features = [
  {
    icon: "🧠",
    title: "IA de pointe",
    description:
      "Cascaded U-Net entraîné sur des milliers d'IRM cardiaques. Segmentation automatique de 7 structures.",
  },
  {
    icon: "⚡",
    title: "Résultat en ~60 secondes",
    description:
      "Inférence GPU (NVIDIA A10G) sur le cloud. Pas besoin de matériel coûteux.",
  },
  {
    icon: "🔒",
    title: "Données sécurisées",
    description:
      "Vos images ne sont jamais stockées. Traitement éphémère et chiffré de bout en bout.",
  },
  {
    icon: "📦",
    title: "Format standard",
    description:
      "Upload en NIfTI (.nii.gz), résultat en NIfTI. Compatible 3D Slicer, ITK-SNAP, FSLeyes.",
  },
];

const structures = [
  { label: "Myocarde VG", color: "bg-red-500" },
  { label: "Oreillette gauche", color: "bg-blue-500" },
  { label: "Ventricule gauche", color: "bg-yellow-500" },
  { label: "Ventricule droit", color: "bg-green-500" },
  { label: "Oreillette droite", color: "bg-purple-500" },
  { label: "Aorte ascendante", color: "bg-orange-500" },
  { label: "Artère pulmonaire", color: "bg-cyan-500" },
];

const plans = [
  {
    name: "Gratuit",
    price: "0€",
    perUnit: "",
    features: ["2 segmentations / mois", "Format NIfTI", "Viewer 3D", "Aucune carte requise"],
    cta: "Commencer",
    highlight: false,
    href: "/auth",
  },
  {
    name: "Découverte",
    price: "9€",
    perUnit: "1,80€ / seg.",
    features: ["5 segmentations", "Format NIfTI", "Viewer 3D", "Crédits sans expiration"],
    cta: "Acheter 5 crédits",
    highlight: false,
    href: "/pricing",
  },
  {
    name: "Standard",
    price: "39€",
    perUnit: "1,56€ / seg.",
    features: [
      "25 segmentations",
      "Format NIfTI",
      "Viewer 3D",
      "Crédits sans expiration",
      "GPU prioritaire",
    ],
    cta: "Acheter 25 crédits",
    highlight: true,
    href: "/pricing",
  },
  {
    name: "Pro",
    price: "129€",
    perUnit: "1,29€ / seg.",
    features: [
      "100 segmentations",
      "Format NIfTI",
      "Viewer 3D",
      "Crédits sans expiration",
      "GPU prioritaire",
      "Meilleur rapport qualité/prix",
    ],
    cta: "Acheter 100 crédits",
    highlight: false,
    href: "/pricing",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* ─── Hero ─── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-16 text-center overflow-hidden">
        <FloatingParticles />
        <HeartbeatWave />

        <FadeIn>
          <div className="mb-6 inline-block rounded-full bg-red-500/10 px-4 py-1 text-sm text-red-400">
            Segmentation cardiaque par IA
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mb-8 flex justify-center">
            <PulsingHeart size={180} />
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <h1 className="max-w-4xl text-5xl font-bold leading-tight tracking-tight sm:text-7xl">
            Segmentez un cœur
            <br />
            <motion.span
              className="text-red-500 inline-block"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              en 60 secondes
            </motion.span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.3}>
          <p className="mt-6 max-w-2xl text-lg text-black">
            Uploadez votre IRM cardiaque au format NIfTI. Notre IA (Cascaded
            U-Net) segmente automatiquement 7 structures cardiaques avec une
            précision clinique.
          </p>
        </FadeIn>

        <FadeIn delay={0.4}>
          <div className="mt-10 flex gap-4">
            <AnimatedButton className="rounded-xl bg-red-600 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-red-700">
              <Link href="/upload">Lancer une segmentation</Link>
            </AnimatedButton>
            <AnimatedButton className="rounded-xl border border-gray-700 px-8 py-3 text-lg font-semibold text-black transition-colors hover:border-gray-500 hover:text-black">
              <a href="#features">En savoir plus</a>
            </AnimatedButton>
          </div>
        </FadeIn>

        {/* Structures badges */}
        <StaggerContainer className="mt-16 flex flex-wrap justify-center gap-3" staggerDelay={0.08}>
          {structures.map((s) => (
            <StaggerItem key={s.label}>
              <motion.span
                className="flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900 px-4 py-2 text-sm text-gray-200"
                whileHover={{ scale: 1.1, borderColor: "rgba(239,68,68,0.5)" }}
              >
                <span className={`h-3 w-3 rounded-full ${s.color}`} />
                {s.label}
              </motion.span>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-gray-600 text-2xl">↓</span>
        </motion.div>
      </section>

      {/* ─── Enjeux ─── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white py-28">
        {/* Accent décoratif */}
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-[600px] rounded-full bg-red-100 blur-3xl opacity-50" />

        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mb-4 flex justify-center">
              <span className="rounded-full bg-red-100 px-4 py-1 text-sm font-medium text-red-600">
                Contexte & Enjeux
              </span>
            </div>
            <h2 className="mb-4 text-center text-3xl font-bold sm:text-5xl text-gray-900">
              Pourquoi la segmentation automatique ?
            </h2>
            <p className="mx-auto mb-20 max-w-3xl text-center text-lg text-gray-600 leading-relaxed">
              Les maladies cardiovasculaires restent la <span className="text-red-600 font-semibold">première cause de mortalité mondiale</span>.
              La segmentation cardiaque est un outil clé pour le diagnostic, la planification chirurgicale
              et le suivi thérapeutique — mais elle est encore largement manuelle.
            </p>
          </FadeIn>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Le problème */}
            <FadeIn delay={0.1}>
              <div className="group rounded-2xl bg-white p-8 shadow-lg shadow-gray-200/50 ring-1 ring-gray-100 transition-all hover:shadow-xl hover:ring-red-200 h-full">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl">
                  ⏱️
                </div>
                <h3 className="mb-3 text-xl font-bold text-gray-900">Le problème actuel</h3>
                <p className="text-gray-600 leading-relaxed">
                  Un radiologue met en moyenne <span className="font-semibold text-amber-600">20 à 45 minutes</span> pour
                  segmenter manuellement un cœur en IRM. Avec des centaines d'examens par mois, 
                  c'est un goulet d'étranglement majeur.
                </p>
              </div>
            </FadeIn>

            {/* Le gain */}
            <FadeIn delay={0.2}>
              <div className="group rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-8 shadow-lg shadow-red-200/50 ring-1 ring-red-500 transition-all hover:shadow-xl h-full">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-2xl">
                  🚀
                </div>
                <h3 className="mb-3 text-xl font-bold text-white">Le gain avec CardioSeg</h3>
                <p className="text-red-100 leading-relaxed">
                  Notre IA réduit ce temps à <span className="text-white font-bold">~60 secondes</span> — soit
                  un gain de <span className="text-white font-bold">×30 à ×45</span>. Le clinicien peut
                  se concentrer sur l'interprétation.
                </p>
                <div className="mt-6 flex items-center justify-center gap-6 rounded-xl bg-white/10 px-4 py-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">30 min</div>
                    <span className="text-xs text-red-200">Manuel</span>
                  </div>
                  <motion.span
                    className="text-white text-2xl"
                    animate={{ x: [0, 6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    →
                  </motion.span>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">60s</div>
                    <span className="text-xs text-red-200">CardioSeg</span>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Les enjeux cliniques */}
            <FadeIn delay={0.3}>
              <div className="group rounded-2xl bg-white p-8 shadow-lg shadow-gray-200/50 ring-1 ring-gray-100 transition-all hover:shadow-xl hover:ring-red-200 h-full">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl">
                  🏥
                </div>
                <h3 className="mb-3 text-xl font-bold text-gray-900">Enjeux cliniques</h3>
                <ul className="space-y-3">
                  {[
                    { title: "Diagnostic", desc: "Mesure précise des volumes et fraction d'éjection" },
                    { title: "Chirurgie", desc: "Planification 3D pré-opératoire" },
                    { title: "Suivi", desc: "Comparaison longitudinale automatisée" },
                    { title: "Recherche", desc: "Milliers de patients analysables en heures" },
                  ].map((item) => (
                    <li key={item.title} className="flex items-start gap-3">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs text-red-600 font-bold">✓</span>
                      <span className="text-gray-600">
                        <span className="font-semibold text-gray-900">{item.title}</span> — {item.desc}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          </div>

          {/* Chiffres clés */}
          <FadeIn delay={0.4}>
            <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { value: "17.9M", label: "décès/an par maladies cardiovasculaires", color: "text-red-600", bg: "bg-red-50" },
                { value: "7", label: "structures cardiaques segmentées", color: "text-blue-600", bg: "bg-blue-50" },
                { value: "~60s", label: "temps d'inférence moyen", color: "text-green-600", bg: "bg-green-50" },
                { value: "×30", label: "plus rapide que le tracé manuel", color: "text-amber-600", bg: "bg-amber-50" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className={`rounded-2xl ${stat.bg} p-5 text-center ring-1 ring-gray-100`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className={`text-3xl font-bold sm:text-4xl ${stat.color}`}>
                    {stat.value}
                  </div>
                  <p className="mt-2 text-xs text-gray-600 sm:text-sm font-medium">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="bg-gradient-to-b from-gray-50 to-white py-28">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mb-4 flex justify-center">
              <span className="rounded-full bg-blue-100 px-4 py-1 text-sm font-medium text-blue-600">
                Fonctionnement
              </span>
            </div>
            <h2 className="mb-4 text-center text-3xl font-bold sm:text-5xl text-gray-900">
              Comment ça marche
            </h2>
            <p className="mx-auto mb-20 max-w-2xl text-center text-lg text-gray-600">
              Un workflow simple en 3 étapes, de l'upload au résultat.
            </p>
          </FadeIn>

          {/* 4 feature cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.1}>
                <div className="group rounded-2xl bg-white p-7 shadow-lg shadow-gray-200/50 ring-1 ring-gray-100 transition-all hover:shadow-xl hover:ring-red-200 h-full">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-3xl group-hover:bg-red-50 transition-colors">
                    {f.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">{f.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pipeline ─── */}
      <section className="bg-white py-28">
        <div className="mx-auto max-w-5xl px-6">
          <FadeIn>
            <div className="mb-4 flex justify-center">
              <span className="rounded-full bg-red-100 px-4 py-1 text-sm font-medium text-red-600">
                Architecture
              </span>
            </div>
            <h2 className="mb-4 text-center text-3xl font-bold sm:text-5xl text-gray-900">
              Pipeline en 2 phases
            </h2>
            <p className="mx-auto mb-16 max-w-2xl text-center text-lg text-gray-600">
              Un réseau Cascaded U-Net qui localise puis segmente avec précision.
            </p>
          </FadeIn>

          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
            {/* Phase 1 */}
            <FadeIn direction="left" className="flex-1 w-full">
              <div className="rounded-2xl bg-gray-50 p-8 ring-1 ring-gray-200 text-center transition-all hover:shadow-lg hover:ring-blue-200 h-full">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-3xl">
                  🎯
                </div>
                <span className="inline-block rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700 mb-3">
                  PHASE 1
                </span>
                <h3 className="text-xl font-bold text-gray-900">Détection</h3>
                <p className="mt-3 text-gray-600">
                  Localisation automatique du cœur dans le volume 3D complet
                </p>
                <div className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 font-mono">
                  2 classes · depth=4 · 32 filtres
                </div>
              </div>
            </FadeIn>

            {/* Flèche */}
            <motion.div
              className="text-4xl text-red-400 font-light"
              animate={{ x: [0, 10, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              →
            </motion.div>

            {/* Phase 2 */}
            <FadeIn direction="right" className="flex-1 w-full">
              <div className="rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-8 shadow-lg shadow-red-200/50 text-center transition-all hover:shadow-xl h-full">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-3xl">
                  <motion.span
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    🫀
                  </motion.span>
                </div>
                <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white mb-3">
                  PHASE 2
                </span>
                <h3 className="text-xl font-bold text-white">Segmentation</h3>
                <p className="mt-3 text-red-100">
                  Segmentation fine de 7 structures cardiaques (8 classes)
                </p>
                <div className="mt-4 rounded-lg bg-white/10 px-3 py-2 text-xs text-red-100 font-mono">
                  8 classes · haute résolution
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <FadeIn>
          <h2 className="mb-4 text-center text-3xl font-bold sm:text-4xl">
            Tarifs
          </h2>
          <p className="mb-16 text-center text-gray-400">
            2 segmentations gratuites par mois, puis achetez des crédits à la carte
          </p>
        </FadeIn>
        <StaggerContainer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.12}>
          {plans.map((plan) => (
            <StaggerItem key={plan.name}>
              <HoverCard className="h-full">
                <div
                  className={`relative h-full rounded-2xl border p-6 ${
                    plan.highlight
                      ? "border-red-500 bg-red-950/30 shadow-lg shadow-red-900/20"
                      : "border-gray-700 bg-gray-900"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-4 py-1 text-xs font-semibold text-white">
                      Populaire
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                  </div>
                  {plan.perUnit && (
                    <p className="mt-1 text-xs text-gray-400">{plan.perUnit}</p>
                  )}
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-2 text-sm text-white"
                      >
                        <span className="text-green-400 font-bold">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <AnimatedButton
                    className={`mt-8 block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors ${
                      plan.highlight
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-gray-800 text-gray-200 hover:bg-gray-700"
                    }`}
                  >
                    <Link href={plan.href}>
                      {plan.cta}
                    </Link>
                  </AnimatedButton>
                </div>
              </HoverCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* ─── Footer ─── */}
      <FadeIn>
        <footer className="border-t border-gray-800 py-12 text-center text-sm text-gray-400">
          <p>
            © {new Date().getFullYear()} CardioSeg — Segmentation cardiaque par IA
          </p>
        </footer>
      </FadeIn>
    </div>
  );
}
