
# Swin UNETR pour la segmentation des coronaires (gauche + droite)
# Entrée : image CT croppée autour du cœur.
# Sortie : 3 classes → 0=fond, 1=coronaire gauche (label 8), 2=coronaire droite (label 9)
#
# ──────────────────────────────────────────────────────────────────────────────
# CHOIX D'ARCHITECTURE : use_v2=True avec poids SSL V1 (chargement partiel)
# ──────────────────────────────────────────────────────────────────────────────
#
# Pourquoi use_v2=True ?
#   Swin UNETR V2 ajoute des connexions résiduelles dans les blocs du décodeur.
#   Sur des structures fines comme les coronaires (~1-2% des voxels), cela améliore
#   la précision des contours et la stabilité du gradient en profondeur.
#
# Pourquoi charger quand même les poids SSL (entraînés sur V1) ?
#   MONAI/NVIDIA fournit des poids pré-entraînés via Self-Supervised Learning (SSL)
#   sur 5 050 CT scans (dataset BTCV + données publiques).
#   Référence : Tang et al., "Self-Supervised Pre-Training of Swin Transformers
#               for 3D Medical Image Analysis", CVPR 2022.
#
#   Sans ces poids, le modèle démarre avec des poids aléatoires et doit apprendre
#   de zéro à comprendre les CT scans. Avec ~392 images d'entraînement,
#   ce risque d'overfitting est élevé.
#
#   Larsen et al. (Table 4.1) quantifient le gain sur leur dataset :
#       Sans pré-entraînement  → DSC = 0.8127
#       Avec pré-entraînement  → DSC = 0.8447   (+0.03 DSC)
#
# Compatibilité V1 → V2 :
#   Les poids SSL couvrent l'encodeur Swin Transformer (blocs d'attention, patch
#   embedding, etc.). L'encodeur est IDENTIQUE entre V1 et V2 — seul le décodeur
#   diffère (connexions résiduelles ajoutées en V2).
#   → Les poids de l'encodeur sont chargés exactement (strict=False ignore les
#     clés manquantes du décodeur V2).
#   → Le décodeur V2 démarre avec ses connexions résiduelles initialisées aléatoirement,
#     mais l'encodeur bénéficie des 5 050 CTs pré-entraînés.
#   → Résultat : meilleur des deux mondes — encodeur riche (SSL) + décodeur
#     amélioré (V2).
#
# Utilisation :
#   Télécharger les poids depuis MONAI Model Zoo :
#   https://github.com/Project-MONAI/MONAI-extra-model-weights
#   Fichier : model_swinvit.pt  (~600 MB)
#   Passer le chemin via pretrained_weights= dans le constructeur.
#   Si pretrained_weights=None, le modèle démarre sans pré-entraînement.
#
# ──────────────────────────────────────────────────────────────────────────────
# HYPERPARAMÈTRES — calqués sur Larsen et al. (Table 3.3/3.4 - ImageCAS fine-tuned)
# ──────────────────────────────────────────────────────────────────────────────
#
#   loss_funct    = 'dice_focal'   Dice + Focal loss (recommandé pour classes très
#                                  minoritaires comme les coronaires)
#   lr            = 2e-4           2x plus élevé que la valeur par défaut courante
#   warmup_epochs = 50             Les Transformers sont instables en début
#                                  d'entraînement sans warm-up ; Larsen utilise 50
#                                  pour les petits datasets (<200 images)
#   max_epochs    = 500            Larsen converge autour de 400-500 epochs
#   HU clipping   = [-200, 1411]   Plage coronaire-spécifique (vs z-score global)
#                                  appliqué en amont dans data/preprocessing.py
# ──────────────────────────────────────────────────────────────────────────────

import torch
import torch.nn as nn
import pytorch_lightning as pl
from monai.networks.nets import SwinUNETR
from monai.losses import DiceFocalLoss
try:
    from models.losses import DiceLoss, ClDiceLoss
except ImportError:
    from losses import DiceLoss, ClDiceLoss

class SwinUNETRSegmenter(pl.LightningModule):
    """
    Swin UNETR (use_v2=True) pour segmenter uniquement les coronaires (gauche + droite).

    Masques attendus :
        0 = fond (inclut les autres structures cardiaques)
        1 = coronaire gauche  (label 8 dans le masque 9 labels)
        2 = coronaire droite  (label 9 dans le masque 9 labels)

    Args:
        img_size          : taille du patch d'entrée (doit être multiple de 32)
        in_channels       : nombre de canaux en entrée (1 pour CT en niveaux de gris)
        feature_size      : taille des features Swin (48 = même que les poids SSL)
        loss_funct        : 'dice_focal' | 'crossentropy' | 'dice'
        lr                : learning rate initial (après warmup)
        warmup_epochs     : epochs de montée linéaire du lr (50 recommandé pour <200 images)
        max_epochs        : durée totale de l'entraînement
        pretrained_weights: chemin vers model_swinvit.pt (SSL BTCV), ou None
    """
    NUM_CLASSES = 3  # fond + gauche + droite

    def __init__(self, img_size=(128, 128, 128), in_channels=1, feature_size=48,
                 loss_funct='dice_focal', lr=1e-4, warmup_epochs=50, max_epochs=500,
                 pretrained_weights=None):
        super().__init__()
        self.save_hyperparameters()
        self.model = SwinUNETR(
            in_channels=in_channels,
            out_channels=self.NUM_CLASSES,
            feature_size=feature_size,
            use_checkpoint=True,
            use_v2=True,       # connexions résiduelles décodeur V2 — encodeur reste compatible SSL V1
        )

        # Chargement des poids SSL pré-entraînés (encodeur uniquement)
        # Les poids couvrent uniquement l'encodeur Swin Transformer, qui est
        # identique entre V1 et V2. strict=False ignore les clés manquantes
        # du décodeur V2 (connexions résiduelles) sans lever d'erreur.
        # Gain mesuré par Larsen et al. : +0.03 DSC avec ~100-200 images.
        if pretrained_weights is not None:
            weights = torch.load(pretrained_weights, map_location="cpu")
            # Les poids SSL sont stockés sous la clé "state_dict"
            state_dict = weights.get("state_dict", weights)
            # model_swinvit.pt utilise deux conventions différentes du modèle MONAI :
            #   "module."  → "swinViT."   (préfixe DataParallel)
            #   "mlp.fc1"  → "mlp.linear1" (renommage entre versions MONAI)
            #   "mlp.fc2"  → "mlp.linear2"
            remapped = {}
            for k, v in state_dict.items():
                k = k.replace("module.", "swinViT.")
                k = k.replace("mlp.fc1.", "mlp.linear1.")
                k = k.replace("mlp.fc2.", "mlp.linear2.")
                remapped[k] = v
            missing, unexpected = self.model.load_state_dict(remapped, strict=False)
            # Clés manquantes attendues :
            #   - décodeur V2 : connexions résiduelles (layers1c, layers2c...) → nouvelles en V2
            #   - têtes SSL dans le fichier (rotation_head, contrastive_head) → ignorées par strict=False
            # Seules les clés core encodeur (attention, MLP, patch_embed) doivent être chargées
            v2_residual = {"layers1c", "layers2c", "layers3c", "layers4c"}
            ssl_heads   = {"norm", "convTrans3d", "rotation_head", "contrastive_head"}
            encoder_missing = [
                k for k in missing
                if "swinViT" in k
                and not any(tag in k for tag in v2_residual)
            ]
            print(f"[SwinUNETR] Poids SSL chargés depuis {pretrained_weights}")
            print(f"  Encodeur core manquant   : {len(encoder_missing)}  (doit être 0)")
            print(f"  Résidus V2 (normal)      : {sum(1 for k in missing if any(t in k for t in v2_residual))}")
            print(f"  Décodeur manquant        : {sum(1 for k in missing if 'swinViT' not in k)}")
            print(f"  Têtes SSL ignorées       : {sum(1 for k in unexpected if any(t in k for t in ssl_heads))}")
            if encoder_missing:
                raise RuntimeError(f"Échec chargement encodeur SSL : {encoder_missing[:3]}")
        if loss_funct == 'dice_focal':
            # Combinaison recommandée pour structures très minoritaires (coronaires ~1-2% des voxels)
            # to_onehot_y=True : convertit les labels entiers en one-hot
            # softmax=True     : applique softmax sur les logits avant le calcul
            self.loss_fn = DiceFocalLoss(
                include_background=True,
                to_onehot_y=True,
                softmax=True,
            )
        elif loss_funct == 'crossentropy':
            # Ponderation : coronaires très minoritaires vs fond
            self.loss_fn = nn.CrossEntropyLoss(weight=torch.tensor([0.1, 1.0, 1.0]))
        elif loss_funct == 'dice':
            self.loss_fn = DiceLoss(nCls=self.NUM_CLASSES, average="micro")
        elif loss_funct == 'cldice':
            # clDice : Soft-Dice (50%) + clDice topologique (50%)
            # Optimisé pour les structures tubulaires fines (coronaires ~1-2mm)
            # Référence : Shit et al. 2021, "clDice - a Novel Topology-Preserving
            # Loss Function for Tubular Structure Segmentation"
            self.loss_fn = ClDiceLoss(alpha=0.5, iters=3)
        else:
            raise ValueError(f"Unknown loss: {loss_funct}")
        self.lr = lr
        self.warmup_epochs = warmup_epochs
        self.max_epochs = max_epochs
        # DiceFocalLoss attend (B,1,H,W,D), CrossEntropy attend (B,H,W,D)
        self._use_channel_dim = (loss_funct in ('dice_focal', 'cldice'))

    def forward(self, x):
        return self.model(x)

    def transfer_batch_to_device(self, batch, device, dataloader_idx):
        """Extrait les tenseurs du batch TorchIO avant transfert vers le device.
        Nécessaire car PyTorch Lightning ne sait pas reconstruire les objets TorchIO."""
        return {
            "CT":    {"data": batch["CT"]["data"].to(device)},
            "Label": {"data": batch["Label"]["data"].to(device)},
        }

    def _prepare_mask(self, batch):
        mask = batch["Label"]["data"]  # (B, 1, H, W, D), valeurs 0-9
        # Remappage : labels 1-7 → 0, label 8 → 1, label 9 → 2
        remapped = torch.zeros_like(mask)
        remapped[mask == 8] = 1
        remapped[mask == 9] = 2
        if self._use_channel_dim:
            return remapped[:, :1].long()   # (B, 1, H, W, D)
        return remapped[:, 0].long()        # (B, H, W, D)

    def training_step(self, batch, batch_idx):
        img = batch["CT"]["data"].to(dtype=torch.float32)
        mask = self._prepare_mask(batch)
        pred = self(img)
        loss = self.loss_fn(pred, mask)
        self.log("Train Loss", loss, prog_bar=True)
        return loss

    def validation_step(self, batch, batch_idx):
        img = batch["CT"]["data"].to(dtype=torch.float32)
        mask = self._prepare_mask(batch)
        pred = self(img)
        loss = self.loss_fn(pred, mask)
        self.log("Val Loss", loss, prog_bar=True)
        return loss

    def configure_optimizers(self):
        optimizer = torch.optim.AdamW(self.parameters(), lr=self.lr, weight_decay=1e-5)
        # Phase 1 : montée linéaire du lr de ~0 → lr sur warmup_epochs epochs
        warmup = torch.optim.lr_scheduler.LinearLR(
            optimizer,
            start_factor=1e-3,
            end_factor=1.0,
            total_iters=self.warmup_epochs,
        )
        # Phase 2 : décroissance cosinus sur le reste de l'entraînement
        cosine = torch.optim.lr_scheduler.CosineAnnealingLR(
            optimizer,
            T_max=max(1, self.max_epochs - self.warmup_epochs),
        )
        scheduler = torch.optim.lr_scheduler.SequentialLR(
            optimizer,
            schedulers=[warmup, cosine],
            milestones=[self.warmup_epochs],
        )
        return {
            "optimizer": optimizer,
            "lr_scheduler": {"scheduler": scheduler, "interval": "epoch"},
        }


def prepare_coronary_mask(label_array):
    """
    Transforme un masque 9-labels en masque pour Swin UNETR (3 classes).
    Input  : label_array avec valeurs 0-9
    Output : label_array avec valeurs :
             0 = fond + structures non-coronariennes (labels 1-7)
             1 = coronaire gauche (label 8)
             2 = coronaire droite (label 9)
    """
    import numpy as np
    coronary_mask = numpy_coronary_mask(label_array)
    return coronary_mask

def numpy_coronary_mask(label_array):
    import numpy as np
    out = np.zeros_like(label_array, dtype=np.int8)
    out[label_array == 8] = 1  # coronaire gauche
    out[label_array == 9] = 2  # coronaire droite
    return out
