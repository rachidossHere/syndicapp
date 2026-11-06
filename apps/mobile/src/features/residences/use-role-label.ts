import { ROLE_LABEL_KEYS, type Role } from '@syndic/shared';

import { useT } from '@/i18n/use-t';

/** Libellé traduit d'un rôle (« Copropriétaire »), ou en minuscules pour une phrase. */
export function useRoleLabel() {
  const t = useT();
  return (role: Role, options: { lower?: boolean } = {}) => {
    const label = t(ROLE_LABEL_KEYS[role]);
    return options.lower ? label.toLocaleLowerCase() : label;
  };
}
