export { db, getDb, type Database } from './client';
export * as schema from './schema';
// Constructeur de requêtes SQL brutes de Drizzle, réexporté pour ne pas dépendre de drizzle-orm ailleurs.
export { sql } from 'drizzle-orm';
