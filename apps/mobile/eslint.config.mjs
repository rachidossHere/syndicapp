// ESLint de l'appli mobile : configuration Expo + configuration partagée du monorepo.
import expoConfig from 'eslint-config-expo/flat.js';
import shared from '../../eslint.config.mjs';

export default [...expoConfig, ...shared];
