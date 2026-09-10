
import SimpleITK as sitk
import numpy as np
import nibabel as nib
from sitk_utils import resize_image, np_to_image, resample_to_spacing
import torchio as tio
import time

def preprocess_image(img, new_size, orient_final, hu_min=None, hu_max=None,
	                 target_spacing=None):
	"""
	Rééchantillonne (optionnel), redimensionne et normalise une image CT.

	Ordre des opérations :
	  1. Rééchantillonnage isotropique vers target_spacing (si fourni)
	     → toutes les images ont le même espacement voxel en mm
	  2. Resize vers new_size en voxels
	  3. Clip HU + normalisation

	Args:
	    target_spacing : liste [sx, sy, sz] en mm, ex [0.35, 0.35, 0.5]
	                     (Larsen et al. Table 3.4 - ImageCAS)
	                     Si None : pas de rééchantillonnage préalable.
	    hu_min/hu_max  : clip HU puis normalisation min-max → [0, 1]
	                     Si None : clip à -1024 puis z-score.
	"""
	if target_spacing is not None:
		img = resample_to_spacing(img, target_spacing, mask=False)
	img_preprocessed = resize_image(img, new_size, orient_final)
	img_array = sitk.GetArrayFromImage(img_preprocessed)
	if hu_min is not None and hu_max is not None:
		# Normalisation spécifique coronaires : clip HU puis min-max → [0, 1]
		img_array = np.clip(img_array, hu_min, hu_max)
		img_array = (img_array - hu_min) / (hu_max - hu_min)
	else:
		img_array[img_array < -1024] = -1024
		img_array = (img_array - np.mean(img_array)) / np.std(img_array)
	img_preprocessed = np_to_image(img_array, img_preprocessed.GetOrigin(), 
							   img_preprocessed.GetSpacing(), 
							   img_preprocessed.GetDirection(), sitk.sitkFloat32)
	return img_preprocessed

def crop_image(pred_img, margin, img):
	padded_box = [0,0,0,0,0,0]
	component = sitk.ConnectedComponent(pred_img)
	sorted_component_image = sitk.RelabelComponent(component, sortByObjectSize=True)
	largest_component = sorted_component_image == 1
	stats = sitk.LabelStatisticsImageFilter()
	stats.Execute(img, largest_component)
	box = stats.GetBoundingBox(1)
	x = (box[1]-box[0]) * img.GetSpacing()[0] * (1+margin)
	x = x  / img.GetSpacing()[0]
	x = x - (box[1]-box[0])
	padded_box[0] = box[0] - x//2
	padded_box[1] = box[1] + x//2
	y = (box[3]-box[2]) * img.GetSpacing()[1] * (1+margin)
	y = y  / img.GetSpacing()[1]
	y = y - (box[3]-box[2])
	padded_box[2] = box[2] - y//2
	padded_box[3] = box[3] + y//2
	z = (box[5]-box[4]) * img.GetSpacing()[2] * (1+margin)
	z = z  / img.GetSpacing()[2]
	z = z - (box[5]-box[4])
	padded_box[4] = box[4] - z//2
	padded_box[5] = box[5] + z//2
	padded_box = [0 if i < 0 else i for i in padded_box]
	if (padded_box[1] > img.GetSize()[0]):
		padded_box[1] = img.GetSize()[0]
	if (padded_box[3] > img.GetSize()[1]):
		padded_box[3] = img.GetSize()[1]
	if (padded_box[5] > img.GetSize()[2]):
		padded_box[5] = img.GetSize()[2]
	for i in range(6):
		padded_box[i] = int(padded_box[i])
	cropped_img = sitk.Crop(img, [padded_box[0], padded_box[2], padded_box[4]], 
						[img.GetSize()[0]- padded_box[1], 
						 img.GetSize()[1] - padded_box[3], 
						 img.GetSize()[2] - padded_box[5]])
	return (cropped_img, padded_box)

def restore_dimensions(img, cropped_pred, padded_box):
	target = sitk.Image(img.GetSize(), sitk.sitkInt16)
	target.CopyInformation(img)
	target = sitk.Paste(target, cropped_pred, 
				   cropped_pred.GetSize(), 
				   [0,0,0], 
				   [padded_box[0], padded_box[2], padded_box[4]])
	return target
