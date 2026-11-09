import { describe, expect, it } from 'vitest';

import { schemaResolver } from './form-resolver';
import { expenseFieldsFrom, expenseFormSchema, type ExpenseFormValues } from './expense-form';

const TODAY = '2026-11-09';
const valid: ExpenseFormValues = {
  label: '  Plombier · fuite parking ',
  amount: '600',
  spentOn: '2026-11-08',
  category: 'repairs',
};

const errorsOf = (values: ExpenseFormValues) => {
  const result = expenseFormSchema(TODAY).safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
};

describe('formulaire de dépense', () => {
  it('accepte une saisie valide et la convertit en centimes', () => {
    expect(errorsOf(valid)).toEqual({});
    expect(expenseFieldsFrom(valid, TODAY)).toEqual({
      label: 'Plombier · fuite parking',
      amount: 60000,
      category: 'repairs',
      spentOn: '2026-11-08',
    });
    expect(expenseFieldsFrom({ ...valid, amount: '1 200,50' }, TODAY)?.amount).toBe(120050);
  });

  it('formulaire vide : une erreur sous chaque champ obligatoire', () => {
    expect(errorsOf({ label: '', amount: '', spentOn: TODAY, category: '' })).toEqual({
      label: 'expenses.errors.labelRequired',
      amount: 'expenses.errors.amountInvalid',
      category: 'expenses.errors.categoryRequired',
    });
  });

  it('refuse un libellé de blancs ou trop long', () => {
    expect(errorsOf({ ...valid, label: '   ' }).label).toBe('expenses.errors.labelRequired');
    expect(errorsOf({ ...valid, label: 'x'.repeat(121) }).label).toBe('expenses.errors.labelTooLong');
  });

  it('refuse un montant nul, négatif, illisible ou à plus de deux décimales', () => {
    for (const amount of ['0', '-5', 'abc', '12,345', '']) {
      expect(errorsOf({ ...valid, amount }).amount, amount).toBe('expenses.errors.amountInvalid');
    }
  });

  it('refuse une date invalide ou future', () => {
    expect(errorsOf({ ...valid, spentOn: '2026-02-31' }).spentOn).toBe('expenses.errors.dateInvalid');
    expect(errorsOf({ ...valid, spentOn: '2026-11-10' }).spentOn).toBe('expenses.errors.dateInFuture');
    expect(errorsOf({ ...valid, spentOn: TODAY })).toEqual({});
  });

  it('refuse une catégorie hors liste', () => {
    expect(errorsOf({ ...valid, category: 'pizza' as never }).category).toBe('expenses.errors.categoryRequired');
    expect(expenseFieldsFrom({ ...valid, category: '' }, TODAY)).toBeUndefined();
  });

  it('se branche sur React Hook Form : erreurs par champ, sous forme de clés', async () => {
    const resolver = schemaResolver(expenseFormSchema(TODAY));
    const result = await resolver({ ...valid, label: '', amount: 'x' }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(result.errors.label?.message).toBe('expenses.errors.labelRequired');
    expect(result.errors.amount?.message).toBe('expenses.errors.amountInvalid');
    expect(result.errors.category).toBeUndefined();
  });
});
