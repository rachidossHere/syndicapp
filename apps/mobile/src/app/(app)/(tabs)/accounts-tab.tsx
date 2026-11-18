import { AccountsScreen } from '@/features/accounts/accounts-screen';

/** Onglet « Comptes » de l'adjoint : les autres rôles ouvrent `/accounts`, au-dessus des onglets. */
export default function AccountsTabRoute() {
  return <AccountsScreen asTab />;
}
