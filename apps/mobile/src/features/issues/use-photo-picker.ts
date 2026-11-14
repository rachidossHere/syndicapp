// Photo d'un signalement : appareil photo ou galerie. Même compression que les factures
// (1600 px de large au plus, JPEG 0,7) avant tout envoi. Pas de PDF : une photo seulement.
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { IMAGE_OPTIONS, compressImage } from '@/features/expenses/use-invoice-picker';
import type { InvoiceFile } from '@/lib/invoice';
import { ISSUE_FORM_ERRORS } from '@/lib/issues';

export function useIssuePhotoPicker() {
  const [photo, setPhoto] = useState<InvoiceFile | undefined>();
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | undefined>();

  const fromPicker = useCallback(async (launch: () => Promise<ImagePicker.ImagePickerResult>) => {
    setErrorKey(undefined);
    setBusy(true);
    try {
      const result = await launch();
      const asset = result.canceled ? undefined : result.assets[0];
      if (asset !== undefined) setPhoto(await compressImage(asset.uri, asset.width));
    } catch {
      setErrorKey(ISSUE_FORM_ERRORS.pickFailed);
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
        setErrorKey(ISSUE_FORM_ERRORS.cameraDenied);
        return;
      }
    } catch {
      setErrorKey(ISSUE_FORM_ERRORS.pickFailed);
      return;
    }
    await fromPicker(() => ImagePicker.launchCameraAsync(IMAGE_OPTIONS));
  }, [fromPicker]);

  const chooseImage = useCallback(
    () => fromPicker(() => ImagePicker.launchImageLibraryAsync(IMAGE_OPTIONS)),
    [fromPicker],
  );

  const remove = useCallback(() => {
    setPhoto(undefined);
    setErrorKey(undefined);
  }, []);

  return { photo, busy, errorKey, takePhoto, chooseImage, remove };
}
