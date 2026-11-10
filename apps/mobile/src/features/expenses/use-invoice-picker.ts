// Choix de la facture : appareil photo, galerie (expo-image-picker) ou PDF (expo-document-picker).
// Une image est compressée avant tout envoi (1600 px de large au plus, JPEG 0,7).
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { EXPENSE_FORM_ERRORS } from '@/lib/expense-form';
import { invoiceCompressionPlan, isInvoiceTooLarge, isPdfAsset, type InvoiceFile } from '@/lib/invoice';

/** Réduit l'image à 1600 px de large au plus, puis l'enregistre en JPEG de qualité 0,7. */
async function compressImage(uri: string, width: number | undefined): Promise<InvoiceFile> {
  const plan = invoiceCompressionPlan(width);
  const context = ImageManipulator.manipulate(uri);
  if (plan.resizeWidth !== undefined) context.resize({ width: plan.resizeWidth });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: plan.compress, format: SaveFormat.JPEG });
  return { uri: saved.uri, kind: 'image', contentType: 'image/jpeg' };
}

const IMAGE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  // Qualité maximale ici : la seule compression est celle de compressImage (pas de double perte).
  quality: 1,
};

/**
 * État de la facture d'une dépense et actions pour la choisir. `errorKey` est une clé de
 * traduction (expenses.errors.*) à afficher près de la zone.
 */
export function useInvoicePicker() {
  const [invoice, setInvoice] = useState<InvoiceFile | undefined>();
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | undefined>();

  const fromImagePicker = useCallback(async (launch: () => Promise<ImagePicker.ImagePickerResult>) => {
    setErrorKey(undefined);
    setBusy(true);
    try {
      const result = await launch();
      const asset = result.canceled ? undefined : result.assets[0];
      if (asset !== undefined) setInvoice(await compressImage(asset.uri, asset.width));
    } catch {
      setErrorKey(EXPENSE_FORM_ERRORS.pickFailed);
    } finally {
      setBusy(false);
    }
  }, []);

  /** Appareil photo : l'autorisation est demandée au premier usage (texte : app.json). */
  const takePhoto = useCallback(async () => {
    setErrorKey(undefined);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setErrorKey(EXPENSE_FORM_ERRORS.cameraDenied);
        return;
      }
    } catch {
      setErrorKey(EXPENSE_FORM_ERRORS.pickFailed);
      return;
    }
    await fromImagePicker(() => ImagePicker.launchCameraAsync(IMAGE_OPTIONS));
  }, [fromImagePicker]);

  const chooseImage = useCallback(
    () => fromImagePicker(() => ImagePicker.launchImageLibraryAsync(IMAGE_OPTIONS)),
    [fromImagePicker],
  );

  const choosePdf = useCallback(async () => {
    setErrorKey(undefined);
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (asset === undefined) return;
      if (!isPdfAsset(asset)) setErrorKey(EXPENSE_FORM_ERRORS.pickFailed);
      else if (isInvoiceTooLarge(asset.size)) setErrorKey(EXPENSE_FORM_ERRORS.pdfTooLarge);
      else setInvoice({ uri: asset.uri, kind: 'pdf', contentType: 'application/pdf', name: asset.name });
    } catch {
      setErrorKey(EXPENSE_FORM_ERRORS.pickFailed);
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = useCallback(() => {
    setInvoice(undefined);
    setErrorKey(undefined);
  }, []);

  return { invoice, busy, errorKey, takePhoto, chooseImage, choosePdf, remove };
}
