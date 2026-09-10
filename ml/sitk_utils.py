
# Utilitaires SimpleITK partagés entre data/ et inference/
# Séparés de dataset.py pour ne pas mélanger la logique PyTorch/TorchIO
# avec les manipulations d'images ITK bas-niveau.

import SimpleITK as sitk


def resample_to_spacing(img, target_spacing, mask=False):
    """
    Rééchantillonne une image CT à un espacement voxel cible (en mm).

    Pourquoi c'est important :
        Deux scanners avec des résolutions différentes (ex : [0.3, 0.3, 0.8] vs
        [0.5, 0.5, 0.5]) produiront des coronaires de tailles très différentes
        en voxels après un simple resize. Le modèle voit alors les mêmes structures
        à des échelles incohérentes d'une image à l'autre.
        En rééchantillonnant d'abord vers un espacement uniforme, toutes les
        images ont la même résolution physique et les coronaires occupent le même
        nombre de voxels approximativement.

    Calqué sur Larsen et al. (Table 3.4 - ImageCAS) :
        target_spacing = [0.35, 0.35, 0.5]  (en mm, ordre x, y, z)

    Args:
        img            : image SimpleITK
        target_spacing : liste [sx, sy, sz] en mm
        mask           : True pour les masques (interpolation NearestNeighbor)
    Returns:
        image SimpleITK rééchantillonnée
    """
    original_spacing = img.GetSpacing()          # (sx, sy, sz) en mm
    original_size    = img.GetSize()             # (nx, ny, nz) en voxels
    # Nouvelle taille en voxels pour conserver les dimensions physiques
    new_size = [
        int(round(orig_sz * orig_spc / tgt_spc))
        for orig_sz, orig_spc, tgt_spc
        in zip(original_size, original_spacing, target_spacing)
    ]
    resample = sitk.ResampleImageFilter()
    resample.SetOutputSpacing(target_spacing)
    resample.SetSize(new_size)
    resample.SetOutputDirection(img.GetDirection())
    resample.SetOutputOrigin(img.GetOrigin())
    resample.SetTransform(sitk.Transform())
    resample.SetDefaultPixelValue(img.GetPixelIDValue())
    if mask:
        resample.SetInterpolator(sitk.sitkNearestNeighbor)
    else:
        resample.SetInterpolator(sitk.sitkBSpline)
    return resample.Execute(img)


def resample_data(im, new_size, mask=False):
    """Resample image or mask to a fixed size."""
    reference_image = sitk.Image(new_size, im.GetPixelIDValue())
    reference_image.SetOrigin(im.GetOrigin())
    reference_image.SetDirection(im.GetDirection())
    reference_image.SetSpacing([
            sz * spc / nsz
            for nsz, sz, spc in zip(new_size, im.GetSize(), im.GetSpacing())])
    transform = sitk.AffineTransform(3)
    transform.SetMatrix(im.GetDirection())
    if mask:
        return sitk.Resample(im, reference_image, transform, sitk.sitkNearestNeighbor)
    else:
        return sitk.Resample(im, reference_image, transform, sitk.sitkLinear)


def np_to_image(img_arr, origin, spacing, direction, pixel_type):
    itk_img = sitk.GetImageFromArray(img_arr, isVector=False)
    itk_img = sitk.Cast(itk_img, pixel_type)
    itk_img.SetSpacing(spacing)
    itk_img.SetOrigin(origin)
    itk_img.SetDirection(direction)
    return itk_img


def resize_image(img, new_size, orient_final="LAS", mask=False):
    img = sitk.DICOMOrient(img, "LPS")
    img = resample_data(img, new_size, mask=mask)
    img = sitk.DICOMOrient(img, orient_final)
    return img
