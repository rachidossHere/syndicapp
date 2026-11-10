import type { ExpenseCategory, ExpenseErrorKey } from '@syndic/shared';

import type { frExpenseTexts } from './fr-expenses';

const expenseErrors: Record<ExpenseErrorKey, string> = {
  'expenses.errors.notFound': 'المصروف غير موجود. حدّث القائمة.',
  'expenses.errors.alreadyCancelled': 'تم إلغاء هذا المصروف من قبل.',
  'expenses.errors.cancelReasonRequired': 'اذكر سبب الإلغاء.',
  'expenses.errors.dateInFuture': 'لا يمكن أن يكون تاريخ المصروف في المستقبل.',
  'expenses.errors.invalidFileType': 'صيغة غير مقبولة. اختر صورة (JPEG أو PNG) أو ملف PDF.',
  'expenses.errors.fileTooLarge': 'حجم هذا الملف كبير جدًا (10 ميغابايت كحد أقصى).',
  'expenses.errors.invoiceNotFound': 'لم يتم استلام الفاتورة. أعد محاولة إرسالها.',
  'expenses.errors.openingReasonRequired': 'اذكر سبب التصحيح.',
};

const categories: Record<`expenses.category.${ExpenseCategory}`, string> = {
  'expenses.category.maintenance': 'صيانة',
  'expenses.category.elevator': 'المصعد',
  'expenses.category.electricity': 'الكهرباء',
  'expenses.category.water': 'الماء',
  'expenses.category.cleaning': 'النظافة',
  'expenses.category.security': 'الحراسة',
  'expenses.category.repairs': 'إصلاحات',
  'expenses.category.other': 'أخرى',
};

export const arExpenseTexts: Record<keyof typeof frExpenseTexts, string> = {
  ...expenseErrors,
  ...categories,

  'expenses.errors.labelRequired': 'اذكر سبب المصروف.',
  'expenses.errors.labelTooLong': '120 حرفًا كحد أقصى.',
  'expenses.errors.amountInvalid': 'أدخل مبلغًا صحيحًا، مثل 600 أو 600,50.',
  'expenses.errors.categoryRequired': 'اختر فئة.',
  'expenses.errors.dateInvalid': 'اختر تاريخًا.',
  'expenses.errors.uploadFailed': 'فشل إرسال الفاتورة. أعد المحاولة.',
  'expenses.errors.pdfTooLarge': 'يتجاوز هذا الملف 10 ميغابايت. اختر ملفًا أخف.',
  'expenses.errors.cameraDenied':
    'تم رفض الوصول إلى الكاميرا. اسمح به من إعدادات الهاتف، أو اختر صورة.',
  'expenses.errors.pickFailed': 'تعذّرت قراءة هذا الملف. جرّب ملفًا آخر.',

  'home.addExpense': 'إضافة مصروف',
  'home.addExpenseBody': 'صورة الفاتورة والمبلغ والفئة.',

  'expenses.add.title': 'مصروف جديد',

  'expenses.invoice.take': 'التقط صورة للفاتورة',
  'expenses.invoice.or': 'أو اختر صورة أو ملف PDF',
  'expenses.invoice.preparing': 'جارٍ تجهيز الفاتورة…',
  'expenses.invoice.added': 'تمت إضافة الفاتورة',
  'expenses.invoice.chooseTitle': 'اختيار الفاتورة',
  'expenses.invoice.gallery': 'صورة من المعرض',
  'expenses.invoice.pdf': 'ملف PDF',
  'expenses.invoice.changeTitle': 'الفاتورة',
  'expenses.invoice.changeLabel': 'تمت إضافة الفاتورة. المس لإعادة التصوير أو لإزالتها.',
  'expenses.invoice.previewLabel': 'معاينة الفاتورة',
  'expenses.invoice.retake': 'إعادة التقاط الصورة',
  'expenses.invoice.another': 'اختيار ملف آخر',
  'expenses.invoice.remove': 'إزالة الفاتورة',

  'expenses.field.label': 'لأي غرض؟',
  'expenses.field.labelPlaceholder': 'مثال: سبّاك، تسرّب في المرآب',
  'expenses.field.amount': 'المبلغ',
  'expenses.field.amountPlaceholder': 'مثال: 600',
  'expenses.field.currency': 'MAD',
  'expenses.field.date': 'التاريخ',
  'expenses.field.dateSheet': 'تاريخ المصروف',
  'expenses.field.category': 'الفئة',
  'expenses.date.display': '{day} {month} {year}',

  'expenses.submit': 'تسجيل المصروف',
  'expenses.uploading': 'جارٍ إرسال الفاتورة… {percent} %',
  'expenses.saving': 'جارٍ التسجيل…',
  'expenses.note.withInvoice': 'يراه جميع الملاك، مع فاتورته.',
  'expenses.note.withoutInvoice': 'بدون فاتورة، سيراه جميع الملاك مع عبارة «بدون فاتورة».',
  'expenses.toast.withInvoice': 'تم تسجيل المصروف مع الفاتورة · يراه الجميع',
  'expenses.toast.withoutInvoice': 'تم تسجيل المصروف بدون فاتورة · يراه الجميع',
};
