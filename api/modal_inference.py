"""
CardioSeg - API Modal de segmentation cardiaque automatisée (Cascaded U-Net).

Pipeline en 2 phases :
  1. Détection du cœur (crop) avec le modèle 1stage.ckpt (Segmenter_2labels)
  2. Segmentation fine (8 classes) avec le modèle 2stage.ckpt (Segmenter)

Usage :
  modal serve modal_inference.py   # dev avec hot-reload
  modal deploy modal_inference.py  # production
"""

import modal
import os
from fastapi import Request
from fastapi.responses import Response, JSONResponse

# ──────────────────────────────────────────────────────────────
# 1. Image Docker Modal
# ──────────────────────────────────────────────────────────────
image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        "torch",
        "pytorch-lightning",
        "nibabel",
        "SimpleITK",
        "torchio",
        "matplotlib",
        "scikit-learn",
        "numpy",
        "fastapi[standard]",
    )
    # Copier le code ML dans le conteneur
    .add_local_dir(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ml"),
        remote_path="/root/cardioseg",
    )
)

# ──────────────────────────────────────────────────────────────
# 2. App Modal
# ──────────────────────────────────────────────────────────────
app = modal.App("cardioseg-inference")

# Chemins des modèles pré-entraînés (dans le conteneur)
MODEL_CROP_PATH = "/root/cardioseg/pretrained_models/1stage.ckpt"
MODEL_SEG_PATH  = "/root/cardioseg/pretrained_models/2stage.ckpt"
ML_CODE_PATH    = "/root/cardioseg"  # dossier ml/ copié dans le conteneur

# Paramètres du pipeline
TAM_CROP = 128          # taille d'entrée pour le crop
TAM_SEG  = 128          # taille d'entrée pour la segmentation
ORIENT_FINAL = "LAS"    # orientation finale des images
CROP_MARGIN = 0.15      # marge de sécurité autour du cœur détecté
LABELS_NORMALES = {0: 0, 1: 205, 2: 420, 3: 500, 4: 550, 5: 600, 6: 820, 7: 850}


# ──────────────────────────────────────────────────────────────
# 3. Endpoint POST : segmentation cardiaque (pipeline complet)
# ──────────────────────────────────────────────────────────────
@app.function(
    image=image,
    gpu="A10G",
    timeout=600,
)
@modal.fastapi_endpoint(method="POST")
async def segment_nifti(request: Request):
    """
    Reçoit un fichier NIfTI (.nii.gz) en POST body brut.
    Retourne le masque de segmentation en NIfTI (.nii.gz).
    """
    import sys
    import io
    import tempfile
    import traceback
    import time
    import torch
    import nibabel as nib
    import numpy as np
    import SimpleITK as sitk

    sys.path.insert(0, "/root/cardioseg")
    from segmenter import Segmenter
    from segmenter_2labels import Segmenter_2labels
    from utils import (
        preprocesar_imagen,
        prediccion_crop,
        crop_imagen,
        prediccion,
        devolver_dimensiones,
    )

    try:
        t0 = time.time()

        # ── 1. Lire le fichier NIfTI envoyé ──
        nifti_bytes = await request.body()
        print(f"[INFO] Reçu {len(nifti_bytes)} octets")

        with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as tmp:
            tmp.write(nifti_bytes)
            tmp_path = tmp.name

        # Charger avec SimpleITK et nibabel
        img = sitk.ReadImage(tmp_path)
        img_nib = nib.load(tmp_path)
        print(f"[INFO] Image shape: {img.GetSize()}, spacing: {img.GetSpacing()}")

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[INFO] Device: {device}")

        tamanho_crop = (TAM_CROP, TAM_CROP, TAM_CROP)
        tamanho_seg  = (TAM_SEG, TAM_SEG, TAM_SEG)

        # ── 2. Charger les modèles (load_from_checkpoint lit les hyperparamètres) ──
        print("[INFO] Chargement du modèle de crop (1stage)...")
        model_crop = Segmenter_2labels.load_from_checkpoint(MODEL_CROP_PATH, map_location=device)
        model_crop.eval()
        model_crop.to(device)
        print("[INFO] Modèle crop chargé")

        print("[INFO] Chargement du modèle de segmentation (2stage)...")
        model_seg = Segmenter.load_from_checkpoint(MODEL_SEG_PATH, map_location=device)
        model_seg.eval()
        model_seg.to(device)
        print("[INFO] Modèle segmentation chargé")

        # ── 3. Phase 1 : Détection du cœur (crop) ──
        phase1_ok = False
        try:
            print("[INFO] Phase 1 : prétraitement pour le crop")
            img_preprocesada = preprocesar_imagen(img, tamanho_crop, ORIENT_FINAL)

            print("[INFO] Phase 1 : prédiction du cœur")
            img_inferida_final, t_crop = prediccion_crop(
                img_preprocesada, img, model_crop, device, img_nib
            )
            print(f"[INFO] Phase 1 : crop terminé en {t_crop:.2f}s")

            print("[INFO] Phase 1 : extraction de la boîte englobante")
            imagen_cropeada, box_ajustado = crop_imagen(
                img_inferida_final, CROP_MARGIN, img
            )
            print(f"[INFO] Boîte de crop : {box_ajustado}, taille croppée : {imagen_cropeada.GetSize()}")
            phase1_ok = True
        except Exception as e1:
            print(f"[WARN] Phase 1 échouée : {e1}. Passage en mode image complète.")

        # ── 4. Phase 2 : Segmentation fine ──
        if phase1_ok:
            print("[INFO] Phase 2 : prétraitement de l'image croppée")
            imagen_cropeada_preprocesada = preprocesar_imagen(
                imagen_cropeada, tamanho_seg, ORIENT_FINAL
            )
            print("[INFO] Phase 2 : segmentation")
            img_inferida_cropeada_final, t_seg = prediccion(
                imagen_cropeada_preprocesada, model_seg, LABELS_NORMALES,
                imagen_cropeada, device, img_nib
            )
            print(f"[INFO] Phase 2 : segmentation terminée en {t_seg:.2f}s")

            print("[INFO] Réexpansion aux dimensions originales")
            target = devolver_dimensiones(img, img_inferida_cropeada_final, box_ajustado)
        else:
            # Fallback : segmentation sur l'image complète
            print("[INFO] Segmentation sur l'image complète (sans crop)")
            img_preprocesada_full = preprocesar_imagen(img, tamanho_seg, ORIENT_FINAL)
            target, t_seg = prediccion(
                img_preprocesada_full, model_seg, LABELS_NORMALES,
                img, device, img_nib
            )
            print(f"[INFO] Segmentation terminée en {t_seg:.2f}s")

        # ── 5. Sauvegarder le résultat en NIfTI ──
        with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as out_tmp:
            out_path = out_tmp.name
        sitk.WriteImage(target, out_path)

        with open(out_path, "rb") as f:
            result_bytes = f.read()

        # Nettoyage
        os.unlink(tmp_path)
        os.unlink(out_path)

        t_total = time.time() - t0
        print(f"[INFO] Pipeline terminé en {t_total:.2f}s, résultat : {len(result_bytes)} octets")

        return Response(
            content=result_bytes,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": "attachment; filename=segmentation.nii.gz",
                "X-Processing-Time": f"{t_total:.2f}s",
            },
        )

    except Exception as e:
        error_msg = traceback.format_exc()
        print(f"[ERROR] {error_msg}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "traceback": error_msg},
        )


# ──────────────────────────────────────────────────────────────
# 4. Endpoint de santé (GET)
# ──────────────────────────────────────────────────────────────
@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
def health():
    return {
        "status": "ok",
        "model": "CardioSeg Cascaded U-Net (2 phases)",
        "version": "1.0",
        "pipeline": "1. Heart detection (crop) → 2. Heart segmentation (8 classes)",
    }
