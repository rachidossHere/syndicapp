import type { frHomeTexts } from './fr-home';

/** Textes de la barre d'onglets, des accueils et du Profil en arabe : mêmes clés que le français. */
export const arHomeTexts: Record<keyof typeof frHomeTexts, string> = {
  // Barre d'onglets
  'tabs.home': 'الرئيسية',
  'tabs.charges': 'المصاريف',
  'tabs.accounts': 'الحسابات',
  'tabs.myCharges': 'مصاريفي',
  'tabs.issues': 'البلاغات',
  'tabs.report': 'إبلاغ',
  'tabs.announcements': 'الإعلانات',
  'tabs.profile': 'ملفي',
  'tabs.a11yLabel': 'التنقل الرئيسي',

  // Salutation : « الأربعاء 18 نونبر » (توقيت الدار البيضاء)
  'home.date': '{weekday} {day} {month}',
  'home.weekday.1': 'الاثنين',
  'home.weekday.2': 'الثلاثاء',
  'home.weekday.3': 'الأربعاء',
  'home.weekday.4': 'الخميس',
  'home.weekday.5': 'الجمعة',
  'home.weekday.6': 'السبت',
  'home.weekday.7': 'الأحد',
  'home.heroRole': 'أنت {role}',

  // Accueil du syndic, du trésorier et de l'adjoint
  'home.cash.title': 'رصيد الصندوق',
  'home.cash.collected': 'مُستخلَصة',
  'home.cash.spent': 'مصروفة',
  'home.cash.period': 'الفترة: {period}',
  'home.cash.a11y': 'رصيد الصندوق: {balance}. {collected} مُستخلَصة و{spent} مصروفة، الفترة {period}. يفتح الحسابات.',
  'home.cash.loadError': 'تعذّر تحميل الصندوق.',
  'home.attention.title': 'للمعالجة',
  'home.attention.unpaid.one': 'مستحق واحد غير مؤدّى',
  'home.attention.unpaid.other': '{count} مستحقات غير مؤدّاة',
  'home.attention.urgent.one': 'بلاغ عاجل واحد',
  'home.attention.urgent.other': '{count} بلاغات عاجلة',
  'home.attention.toHandle.one': 'بلاغ واحد للمعالجة',
  'home.attention.toHandle.other': '{count} بلاغات للمعالجة',
  'home.quick.title': 'وصول سريع',
  'home.quick.expense': 'مصروف',

  // Accueil de l'habitant
  'home.charges.title': 'مصاريف {period}',
  'home.charges.progress': 'المؤدّى: {paid} من {total}',
  'home.charges.allPaidTitle': 'تم أداء كل شيء',
  'home.charges.allPaidBody': 'شكرًا. وصلك موجود في السجل.',
  'home.charges.seeMine': 'عرض مصاريفي',

  // Profil
  'profile.title': 'ملفي',
  'profile.residence': 'الإقامة النشطة',
  'profile.noResidence': 'لا توجد إقامة نشطة',
  'profile.switchResidence': 'تغيير الإقامة',
  'profile.language': 'اللغة',
  'profile.language.fr': 'Français',
  'profile.language.ar': 'العربية',
  'profile.version': 'SyndicApp · الإصدار {version}',
};
