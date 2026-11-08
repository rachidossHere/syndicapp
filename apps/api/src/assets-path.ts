import { resolve } from 'node:path';

// Ce fichier est à la racine de src/ ; une fois construit, son code est dans dist/index.js.
// src/ et dist/ étant tous deux directement sous apps/api, le chemin relatif est le même.
/** Polices embarquées dans les PDF (Plus Jakarta Sans, licence OFL : assets/fonts/OFL.txt). */
export const FONTS_DIR = resolve(import.meta.dirname, '../assets/fonts');
