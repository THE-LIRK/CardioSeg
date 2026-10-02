// Configuration centralisée
export const CONFIG = {
  // URL de l'API Modal (production)
  API_URL:
    process.env.NEXT_PUBLIC_API_URL ||
    "https://the-lirk--cardioseg-inference-segment-nifti.modal.run",

  // URL du health check
  HEALTH_URL:
    process.env.NEXT_PUBLIC_HEALTH_URL ||
    "https://the-lirk--cardioseg-inference-health.modal.run",

  // Taille max du fichier (en Mo)
  MAX_FILE_SIZE_MB: 200,

  // Extensions acceptées
  ACCEPTED_EXTENSIONS: [".nii", ".nii.gz", ".gz"],

  // Labels cardiaques (valeurs réelles dans le masque: 0-9)
  CARDIAC_LABELS: {
    1: { name: "Myocarde VG", color: "#ef4444" },
    2: { name: "Oreillette gauche", color: "#3b82f6" },
    3: { name: "Ventricule gauche", color: "#eab308" },
    4: { name: "Oreillette droite", color: "#22c55e" },
    5: { name: "Ventricule droit", color: "#a855f7" },
    6: { name: "Aorte ascendante", color: "#f97316" },
    7: { name: "Artère pulmonaire", color: "#06b6d4" },
    8: { name: "Coronaire gauche", color: "#a3e635" },
    9: { name: "Coronaire droite", color: "#ff64ff" },
  },
  // Crédits gratuits par mois
  FREE_MONTHLY_CREDITS: 2,

  // Packs de crédits Stripe
  CREDIT_PACKS: [
    {
      id: "pack_5",
      name: "Découverte",
      credits: 5,
      price: 9,
      priceId: "price_1T40nZQcFmmm4QZBwPaVtXir",
      popular: false,
    },
    {
      id: "pack_25",
      name: "Standard",
      credits: 25,
      price: 39,
      priceId: "price_1T40ozQcFmmm4QZBY91AtcDs",
      popular: true,
    },
    {
      id: "pack_100",
      name: "Pro",
      credits: 100,
      price: 129,
      priceId: "price_1T40pPQcFmmm4QZBl7lNxBBc",
      popular: false,
    },
  ],
} as const;
