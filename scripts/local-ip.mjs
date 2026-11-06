#!/usr/bin/env node
// Affiche l'adresse IP locale du PC et la ligne à mettre dans apps/mobile/.env.local.
// Le téléphone appelle l'API par cette adresse (pas localhost). Ce script ne modifie aucun fichier.
// Usage : pnpm ip
import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const API_PORT = process.env.PORT || '3000';
const envFile = fileURLToPath(new URL('../apps/mobile/.env.local', import.meta.url));

// Adresses IPv4 du PC sur le réseau local (hors boucle locale et hors adresses automatiques 169.254.*).
const addresses = Object.entries(networkInterfaces()).flatMap(([name, entries]) =>
  (entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.'))
    .map((entry) => ({ name, address: entry.address })),
);

if (addresses.length === 0) {
  console.log('Aucune adresse IP locale trouvée : le PC est-il connecté au Wi-Fi ?');
  process.exit(1);
}

console.log('Adresse(s) IP locale(s) du PC :');
for (const { name, address } of addresses) console.log(`  ${address}  (${name})`);

const [first] = addresses;
console.log('\nLigne à mettre dans apps/mobile/.env.local (le téléphone doit être sur le même réseau) :');
console.log(`  EXPO_PUBLIC_API_URL=http://${first.address}:${API_PORT}`);

// Valeur actuelle, pour voir tout de suite si elle est périmée (seule cette variable est lue).
try {
  const current = readFileSync(envFile, 'utf8').match(/^EXPO_PUBLIC_API_URL=(.*)$/m)?.[1]?.trim();
  if (current) {
    const upToDate = addresses.some(({ address }) => current === `http://${address}:${API_PORT}`);
    console.log(`\nValeur actuelle : ${current}  ${upToDate ? '✓ à jour' : '✗ à remplacer'}`);
  } else {
    console.log('\nEXPO_PUBLIC_API_URL est absente de apps/mobile/.env.local.');
  }
} catch {
  console.log('\napps/mobile/.env.local n’existe pas encore : créez-le avec la ligne ci-dessus.');
}
console.log('Après modification, relancez Expo avec « npx expo start -c » dans apps/mobile.');
