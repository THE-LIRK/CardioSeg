import pytorch_lightning as pl
from pytorch_lightning.callbacks import ModelCheckpoint
from pytorch_lightning.loggers import TensorBoardLogger
import torch
import numpy as np
import csv
import os
import torch.nn as nn
from torch.nn import init
from dataset import cambiar_tam, np_to_image
import SimpleITK as sitk
import torchio as tio
import nibabel as nib

import torch
from pathlib import Path
import torchio as tio
import argparse
import nibabel as nib
import numpy as np
import SimpleITK as sitk
from dataset import cambiar_tam, np_to_image
import time

def create_trainer(train_loader, val_loader=None, max_epochs=100, gpus=1, save_dir="./logs", name="default"):
    """
    Crée un entraîneur PyTorch Lightning avec les callbacks appropriés.
    
    Args:
        train_loader: DataLoader pour l'entraînement
        val_loader: DataLoader pour la validation (optionnel)
        max_epochs: Nombre maximum d'épochs d'entraînement
        gpus: Nombre de GPUs à utiliser
        save_dir: Répertoire pour sauvegarder les logs
        name: Nom de l'expérience
        
    Returns:
        Un entraîneur PyTorch Lightning configuré
    """
    # Configuration du callback de sauvegarde des meilleurs modèles
    checkpoint_callback = ModelCheckpoint(
    monitor = "Val Loss",
    save_top_k = 1,
    mode = "min"
    )

    # Si pas de validation, on sauvegarde les meilleurs modèles selon la perte d'entraînement
    if val_loader is None:
        checkpoint_callback = ModelCheckpoint(
        monitor = "Train Loss",
        save_top_k = 5,
        mode = "min"
    )

    # Configuration de l'arrêt précoce si la validation s'améliore pas
    if val_loader != None:
        early_stop_callback = pl.callbacks.EarlyStopping(
            monitor='Val Loss',
            patience=25,
            min_delta=0.00,
            mode='min',
            verbose=True
        )

    # Création du trainer sans validation
    if val_loader is None:
        gpus = gpus
        trainer = pl.Trainer(accelerator='gpu', logger=TensorBoardLogger(save_dir = save_dir, name = name), log_every_n_steps=1, callbacks=checkpoint_callback, max_epochs=max_epochs, limit_val_batches=0)
        return trainer

    # Création du trainer avec validation et arrêt précoce
    else:
        gpus = gpus
        trainer = pl.Trainer(accelerator='gpu', logger=TensorBoardLogger(save_dir = save_dir, name = name), log_every_n_steps=1, callbacks=[checkpoint_callback, early_stop_callback], max_epochs=max_epochs)
        return trainer

class DiceScore(torch.nn.Module):
    """
    Classe pour calculer le coefficient de Dice.
    Le coefficient de Dice mesure la similarité entre deux ensembles (prédiction vs réalité).
    C'est une métrique couramment utilisée en segmentation médicale.
    """
    def __init__(self, num_classes=8, ignore_back=None, mean_loss=False):
        """
        Initialise le calculateur de Dice.
        
        Args:
            num_classes: Nombre de classes de segmentation
            ignore_back: Index de la classe à ignorer (généralement le fond)
            mean_loss: Si True, retourne la perte moyenne, sinon retourne les scores individuels
        """
        super().__init__()

        self.num_classes = num_classes
        self.ignore_back = ignore_back
        self.mean_loss = mean_loss

    def forward(self, pred, target):
        """
        Calcule le score Dice.
        
        Args:
            pred: Prédictions du modèle
            target: Images de référence (vérité terrain)
            
        Returns:
            Liste des scores Dice pour chaque classe
        """
        clases = self.num_classes

        # Aplatir les tenseurs pour le calcul
        target = torch.flatten(target)
        pred = torch.flatten(pred)

        # Convertir en représentation one-hot
        target_one_hot = torch.nn.functional.one_hot(target.to(torch.int64), num_classes=8)
        pred_one_hot = torch.nn.functional.one_hot(pred.to(torch.int64), num_classes=8)

        # Calculer le Dice pour chaque classe
        dice = []
        for clase in range(clases):
            # Ignorer une classe spécifique (généralement le fond)
            if clase == self.ignore_back:
                continue
            
            # Calculer l'intersection (pixels correctement prédits)
            resultado = (target_one_hot[:, clase] * pred_one_hot[:, clase]).sum()
            
            # Calculer l'union
            denum = target_one_hot[:, clase].sum() + pred_one_hot[:, clase].sum()

            # Si pas de pixels pour cette classe, considérer le score comme parfait
            if denum == 0:
               dice.append(1)
               continue

            # Formule du Dice: 2 * intersection / (prédiction + vérité)
            dice_indv = (2*resultado) / denum
            dice.append(dice_indv)

        # Retourner la perte ou les scores selon le paramètre
        if self.mean_loss:
            return 1 - torch.mean(torch.tensor(dice))
        
        return dice
    
def test_step(model, test_loader, path):
    """
    Effectue une étape de test et calcule les scores Dice.
    
    Args:
        model: Modèle à tester
        test_loader: DataLoader contenant les données de test
        path: Chemin des fichiers (non utilisé actuellement)
        
    Returns:
        Tuple contenant la perte moyenne et les scores Dice pour chaque image
    """
    dice = DiceScore(num_classes=8)

    scores = []

    # Mode évaluation (pas de gradient, pas de dropout)
    with torch.no_grad():
        model.eval()
        for i, batch in enumerate(test_loader):
            # Charger et préparer les données
            img = batch["CT"]["data"].to(dtype=torch.float32)
            mask = batch["Label"]["data"][:,0]
            mask = mask.long()

            # Faire une prédiction
            pred = model(img)
            loss = model.loss(pred, mask)

            # Convertir les logits en prédictions (softmax puis argmax)
            pred = torch.softmax(pred, dim=1)
            pred = torch.argmax(pred, dim=1)

            # Calculer le score Dice
            scores.append(dice(pred, mask))

    
    return (loss, [torch.Tensor(score) for score in scores])

def test_step_2labels(model, test_loader, path):
    """
    Effectue une étape de test avec 2 labels et calcule l'intersection sur union (IoU).
    Utilisée pour les modèles de détection du cœur (segmentation binaire).
    
    Args:
        model: Modèle à tester
        test_loader: DataLoader contenant les données de test
        path: Chemin des fichiers (non utilisé actuellement)
        
    Returns:
        Tuple contenant la perte moyenne et les scores IoU pour chaque image
    """
    dice = DiceScore(num_classes=2)

    scores = []

    with torch.no_grad():
        model.eval()
        for i, batch in enumerate(test_loader):
            # Charger et préparer les données
            img = batch["CT"]["data"].to(dtype=torch.float32)
            mask = batch["Label"]["data"][:,0]
            mask = mask.long()

            # Faire une prédiction
            pred = model(img)
            loss = model.loss(pred, mask)

            # Convertir les logits en prédictions
            pred = torch.softmax(pred, dim=1)
            pred = torch.argmax(pred, dim=1)

            # ================================================================
            # ÉTAPE 1: Extraire la boîte englobante de la vérité terrain
            # ================================================================
            mask = mask.squeeze().cpu().numpy().transpose(2,1,0)
            mask_img = sitk.GetImageFromArray(mask)

            # Trouver la plus grande composante connexe
            componente = sitk.ConnectedComponent(mask_img)
            sorted_component_image = sitk.RelabelComponent(componente, sortByObjectSize=True)
            largest_component = sorted_component_image == 1

            # Obtenir la boîte englobante
            stats = sitk.LabelStatisticsImageFilter()
            stats.Execute(mask_img, largest_component)
            box = stats.GetBoundingBox(1)

            # Remplir la boîte dans un masque
            box_mask_image = sitk.Image(mask_img.GetSize(), sitk.sitkInt16)
            box_mask_array = sitk.GetArrayFromImage(box_mask_image)

            for i in range(box[0], box[1]):
                for j in range(box[2], box[3]):
                    for k in range(box[4], box[5]):
                        box_mask_array[k,j,i] = 1

            # ================================================================
            # ÉTAPE 2: Extraire la boîte englobante de la prédiction
            # ================================================================
            pred = pred.squeeze().cpu().numpy().transpose(2,1,0)
            pred_img = sitk.GetImageFromArray(pred)

            # Trouver la plus grande composante connexe
            componente = sitk.ConnectedComponent(pred_img)
            sorted_component_image = sitk.RelabelComponent(componente, sortByObjectSize=True)
            largest_component = sorted_component_image == 1

            # Obtenir la boîte englobante
            stats = sitk.LabelStatisticsImageFilter()
            stats.Execute(pred_img, largest_component)
            box = stats.GetBoundingBox(1)

            # Remplir la boîte dans un masque
            box_pred_image = sitk.Image(pred_img.GetSize(), sitk.sitkInt16)
            box_pred_array = sitk.GetArrayFromImage(box_pred_image)

            for i in range(box[0], box[1]):
                for j in range(box[2], box[3]):
                    for k in range(box[4], box[5]):
                        box_pred_array[k,j,i] = 1

            # ================================================================
            # ÉTAPE 3: Calculer l'IoU (Intersection over Union)
            # ================================================================
            box_mask_array = box_mask_array.flatten()
            box_pred_array = box_pred_array.flatten()

            # Calculer intersection et union
            intersection = np.logical_and(box_mask_array, box_pred_array)
            union = np.logical_or(box_mask_array, box_pred_array)

            # Score IoU
            iou = intersection.sum() / union.sum()

            scores.append(torch.tensor([iou]))

    
    return (loss, [torch.Tensor(score) for score in scores])

def reset_weights(m):
  """
  Réinitialise les poids des couches du modèle.
  Utile pour éviter les fuites de poids lors du transfert d'apprentissage.
  """
  for layer in m.children():
   if hasattr(layer, 'reset_parameters'):
    print(f'Réinitialisation des paramètres entrainable de la couche = {layer}')
    layer.reset_parameters()


def weight_init(m):
    """
    Initialise les poids du modèle avec Xavier Normal (Glorot).
    Utilisé pour les couches Conv3D.
    """
    if isinstance(m, nn.Conv3d):
        init.xavier_normal_(m.weight)
        init.constant_(m.bias, 0)


def log_results(dice, loss, name, archivo = "results.csv"):
   """
   Enregistre les résultats de test dans un fichier CSV.
   
   Args:
       dice: Liste des scores Dice par classe
       loss: Perte moyenne
       name: Nom de l'expérience ou du modèle
       archivo: Chemin du fichier CSV de sortie
   """
   # Calculer les statistiques
   dices_medios = torch.mean(torch.stack(dice), dim=0)
   dices_desviacion = torch.std(torch.stack(dice), dim=0)
   loss_medio = torch.mean(torch.tensor(loss))
   
   # Vérifier si le fichier existe déjà
   archivo_existe = os.path.exists(archivo)
   
   # Écrire les résultats dans le CSV
   with open(archivo, mode='a', newline='') as archivo_csv:
        campos = ['Nombre'] + [f'Dice{i}' for i in range(1, 9)] + ['Loss']
        writer = csv.DictWriter(archivo_csv, fieldnames=campos)

        # Créer l'en-tête si c'est la première fois
        if not archivo_existe:
            writer.writeheader()

        # Extraire les valeurs et les écarts types
        valores_lista = list(zip(dices_medios.tolist(), dices_desviacion.tolist()))

        # Écrire la ligne
        writer.writerow({'Nombre': name, **{f'Dice{i}': valor for i, valor in enumerate(valores_lista, start=1)}, 'Loss': loss_medio.item()})

def dice_loss(pred, ref, nCls, average, eps: float = 1e-8):
    """
    Calcule la perte Dice (1 - Dice Score).
    La perte Dice mesure à quel point les prédictions correspondent à la vérité terrain.
    
    Args:
        pred: Logits de prédiction du modèle
        ref: Labels de référence (vérité terrain)
        nCls: Nombre de classes
        average: Type de moyenne ("micro" ou autre)
        eps: Petite valeur pour éviter la division par zéro
        
    Returns:
        Perte Dice moyenne
    """
    # Convertir les logits en probabilités avec softmax
    pred_soft = torch.softmax(pred, dim=1)
    # Prendre l'argument maximum pour obtenir les classes prédites
    pred_soft = torch.argmax(pred_soft, dim=1)
    # Convertir en représentation one-hot
    pred_soft = torch.nn.functional.one_hot(pred_soft, num_classes = nCls).permute(0, 4, 1, 2, 3)

    # Créer la représentation one-hot de la vérité terrain
    ref_one_hot = torch.nn.functional.one_hot(ref, num_classes = nCls).permute(0, 4, 1, 2, 3)

    # Calculer la perte Dice
    if average == "micro":
        # Agréger les résultats sur toutes les classes
        intersection = torch.sum(pred_soft[:,1:,:,:,:] * ref_one_hot[:,1:,:,:,:], dim=1)
        cardinality = torch.sum(pred_soft[:,1:,:,:,:] + ref_one_hot[:,1:,:,:,:], dim=1)
    else:
        # Calculer séparément pour chaque classe
        intersection = torch.sum(pred_soft[:,1:,:,:,:] * ref_one_hot[:,1:,:,:,:])
        cardinality = torch.sum(pred_soft[:,1:,:,:,:] + ref_one_hot[:,1:,:,:,:])

    # Formule du Dice: 2 * intersection / cardinality
    dice_score = 2.0 * intersection / (cardinality + eps)
    # Perte = 1 - Dice Score
    dice_loss = -dice_score + 1.0

    # Réduire la perte en moyenne
    dice_loss = torch.mean(dice_loss)

    return dice_loss



class DiceLoss(nn.Module):
    """
    Module PyTorch pour la perte Dice.
    Encapsule la fonction dice_loss dans un module entraînable.
    """
    def __init__(self, nCls, average, eps: float = 1e-8) -> None:
        """
        Args:
            nCls: Nombre de classes
            average: Type de moyenne ("micro" ou autre)
            eps: Petite valeur pour éviter la division par zéro
        """
        super().__init__()
        self.nCls = nCls
        self.average = average
        self.eps = eps

    def forward(self, pred, ref):
        return dice_loss(pred, ref, self.nCls, self.average, self.eps)

#Utils for prediction

def preprocesar_imagen(img, nuevo_tamanho, orient_final):
    """
    Prétraite une image médicale pour la prédiction.
    
    Args:
        img: Image médicale (SimpleITK)
        nuevo_tamanho: Nouveau taille de l'image
        orient_final: Orientation finale souhaitée
        
    Returns:
        Image prétraitée normalisée
    """
    # Redimensionner l'image et changer son orientation
    img_preprocesada = cambiar_tam(img, nuevo_tamanho, orient_final)
    
    # Extraire le tableau NumPy
    img_array = sitk.GetArrayFromImage(img_preprocesada)
    
    # Clipper les valeurs (Hounsfield) - limiter aux valeurs communes du scanner
    img_array[img_array < -1024] = -1024
    
    # Normaliser l'image (soustraction de la moyenne, division par l'écart-type)
    img_array = (img_array - np.mean(img_array)) / np.std(img_array)
    
    # Convertir le tableau en image SimpleITK
    img_preprocesada = np_to_image(img_array, img_preprocesada.GetOrigin(), 
                                   img_preprocesada.GetSpacing(), 
                                   img_preprocesada.GetDirection(), sitk.sitkFloat32)

    return img_preprocesada

def prediccion_crop(img_preprocesada, img, model_crop, device, img_nib):
    """
    Effectue la prédiction de la première phase: détection du cœur complet.
    
    Args:
        img_preprocesada: Image prétraitée
        img: Image originale SimpleITK
        model_crop: Modèle pour la détection du cœur
        device: Dispositif (CPU ou GPU)
        img_nib: Image originale Nibabel
        
    Returns:
        Tuple (image prédite, temps d'inférence)
    """
    # Créer un sujet TorchIO avec l'image prétraitée
    subject = tio.Subject({"CT": tio.ScalarImage.from_sitk(img_preprocesada)})

    with torch.no_grad():
        model_crop.eval()
        # Extraire les données et ajouter la dimension batch
        datos = subject["CT"][tio.DATA].to(device).unsqueeze(0)
        tiempo_inicio = time.time()
        
        # Prédiction
        pred = model_crop(datos)
        tiempo_fin = time.time()
        
        # Convertir les logits en prédictions (softmax puis argmax)
        pred = torch.softmax(pred, dim=1)
        pred = torch.argmax(pred, dim=1)

    # Convertir le tenseur en tableau NumPy avec la bonne orientation
    pred = pred.squeeze().cpu().numpy().transpose(2,1,0)

    # Convertir le tableau en image SimpleITK
    img_inferida = np_to_image(pred, img_preprocesada.GetOrigin(), 
                               img_preprocesada.GetSpacing(), 
                               img_preprocesada.GetDirection(), sitk.sitkInt16)

    # Adapter l'image prédit aux dimensions de l'image originale
    img_prueba = sitk.DICOMOrient(img, "LPS")

    img_inferida_final = cambiar_tam(img_inferida, img_prueba.GetSize(), 
                                     "".join(list(nib.aff2axcodes(img_nib.affine))), mask=True)

    return img_inferida_final, (tiempo_fin - tiempo_inicio)

def crop_imagen(img_inferida_final, MARGEN_SEGURIDAD, img):
    """
    Extrait une boîte englobante autour du cœur détecté et applique une marge de sécurité.
    
    Args:
        img_inferida_final: Image de prédiction du cœur
        MARGEN_SEGURIDAD: Marge de sécurité en pourcentage (ex: 0.15 = 15%)
        img: Image originale SimpleITK
        
    Returns:
        Tuple (image croppée, boîte ajustée)
    """
    centro = [0,0,0]
    box_ajustado = [0,0,0,0,0,0]
    boxes = []

    # Trouver les composantes connexes dans la prédiction
    componente = sitk.ConnectedComponent(img_inferida_final)
    # Réétiqueter les composantes par taille (la plus grande en premier)
    sorted_component_image = sitk.RelabelComponent(componente, sortByObjectSize=True)
    # Sélectionner la plus grande composante (le cœur)
    largest_component = sorted_component_image == 1

    # Obtenir les statistiques des labels
    stats = sitk.LabelStatisticsImageFilter()
    stats.Execute(img, largest_component)
    box = stats.GetBoundingBox(1)

    # ========================================================================
    # Appliquer la marge de sécurité sur chaque dimension
    # ========================================================================
    # Dimension X
    x = (box[1]-box[0]) * img.GetSpacing()[0] * (1+MARGEN_SEGURIDAD)
    x = x  / img.GetSpacing()[0]  # Convertir en pixels
    x = x - (box[1]-box[0])        # Différence de pixels
    box_ajustado[0] = box[0] - x//2
    box_ajustado[1] = box[1] + x//2

    # Dimension Y
    y = (box[3]-box[2]) * img.GetSpacing()[1] * (1+MARGEN_SEGURIDAD)
    y = y  / img.GetSpacing()[1]
    y = y - (box[3]-box[2])
    box_ajustado[2] = box[2] - y//2
    box_ajustado[3] = box[3] + y//2

    # Dimension Z
    z = (box[5]-box[4]) * img.GetSpacing()[2] * (1+MARGEN_SEGURIDAD)
    z = z  / img.GetSpacing()[2]
    z = z - (box[5]-box[4])
    box_ajustado[4] = box[4] - z//2
    box_ajustado[5] = box[5] + z//2

    # S'assurer que la boîte est à l'intérieur des limites de l'image
    box_ajustado = [0 if i < 0 else i for i in box_ajustado]
    if (box_ajustado[1] > img.GetSize()[0]):
        box_ajustado[1] = img.GetSize()[0]

    if (box_ajustado[3] > img.GetSize()[1]):
        box_ajustado[3] = img.GetSize()[1]

    if (box_ajustado[5] > img.GetSize()[2]):
        box_ajustado[5] = img.GetSize()[2]

    # Convertir en entiers
    for i in range(6):
        box_ajustado[i] = int(box_ajustado[i])

    # Cropper l'image
    imagen_cropeada = sitk.Crop(img, [box_ajustado[0], box_ajustado[2], box_ajustado[4]], 
                                [img.GetSize()[0]- box_ajustado[1], 
                                 img.GetSize()[1] - box_ajustado[3], 
                                 img.GetSize()[2] - box_ajustado[5]])

    return (imagen_cropeada, box_ajustado)

def prediccion(imagen_cropeada_preprocesada, model_seg, labels_normales, imagen_cropeada, device, img_nib):
    """
    Effectue la prédiction de la deuxième phase: segmentation détaillée des structures cardiaques.
    
    Args:
        imagen_cropeada_preprocesada: Image croppée et prétraitée
        model_seg: Modèle de segmentation
        labels_normales: Dictionnaire de mapping des classes en valeurs Hounsfield
        imagen_cropeada: Image croppée originale
        device: Dispositif (CPU ou GPU)
        img_nib: Image originale Nibabel
        
    Returns:
        Tuple (image prédite final, temps d'inférence)
    """
    # Créer un sujet TorchIO avec l'image croppée prétraitée
    subject = tio.Subject({"CT": tio.ScalarImage.from_sitk(imagen_cropeada_preprocesada)})

    with torch.no_grad():
        # Extraire les données et ajouter la dimension batch
        datos = subject["CT"][tio.DATA].to(device).unsqueeze(0)
        tiempo_inicio = time.time()
        
        # Prédiction
        pred = model_seg(datos)
        tiempo_fin = time.time()
        
        # Convertir les logits en prédictions
        pred = torch.softmax(pred, dim=1)
        pred = torch.argmax(pred, dim=1)

    # Convertir le tenseur en tableau NumPy avec la bonne orientation
    pred = pred.squeeze().cpu().numpy().transpose(2,1,0)

    # Filtrer les prédictions pour ne garder que les classes valides
    pred = np.where(np.isin(pred, list(labels_normales.keys())), pred, 0)

    # Convertir le tableau en image SimpleITK
    img_cropeada_inferida = np_to_image(pred, imagen_cropeada_preprocesada.GetOrigin(), 
                                        imagen_cropeada_preprocesada.GetSpacing(), 
                                        imagen_cropeada_preprocesada.GetDirection(), sitk.sitkInt16)

    # Adapter l'image prédite aux dimensions de l'image croppée originale
    img_cropeada_prueba = sitk.DICOMOrient(imagen_cropeada, "LPS")

    img_inferida_cropeada_final = cambiar_tam(img_cropeada_inferida, img_cropeada_prueba.GetSize(), 
                                               "".join(list(nib.aff2axcodes(img_nib.affine))), mask=True)

    return img_inferida_cropeada_final, (tiempo_fin - tiempo_inicio)

def devolver_dimensiones(img, img_inferida_cropeada_final, box_ajustado):
    """
    Réexpand l'image prédite croppée aux dimensions de l'image originale.
    
    Args:
        img: Image originale SimpleITK
        img_inferida_cropeada_final: Image prédite croppée
        box_ajustado: Boîte de crop (coordonnées)
        
    Returns:
        Image prédite aux dimensions originales
    """
    # Créer une image cible avec les dimensions de l'image originale
    target = sitk.Image(img.GetSize(), sitk.sitkInt16)
    # Copier les informations spatiales de l'image originale
    target.CopyInformation(img)

    # Coller l'image prédite croppée dans l'image cible aux bonnes coordonnées
    target = sitk.Paste(target, img_inferida_cropeada_final, 
                       img_inferida_cropeada_final.GetSize(), 
                       [0,0,0], 
                       [box_ajustado[0], box_ajustado[2], box_ajustado[4]])

    return target