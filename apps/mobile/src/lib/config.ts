/**
 * URL de notre API Hono, lue dans apps/mobile/.env.local (EXPO_PUBLIC_API_URL, voir .env.example).
 * Sur un téléphone, ce n'est pas `localhost` mais l'adresse IP locale de l'ordinateur.
 * Les variables EXPO_PUBLIC_* sont intégrées à l'appli : jamais de secret ici.
 */
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!rawApiUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_URL est absente : ajoutez-la dans apps/mobile/.env.local (ex. http://192.168.1.10:3000), puis relancez Expo.',
  );
}

/** URL de l'API, sans barre oblique finale. */
export const API_URL = rawApiUrl.replace(/\/+$/, '');
