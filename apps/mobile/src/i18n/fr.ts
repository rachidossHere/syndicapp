import type { AuthErrorKey } from '@syndic/shared';

import { frChargeTexts } from './fr-charges';
import { frResidenceTexts } from './fr-residences';

/** Erreurs d'authentification (clés de @syndic/shared) : le typage exige une traduction pour chacune. */
const authErrors: Record<AuthErrorKey, string> = {
  'auth.errors.nameRequired': 'Indiquez votre nom.',
  'auth.errors.nameTooShort': 'Au moins 2 caractères.',
  'auth.errors.nameTooLong': '80 caractères au maximum.',
  'auth.errors.emailRequired': 'Indiquez votre adresse e-mail.',
  'auth.errors.invalidEmail': 'Adresse e-mail invalide.',
  'auth.errors.passwordRequired': 'Indiquez votre mot de passe.',
  'auth.errors.passwordTooShort': 'Au moins 8 caractères.',
  'auth.errors.passwordTooLong': 'Mot de passe trop long.',
  'auth.errors.passwordMismatch': 'Les mots de passe ne correspondent pas.',
  'auth.errors.invalidInput': 'Vérifiez les informations saisies.',
  'auth.errors.invalidCredentials': 'E-mail ou mot de passe incorrect.',
  'auth.errors.signUpFailed': 'Impossible de créer ce compte. Si vous en avez déjà un, connectez-vous.',
  'auth.errors.tooManyAttempts': 'Trop de tentatives. Réessayez dans une minute.',
  'auth.errors.network': 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',
  'auth.errors.offline': 'Pas de connexion Internet. Activez le Wi-Fi ou les données mobiles, puis réessayez.',
  'auth.errors.unknown': 'Une erreur est survenue. Réessayez.',
};

/** Textes de l'appli en français (langue de référence : ses clés définissent TranslationKey). */
export const fr = {
  ...authErrors,
  ...frResidenceTexts,
  ...frChargeTexts,

  'common.back': 'Retour',
  'common.loading': 'Chargement…',
  'common.retry': 'Réessayer',
  'common.switchLanguage': 'Passer en arabe',

  'welcome.appName': 'SyndicApp',
  'welcome.logoLabel': 'Logo de SyndicApp',
  'welcome.tagline': 'La gestion de votre résidence, simple et transparente pour tous les voisins.',
  'welcome.benefitCharges': 'Charges et reçus au même endroit',
  'welcome.benefitExpenses': 'Dépenses visibles avec leurs factures',
  'welcome.benefitReports': 'Signalements et annonces pour tous',
  'welcome.createAccount': 'Créer un compte',
  'welcome.haveAccount': 'J’ai déjà un compte',

  'signUp.title': 'Créer un compte',
  'signUp.subtitle': 'Quelques informations pour commencer.',
  'signUp.name': 'Nom complet',
  'signUp.email': 'Adresse e-mail',
  'signUp.password': 'Mot de passe',
  'signUp.confirmPassword': 'Confirmer le mot de passe',
  'signUp.submit': 'Créer mon compte',
  'signUp.legal': 'En créant un compte, vous acceptez les conditions d’utilisation et la politique de confidentialité.',
  'signUp.haveAccount': 'Déjà un compte ?',
  'signUp.signInLink': 'Se connecter',

  'signIn.title': 'Bon retour',
  'signIn.subtitle': 'Connectez-vous pour retrouver votre résidence.',
  'signIn.email': 'Adresse e-mail',
  'signIn.password': 'Mot de passe',
  'signIn.submit': 'Se connecter',
  'signIn.noAccount': 'Pas encore de compte ?',
  'signIn.signUpLink': 'Créer un compte',

  'home.greeting': 'Bonjour {name}',
  'home.welcomeToast': 'Compte créé · bienvenue sur SyndicApp',
  'home.noResidence': 'Vous n’êtes encore membre d’aucune résidence. Que voulez-vous faire ?',
  'home.createResidenceTitle': 'Créer ma résidence',
  'home.createResidenceBody': 'Je suis le syndic : j’ajoute les appartements et j’invite mes voisins.',
  'home.joinResidenceTitle': 'J’ai un code d’invitation',
  'home.joinResidenceBody': 'Mon syndic m’a envoyé un code ou un lien.',
  'home.signOut': 'Se déconnecter',
  'home.loadError': 'Impossible de charger votre profil.',

  'dev.designSystem': 'Design system (développement)',
  'dev.apiUrl': 'Adresse de l’API : {url}',
};

/** Toutes les clés de traduction de l'appli. */
export type TranslationKey = keyof typeof fr;
