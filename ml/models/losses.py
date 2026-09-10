
import torch
import torch.nn as nn
import torch.nn.functional as F


# ─────────────────────────────────────────────────────────────────────────────
# clDice Loss — Shit et al. 2021 "clDice - a Novel Topology-Preserving Loss
# Function for Tubular Structure Segmentation"
# Conçu pour les structures tubulaires (coronaires, vaisseaux) : préserve la
# topologie de la ligne centrale en plus de la géométrie volumique.
# ─────────────────────────────────────────────────────────────────────────────

def soft_erode(img):
	"""Érosion morphologique douce (soft min via max pooling négatif)."""
	return -F.max_pool3d(-img, kernel_size=3, stride=1, padding=1)


def soft_dilate(img):
	"""Dilatation morphologique douce."""
	return F.max_pool3d(img, kernel_size=3, stride=1, padding=1)


def soft_skel(img, iters=3):
	"""
	Squelettisation différentiable par érosions itératives (Shit et al. 2021).
	iters : nombre d'itérations — plus élevé = squelette plus fin.
	Pour des coronaires (~1-2mm), 3 itérations sont recommandées.
	"""
	img1 = soft_dilate(soft_erode(img))          # ouverture morphologique
	skel = F.relu(img - img1)
	for _ in range(iters):
		img  = soft_erode(img)
		img1 = soft_dilate(soft_erode(img))       # ouverture sur version érodée
		delta = F.relu(img - img1)
		skel  = skel + F.relu(delta - soft_dilate(skel))
	return skel


class ClDiceLoss(nn.Module):
	"""
	Perte combinée Soft-Dice + clDice pour structures tubulaires.

	L = alpha * SoftDice + (1 - alpha) * clDice

	Args:
		alpha   : poids du Soft-Dice (0.5 = équilibré, 0.4 = faveur clDice)
		iters   : itérations de squelettisation (3 recommandé pour coronaires)
		smooth  : epsilon numérique pour éviter div/0

	Entrées attendues :
		y_pred : (B, C, D, H, W) logits
		y_true : (B, 1, D, H, W) labels entiers
	"""
	def __init__(self, alpha=0.5, iters=3, smooth=1e-5):
		super().__init__()
		self.alpha  = alpha
		self.iters  = iters
		self.smooth = smooth

	def forward(self, y_pred, y_true):
		num_classes = y_pred.shape[1]
		probs = torch.softmax(y_pred, dim=1)          # (B, C, D, H, W)

		# One-hot encode du masque GT
		target_onehot = torch.zeros_like(probs)
		target_onehot.scatter_(1, y_true, 1)           # (B, C, D, H, W)

		dice_total = 0.0
		cl_total   = 0.0

		for c in range(1, num_classes):               # ignorer le fond
			pred_c = probs[:, c:c+1]                  # (B, 1, D, H, W)
			true_c = target_onehot[:, c:c+1]

			# Soft Dice
			inter     = (pred_c * true_c).sum()
			soft_dice = (2 * inter + self.smooth) / (pred_c.sum() + true_c.sum() + self.smooth)
			dice_total += (1.0 - soft_dice)

			# clDice : précision + sensibilité sur les squelettes
			skel_pred = soft_skel(pred_c, self.iters)
			skel_true = soft_skel(true_c, self.iters)
			cl_prec   = (skel_pred * true_c).sum() / (skel_pred.sum() + self.smooth)
			cl_sens   = (skel_true * pred_c).sum()  / (skel_true.sum() + self.smooth)
			cl_dice   = 2 * cl_prec * cl_sens / (cl_prec + cl_sens + self.smooth)
			cl_total  += (1.0 - cl_dice)

		n = num_classes - 1
		return self.alpha * dice_total / n + (1.0 - self.alpha) * cl_total / n

def dice_loss(pred, ref, nCls, average, eps: float = 1e-8):
	"""
	Calcule la perte Dice (1 - Dice Score).
	"""
	pred_soft = torch.softmax(pred, dim=1)
	pred_soft = torch.argmax(pred_soft, dim=1)
	pred_soft = torch.nn.functional.one_hot(pred_soft, num_classes=nCls).permute(0, 4, 1, 2, 3)
	ref_one_hot = torch.nn.functional.one_hot(ref, num_classes=nCls).permute(0, 4, 1, 2, 3)
	if average == "micro":
		intersection = torch.sum(pred_soft[:,1:,:,:,:] * ref_one_hot[:,1:,:,:,:], dim=1)
		cardinality = torch.sum(pred_soft[:,1:,:,:,:] + ref_one_hot[:,1:,:,:,:], dim=1)
	else:
		intersection = torch.sum(pred_soft[:,1:,:,:,:] * ref_one_hot[:,1:,:,:,:])
		cardinality = torch.sum(pred_soft[:,1:,:,:,:] + ref_one_hot[:,1:,:,:,:])
	dice_score = 2.0 * intersection / (cardinality + eps)
	dice_loss = -dice_score + 1.0
	dice_loss = torch.mean(dice_loss)
	return dice_loss

class DiceLoss(nn.Module):
	"""
	Module PyTorch pour la perte Dice.
	"""
	def __init__(self, nCls, average, eps: float = 1e-8) -> None:
		super().__init__()
		self.nCls = nCls
		self.average = average
		self.eps = eps
	def forward(self, pred, ref):
		return dice_loss(pred, ref, self.nCls, self.average, self.eps)
