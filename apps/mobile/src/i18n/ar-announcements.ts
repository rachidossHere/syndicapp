import type { AnnouncementCategory, AnnouncementErrorKey } from '@syndic/shared';

import type { frAnnouncementTexts } from './fr-announcements';

const announcementErrors: Record<AnnouncementErrorKey, string> = {
  'announcements.errors.notFound': 'الإعلان غير موجود. حدّث القائمة.',
};

const categories: Record<`announcements.category.${AnnouncementCategory}`, string> = {
  'announcements.category.works': 'أشغال',
  'announcements.category.meeting': 'جمع عام',
  'announcements.category.info': 'معلومة',
  'announcements.category.urgent': 'عاجل',
};

export const arAnnouncementTexts: Record<keyof typeof frAnnouncementTexts, string> = {
  ...announcementErrors,
  ...categories,

  'home.announcements': 'الإعلانات',
  'home.announcementsBody': 'أخبار إقامتك.',
  'announcements.latest.title': 'آخر إعلان',
  'announcements.latest.seeAll': 'عرض كل الإعلانات',

  'announcements.title': 'الإعلانات',
  'announcements.pinned': 'مثبّت',
  'announcements.pinnedMeta': 'مثبّت · {meta}',
  'announcements.filter.all': 'الكل',
  'announcements.filterEmpty.title': 'لا توجد إعلانات في هذه الفئة',
  'announcements.filterEmpty.body': 'اختر فئة أخرى لرؤية بقية الإعلانات.',
  'announcements.new': 'إعلان جديد',
  'announcements.loadError': 'تعذّر تحميل الإعلانات.',
  'announcements.loadMoreError': 'تعذّر تحميل باقي الإعلانات.',
  'announcements.empty.title': 'لا توجد إعلانات حاليًا',
  'announcements.empty.body': 'ستظهر هنا إعلانات الإقامة.',
  'announcements.empty.bodyManager': 'انشر أول إعلان لإشعار جميع الأعضاء.',
  'announcements.rowLabel': '{title}، {category}',
  'announcements.pinnedRowLabel': '{title}، {category}، مثبّت',

  'announcements.author.manager': 'السنديك',
  'announcements.author.deputy': 'النائب',
  'announcements.when.today': 'اليوم على الساعة {time}',
  'announcements.when.yesterday': 'أمس',
  'announcements.meta': '{author} · {when}',

  'announcements.detail.title': 'إعلان',
  'announcements.pin': 'تثبيت',
  'announcements.unpin': 'إلغاء التثبيت',
  'announcements.toast.pinned': 'تم تثبيت الإعلان',
  'announcements.toast.unpinned': 'تم إلغاء تثبيت الإعلان',
  'announcements.pinError': 'تعذّر تغيير التثبيت. أعد المحاولة.',

  'announcements.form.title': 'إعلان جديد',
  'announcements.field.category': 'الفئة',
  'announcements.field.title': 'العنوان',
  'announcements.field.titlePlaceholder': 'مثال: انقطاع الماء يوم الخميس 20 نونبر',
  'announcements.field.body': 'الرسالة',
  'announcements.field.bodyPlaceholder': 'تفاصيل للسكان',
  'announcements.pinToggle.label': 'تثبيت في الأعلى',
  'announcements.pinToggle.description': 'يبقى في أعلى القائمة',
  'announcements.audience.unknown': 'سيتم إشعار أعضاء الإقامة',
  'announcements.audience.one': 'سيتم إشعار عضو واحد من الإقامة',
  'announcements.audience.other': 'سيتم إشعار {count} من أعضاء الإقامة',
  'announcements.audience.none': 'لا يوجد أعضاء آخرون لإشعارهم حاليًا',
  'announcements.submit': 'نشر الإعلان',
  'announcements.toast.published': 'تم نشر الإعلان',
  'announcements.errors.titleRequired': 'أدخل عنوانًا.',
  'announcements.errors.titleTooLong': '80 حرفًا على الأكثر.',
  'announcements.errors.bodyRequired': 'اكتب الرسالة.',
  'announcements.errors.bodyTooLong': '1000 حرف على الأكثر.',

  'announcements.simulate.button': 'محاكاة إشعار',
  'announcements.simulate.hint': 'اختبار (للتطوير): يصل إشعار محلي خلال 5 ثوانٍ. المسه لفتح الشاشة المرتبطة.',
  'announcements.simulate.scheduled': 'تمت برمجة الإشعار: ضع التطبيق في الخلفية، سيصل خلال 5 ثوانٍ.',
  'announcements.simulate.noAnnouncement': 'انشر أولًا إعلانًا في هذه الإقامة.',
  'announcements.simulate.denied': 'اسمح بإشعارات الهاتف لإجراء الاختبار.',
  'announcements.simulate.failed': 'تعذّرت برمجة إشعار الاختبار.',
  'announcements.simulate.body': 'إعلان جديد في إقامتك',
  'announcements.simulate.bodyUrgent': 'إعلان عاجل في إقامتك',
};
