import type { ExpenseCategory, ExpenseErrorKey } from '@syndic/shared';

/** Refus de l'API des dépenses (clés de @syndic/shared) : le typage exige une traduction pour chacun. */
const expenseErrors: Record<ExpenseErrorKey, string> = {
  'expenses.errors.notFound': 'Dépense introuvable. Actualisez la liste.',
  'expenses.errors.alreadyCancelled': 'Cette dépense est déjà annulée.',
  'expenses.errors.cancelReasonRequired': 'Indiquez le motif de l’annulation.',
  'expenses.errors.dateInFuture': 'La date de la dépense ne peut pas être dans le futur.',
  'expenses.errors.invalidFileType': 'Format non accepté. Choisissez une photo (JPEG, PNG) ou un PDF.',
  'expenses.errors.fileTooLarge': 'Ce fichier est trop lourd (10 Mo au maximum).',
  'expenses.errors.invoiceNotFound': 'La facture n’a pas été reçue. Réessayez de l’envoyer.',
  'expenses.errors.openingReasonRequired': 'Indiquez le motif de la correction.',
};

/** Libellés des catégories (@syndic/shared : EXPENSE_CATEGORY_LABEL_KEYS). */
const categories: Record<`expenses.category.${ExpenseCategory}`, string> = {
  'expenses.category.maintenance': 'Entretien',
  'expenses.category.elevator': 'Ascenseur',
  'expenses.category.electricity': 'Électricité',
  'expenses.category.water': 'Eau',
  'expenses.category.cleaning': 'Nettoyage',
  'expenses.category.security': 'Gardiennage',
  'expenses.category.repairs': 'Réparations',
  'expenses.category.other': 'Autre',
};

/** Textes de l'ajout d'une dépense (plan 06, étape 3 ; écrans 2 et 3 de docs/depenses.png). */
export const frExpenseTexts = {
  ...expenseErrors,
  ...categories,

  // Erreurs du formulaire et de la facture.
  'expenses.errors.labelRequired': 'Indiquez pour quoi.',
  'expenses.errors.labelTooLong': '120 caractères au maximum.',
  'expenses.errors.amountInvalid': 'Indiquez un montant valide, par exemple 600 ou 600,50.',
  'expenses.errors.categoryRequired': 'Choisissez une catégorie.',
  'expenses.errors.dateInvalid': 'Choisissez une date.',
  'expenses.errors.uploadFailed': 'L’envoi de la facture a échoué. Réessayez.',
  'expenses.errors.pdfTooLarge': 'Ce PDF dépasse 10 Mo. Choisissez un fichier plus léger.',
  'expenses.errors.cameraDenied':
    'L’accès à l’appareil photo est refusé. Autorisez-le dans les réglages du téléphone, ou choisissez une image.',
  'expenses.errors.pickFailed': 'Impossible de lire ce fichier. Essayez-en un autre.',

  'home.addExpense': 'Ajouter une dépense',
  'home.addExpenseBody': 'Photo de la facture, montant, catégorie.',

  'expenses.add.title': 'Nouvelle dépense',

  'expenses.invoice.take': 'Prendre la facture en photo',
  'expenses.invoice.or': 'ou choisir une image ou un PDF',
  'expenses.invoice.preparing': 'Préparation de la facture…',
  'expenses.invoice.added': 'Facture ajoutée',
  'expenses.invoice.chooseTitle': 'Choisir la facture',
  'expenses.invoice.gallery': 'Une image de la galerie',
  'expenses.invoice.pdf': 'Un fichier PDF',
  'expenses.invoice.changeTitle': 'Facture',
  'expenses.invoice.changeLabel': 'Facture ajoutée. Toucher pour la reprendre ou la retirer.',
  'expenses.invoice.previewLabel': 'Aperçu de la facture',
  'expenses.invoice.retake': 'Reprendre la photo',
  'expenses.invoice.another': 'Choisir un autre fichier',
  'expenses.invoice.remove': 'Retirer la facture',

  'expenses.field.label': 'Pour quoi ?',
  'expenses.field.labelPlaceholder': 'Ex. : plombier, fuite parking',
  'expenses.field.amount': 'Montant',
  'expenses.field.amountPlaceholder': 'Ex. : 600',
  'expenses.field.currency': 'MAD',
  'expenses.field.date': 'Date',
  'expenses.field.dateSheet': 'Date de la dépense',
  'expenses.field.category': 'Catégorie',
  'expenses.date.display': '{day} {month} {year}',

  'expenses.submit': 'Enregistrer la dépense',
  'expenses.uploading': 'Envoi de la facture… {percent} %',
  'expenses.saving': 'Enregistrement…',
  'expenses.note.withInvoice': 'Visible par tous les copropriétaires, avec sa facture.',
  'expenses.note.withoutInvoice':
    'Sans facture, la dépense sera visible par tous les copropriétaires avec la mention « Sans facture ».',
  'expenses.toast.withInvoice': 'Dépense enregistrée avec facture · visible par tous',
  'expenses.toast.withoutInvoice': 'Dépense enregistrée sans facture · visible par tous',
} as const;
