"""
CardioSeg - API Modal de segmentation cardiaque automatisée.

Pipeline en 3 phases :
  1. Détection du cœur (crop) avec le modèle 1stage.ckpt (Segmenter_2labels)
  2. Segmentation fine (8 classes) avec le modèle 2stage.ckpt (Segmenter / UNet3D)
  3. Segmentation des coronaires (3 classes) avec coronary.ckpt (SwinUNETR V2)
     → Fusion : labels coronaires (8, 9) ajoutés au masque cardiaque

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
        "monai",
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
MODEL_CORO_PATH = "/root/cardioseg/pretrained_models/coronary.ckpt"
ML_CODE_PATH    = "/root/cardioseg"  # dossier ml/ copié dans le conteneur

# Paramètres du pipeline (Stages 1 & 2)
TAM_CROP = 128          # taille d'entrée pour le crop
TAM_SEG  = 128          # taille d'entrée pour la segmentation
ORIENT_FINAL = "LAS"    # orientation finale des images
CROP_MARGIN = 0.15      # marge de sécurité autour du cœur détecté
LABELS_NORMALES = {0: 0, 1: 205, 2: 420, 3: 500, 4: 550, 5: 600, 6: 820, 7: 850}

# Paramètres Stage 3 (coronaires - SwinUNETR)
TAM_CORO = (128, 128, 128)
CORO_TARGET_SPACING = [0.35, 0.35, 0.5]  # mm (Larsen et al.)
CORO_HU_MIN = -200
CORO_HU_MAX = 1411
CORO_LABELS = {0: 0, 1: 8, 2: 9}  # 1=coronaire gauche (label 8), 2=coronaire droite (label 9)


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
    Retourne le masque de segmentation complet (cœur + coronaires) en NIfTI (.nii.gz).
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
    from models.swin_unetr import SwinUNETRSegmenter
    from preprocessing_swin import preprocess_image

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

        # ── 5. Phase 3 : Segmentation des coronaires (SwinUNETR V2) ──
        try:
            print("[INFO] Phase 3 : chargement du modèle coronaire (SwinUNETR)...")
            model_coro = SwinUNETRSegmenter.load_from_checkpoint(
                MODEL_CORO_PATH, map_location=device, pretrained_weights=None
            )
            model_coro.eval()
            model_coro.to(device)
            print("[INFO] Modèle coronaire chargé")

            # Prétraitement spécifique coronaires (sur l'image croppée si dispo)
            img_input_coro = imagen_cropeada if phase1_ok else img
            print("[INFO] Phase 3 : prétraitement coronaire (HU norm + resize 128³)")

            # Prétraitement SANS resample_to_spacing — exactement comme Stage 2
            # (resample_to_spacing casse la symétrie du post-traitement)
            from sitk_utils import np_to_image, resize_image
            from dataset import cambiar_tam

            # Resize vers 128³ + normalisation HU coronaire
            img_coro_resized = cambiar_tam(img_input_coro, list(TAM_CORO), ORIENT_FINAL)
            img_coro_array = sitk.GetArrayFromImage(img_coro_resized)  # (Z, Y, X)
            # Normalisation HU spécifique coronaires
            img_coro_array = np.clip(img_coro_array, CORO_HU_MIN, CORO_HU_MAX).astype(np.float32)
            img_coro_array = (img_coro_array - CORO_HU_MIN) / (CORO_HU_MAX - CORO_HU_MIN)
            img_coro_preprocessed = np_to_image(
                img_coro_array,
                img_coro_resized.GetOrigin(),
                img_coro_resized.GetSpacing(),
                img_coro_resized.GetDirection(),
                sitk.sitkFloat32,
            )

            # Inférence — utiliser TorchIO pour garantir le même ordre d'axes que l'entraînement
            import torchio as tio
            subject = tio.Subject({"CT": tio.ScalarImage.from_sitk(img_coro_preprocessed)})
            img_coro_tensor = subject["CT"][tio.DATA].unsqueeze(0).to(device)  # (B, C, X, Y, Z)

            print("[INFO] Phase 3 : inférence coronaire")
            t_coro_start = time.time()
            with torch.no_grad():
                coro_logits = model_coro(img_coro_tensor)
                # Sortie (B, classes, X, Y, Z) → argmax → (X, Y, Z) → transpose → (Z, Y, X)
                coro_pred = torch.argmax(coro_logits, dim=1).squeeze(0).cpu().numpy().transpose(2, 1, 0)
            t_coro = time.time() - t_coro_start
            print(f"[INFO] Phase 3 : coronaires terminée en {t_coro:.2f}s")
            print(f"[DEBUG] coro_pred unique values: {np.unique(coro_pred).tolist()}")
            print(f"[DEBUG] coro_pred shape: {coro_pred.shape}")
            print(f"[DEBUG] coro_pred count label 1: {np.sum(coro_pred == 1)}, label 2: {np.sum(coro_pred == 2)}")

            # Remapper les labels coronaires : 1→8 (gauche), 2→9 (droite)
            coro_mask_remapped = np.zeros_like(coro_pred, dtype=np.int16)
            for src_label, dst_label in CORO_LABELS.items():
                if src_label > 0:
                    coro_mask_remapped[coro_pred == src_label] = dst_label
            print(f"[DEBUG] coro_mask_remapped unique: {np.unique(coro_mask_remapped).tolist()}")

            # Post-traitement IDENTIQUE à Stage 2 (cambiar_tam — bugs symétriques)
            img_cropeada_inferida = np_to_image(
                coro_mask_remapped,
                img_coro_preprocessed.GetOrigin(),
                img_coro_preprocessed.GetSpacing(),
                img_coro_preprocessed.GetDirection(),
                sitk.sitkInt16,
            )
            # Cible = taille LPS de l'image croppée originale
            img_cropeada_prueba = sitk.DICOMOrient(img_input_coro, "LPS")
            orient_code = "".join(list(nib.aff2axcodes(img_nib.affine)))
            coro_resized = cambiar_tam(img_cropeada_inferida, img_cropeada_prueba.GetSize(), orient_code, mask=True)
            print(f"[DEBUG] orient_code: {orient_code}")
            print(f"[DEBUG] coro_resized size: {coro_resized.GetSize()}, unique: {np.unique(sitk.GetArrayFromImage(coro_resized)).tolist()}")

            # Réexpansion aux dimensions originales si crop utilisé
            if phase1_ok:
                from preprocessing_swin import restore_dimensions
                coro_full = restore_dimensions(img, coro_resized, box_ajustado)
            else:
                coro_full = coro_resized
            print(f"[DEBUG] coro_full size: {coro_full.GetSize()}, unique: {np.unique(sitk.GetArrayFromImage(coro_full)).tolist()}")

            # ── 6. Fusion : masque cardiaque (8 classes) + coronaires (labels 8, 9) ──
            print("[INFO] Fusion des masques cardiaque + coronaires")
            target_array = sitk.GetArrayFromImage(target)
            coro_full_array = sitk.GetArrayFromImage(coro_full)
            print(f"[DEBUG] target unique before fusion: {np.unique(target_array).tolist()}")
            print(f"[DEBUG] coro_full_array unique: {np.unique(coro_full_array).tolist()}")
            print(f"[DEBUG] coro_full_array nonzero count: {np.count_nonzero(coro_full_array)}")

            # Ajouter les coronaires là où elles sont détectées
            # (les coronaires écrasent le fond/structures sous-jacentes)
            coronary_mask = coro_full_array > 0
            target_array[coronary_mask] = coro_full_array[coronary_mask]

            target_fused = np_to_image(
                target_array, target.GetOrigin(), target.GetSpacing(),
                target.GetDirection(), sitk.sitkInt16,
            )
            target = target_fused
            print(f"[INFO] Fusion terminée — labels uniques : {np.unique(target_array).tolist()}")

        except Exception as e_coro:
            print(f"[WARN] Phase 3 (coronaires) échouée : {e_coro}")
            print("[WARN] Le masque cardiaque (8 classes) sera retourné sans les coronaires")
            import traceback as tb
            tb.print_exc()
            coronary_error = str(e_coro)
        else:
            coronary_error = None

        # ── 7. Sauvegarder le résultat en NIfTI ──
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
                "X-Coronary-Status": "ok" if coronary_error is None else f"error: {coronary_error[:200]}",
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
        "model": "CardioSeg: Cascaded U-Net (2 phases) + SwinUNETR V2 (coronaires)",
        "version": "2.0",
        "pipeline": "1. Heart detection (crop) → 2. Heart segmentation (8 classes) → 3. Coronary segmentation (2 classes) → Fusion (10 labels)",
    }
