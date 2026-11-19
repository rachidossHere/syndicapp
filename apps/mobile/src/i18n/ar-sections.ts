import type { frSectionTexts } from './fr-sections';

/** Textes des écrans en accordéons en arabe : le typage exige les mêmes clés que le français. */
export const arSectionTexts: Record<keyof typeof frSectionTexts, string> = {
  'sections.loadError': 'تعذّر تحميل هذا القسم.',
  'sections.loadMore': 'عرض المزيد',
  'sections.loadMoreError': 'تعذّر تحميل المزيد.',

  'sections.charges.callsOne': 'طلب واحد',
  'sections.charges.calls': '{count} طلبات',
  'sections.charges.collectedPct': 'محصَّل بنسبة {percent}٪',
  'sections.charges.settled': 'مسدَّد',
  'sections.charges.callLine': '{paid} / {total} مدفوع · آخر أجل {date}',

  'sections.unpaid.summaryOne': 'متأخرة واحدة · المتبقي {amount}',
  'sections.unpaid.summaryMany': '{count} متأخرات · المتبقي {amount}',

  'sections.mine.paidOfOne': 'مدفوع {paid} من {total}',
  'sections.mine.paidOfMany': 'مدفوع {paid} من {total}',

  'sections.accounts.summary': '+{collected} · −{spent}',

  'sections.issues.open': 'المفتوحة',
  'sections.issues.in_progress': 'قيد المعالجة',
  'sections.issues.resolved': 'المحلولة',
  'sections.issues.openSummary': '{count} في انتظار التكفل',
  'sections.issues.inProgressSummary': '{count} قيد المعالجة',
  'sections.issues.resolvedSummaryOne': 'بلاغ واحد محلول',
  'sections.issues.resolvedSummary': '{count} بلاغات محلولة',
  'sections.issues.empty': 'لا توجد بلاغات في هذا القسم.',

  'sections.announcements.countOne': 'إعلان واحد',
  'sections.announcements.count': '{count} إعلانات',

  'sections.profile.residenceHint': '{role} · تغيير الإقامة',
  'sections.profile.languageHint': 'الفرنسية أو العربية',
};
