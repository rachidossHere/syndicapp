import type { Language } from '@syndic/shared';

/**
 * Textes propres au design system (statuts, états des composants), en français et en arabe.
 * Les textes des écrans restent dans les traductions de l'appli : ici, uniquement ce que
 * les composants affichent ou annoncent d'eux-mêmes.
 */
const fr = {
  'status.payment.paid': 'Payé',
  'status.payment.unpaid': 'Impayé',
  'status.report.open': 'Ouvert',
  'status.report.in_progress': 'En cours',
  'status.report.resolved': 'Résolu',
  'common.loading': 'Chargement…',
  'field.showPassword': 'Afficher le mot de passe',
  'field.hidePassword': 'Masquer le mot de passe',
} as const;

export type UiMessageKey = keyof typeof fr;

const ar: Record<UiMessageKey, string> = {
  'status.payment.paid': 'مدفوع',
  'status.payment.unpaid': 'غير مدفوع',
  'status.report.open': 'مفتوح',
  'status.report.in_progress': 'قيد المعالجة',
  'status.report.resolved': 'تم الحل',
  'common.loading': 'جارٍ التحميل…',
  'field.showPassword': 'إظهار كلمة المرور',
  'field.hidePassword': 'إخفاء كلمة المرور',
};

export const uiMessages: Record<Language, Record<UiMessageKey, string>> = { fr, ar };

export function uiMessage(key: UiMessageKey, language: Language): string {
  return uiMessages[language][key];
}
