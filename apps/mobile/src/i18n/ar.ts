import { arChargeTexts } from './ar-charges';
import { arAccountTexts } from './ar-accounts';
import { arExpenseTexts } from './ar-expenses';
import { arResidenceTexts } from './ar-residences';
import type { TranslationKey } from './fr';

/** Textes de l'appli en arabe. Le typage refuse une clé manquante ou en trop. */
export const ar: Record<TranslationKey, string> = {
  ...arResidenceTexts,
  ...arChargeTexts,
  ...arExpenseTexts,
  ...arAccountTexts,
  'auth.errors.nameRequired': 'أدخل اسمك.',
  'auth.errors.nameTooShort': 'حرفان على الأقل.',
  'auth.errors.nameTooLong': '80 حرفًا على الأكثر.',
  'auth.errors.emailRequired': 'أدخل بريدك الإلكتروني.',
  'auth.errors.invalidEmail': 'بريد إلكتروني غير صالح.',
  'auth.errors.passwordRequired': 'أدخل كلمة المرور.',
  'auth.errors.passwordTooShort': '8 أحرف على الأقل.',
  'auth.errors.passwordTooLong': 'كلمة المرور طويلة جدًا.',
  'auth.errors.passwordMismatch': 'كلمتا المرور غير متطابقتين.',
  'auth.errors.invalidInput': 'تحقّق من المعلومات المدخلة.',
  'auth.errors.invalidCredentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'auth.errors.signUpFailed': 'تعذّر إنشاء هذا الحساب. إذا كان لديك حساب بالفعل، سجّل الدخول.',
  'auth.errors.tooManyAttempts': 'محاولات كثيرة. أعد المحاولة بعد دقيقة.',
  'auth.errors.network': 'تعذّر الوصول إلى الخادم. تحقّق من اتصالك وأعد المحاولة.',
  'auth.errors.offline': 'لا يوجد اتصال بالإنترنت. فعّل الويفي أو بيانات الهاتف، ثم أعد المحاولة.',
  'auth.errors.unknown': 'حدث خطأ. أعد المحاولة.',

  'common.back': 'رجوع',
  'common.loading': 'جارٍ التحميل…',
  'common.retry': 'إعادة المحاولة',
  'common.cancel': 'إلغاء',
  'common.confirm': 'تأكيد',
  'common.closeSheet': 'إغلاق دون تغيير',
  'common.switchLanguage': 'التبديل إلى الفرنسية',

  'welcome.appName': 'SyndicApp',
  'welcome.logoLabel': 'شعار SyndicApp',
  'welcome.tagline': 'تدبير إقامتك، بسيط وشفاف لجميع الجيران.',
  'welcome.benefitCharges': 'المساهمات والوصولات في مكان واحد',
  'welcome.benefitExpenses': 'مصاريف ظاهرة مع فواتيرها',
  'welcome.benefitReports': 'البلاغات والإعلانات للجميع',
  'welcome.createAccount': 'إنشاء حساب',
  'welcome.haveAccount': 'لديّ حساب بالفعل',

  'signUp.title': 'إنشاء حساب',
  'signUp.subtitle': 'بعض المعلومات للبدء.',
  'signUp.name': 'الاسم الكامل',
  'signUp.email': 'البريد الإلكتروني',
  'signUp.password': 'كلمة المرور',
  'signUp.confirmPassword': 'تأكيد كلمة المرور',
  'signUp.submit': 'إنشاء حسابي',
  'signUp.legal': 'بإنشاء حساب، فإنك توافق على شروط الاستخدام وسياسة الخصوصية.',
  'signUp.haveAccount': 'لديك حساب بالفعل؟',
  'signUp.signInLink': 'تسجيل الدخول',

  'signIn.title': 'مرحبًا بعودتك',
  'signIn.subtitle': 'سجّل الدخول للوصول إلى إقامتك.',
  'signIn.email': 'البريد الإلكتروني',
  'signIn.password': 'كلمة المرور',
  'signIn.submit': 'تسجيل الدخول',
  'signIn.noAccount': 'ليس لديك حساب؟',
  'signIn.signUpLink': 'إنشاء حساب',

  'home.greeting': 'مرحبًا {name}',
  'home.welcomeToast': 'تم إنشاء الحساب · مرحبًا بك في SyndicApp',
  'home.noResidence': 'لست عضوًا في أي إقامة بعد. ماذا تريد أن تفعل؟',
  'home.createResidenceTitle': 'إنشاء إقامتي',
  'home.createResidenceBody': 'أنا السنديك: أضيف الشقق وأدعو جيراني.',
  'home.joinResidenceTitle': 'لديّ رمز دعوة',
  'home.joinResidenceBody': 'أرسل لي السنديك رمزًا أو رابطًا.',
  'home.signOut': 'تسجيل الخروج',
  'home.loadError': 'تعذّر تحميل ملفك الشخصي.',

  'dev.designSystem': 'نظام التصميم (وضع التطوير)',
  'dev.apiUrl': 'عنوان واجهة API: {url}',
};
