/**
 * Initiales d'un nom pour un avatar : première lettre du premier et du dernier mot,
 * en majuscules, 2 lettres au maximum.
 * « Rachid Tazi » → « RT », « Yassine » → « Y », « Y. Alaoui » → « YA », « » → « ».
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  const first = words[0];
  if (first === undefined) return '';

  const last = words.length > 1 ? words[words.length - 1] : undefined;
  // Array.from découpe par caractère, sans couper une lettre codée sur deux unités.
  const letters = [Array.from(first)[0], last === undefined ? undefined : Array.from(last)[0]];
  return letters.filter((letter) => letter !== undefined).join('').toUpperCase();
}
