import { DEFAULT_LANGUAGE, isLanguage, isRtlLanguage, type Language } from '@syndic/shared';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import { DevSettings, I18nManager } from 'react-native';

// La langue n'est pas un secret : expo-secure-store est utilisé pour sa lecture synchrone
// au démarrage (le skill expo-native-ui proscrit AsyncStorage).
const STORAGE_KEY = 'syndic.language';

/** Langue mémorisée sur le téléphone, ou le français par défaut. */
export function readStoredLanguage(): Language {
  try {
    const stored = SecureStore.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    // Stockage indisponible (web) : langue par défaut.
    return DEFAULT_LANGUAGE;
  }
}

export async function storeLanguage(language: Language): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, language);
}

/**
 * Aligne le sens d'écriture natif sur la langue.
 * En français, `allowRTL(false)` évite qu'un téléphone réglé en arabe inverse la mise en page.
 * Le nouveau sens ne s'applique qu'après un rechargement : renvoie `true` s'il en faut un.
 */
export function syncLayoutDirection(language: Language): boolean {
  const rtl = isRtlLanguage(language);
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return I18nManager.isRTL !== rtl;
}

/**
 * Recharge l'appli avec expo-updates, y compris en développement et dans Expo Go :
 * `DevSettings.reload()` ne recharge que le moteur React Native, sans réinstaller les
 * modules natifs d'Expo Go (erreur « Cannot find native module 'ExpoAsset' »).
 * DevSettings ne sert que de secours si expo-updates refuse le rechargement.
 */
export async function reloadApp(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch (error) {
    console.warn('[language] Updates.reloadAsync a échoué, repli sur DevSettings :', error);
    DevSettings.reload('Changement de langue');
  }
}
