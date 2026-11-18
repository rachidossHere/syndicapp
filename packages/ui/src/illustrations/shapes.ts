// Formes SVG des illustrations (plan 02b, étape 2) : fonctions pures, sans React, testées avec
// vitest. Les chemins sont calculés une fois, au chargement du module, jamais au rendu.

const round = (value: number): number => Math.round(value * 10) / 10;

/** Fenêtre ou arcade : bas droit, haut en demi-cercle. `w` × `h` à partir du coin haut gauche. */
export function archPath(x: number, y: number, w: number, h: number): string {
  const r = w / 2;
  return `M${x} ${y + h}V${y + r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h}Z`;
}

/** Feuille de palmier : part de (cx, cy), pointe à `length` dans la direction `angleDeg` (0 = droite). */
export function frondPath(cx: number, cy: number, angleDeg: number, length: number, half: number): string {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tip = [cx + length * cos, cy + length * sin];
  const mid = [cx + length * 0.55 * cos, cy + length * 0.55 * sin];
  // Points de contrôle de part et d'autre de l'axe : la feuille est en forme de goutte allongée.
  const a = [mid[0]! - half * sin, mid[1]! + half * cos];
  const b = [mid[0]! + half * sin, mid[1]! - half * cos];
  const p = (point: number[]) => `${round(point[0]!)} ${round(point[1]!)}`;
  return `M${round(cx)} ${round(cy)}Q${p(a)} ${p(tip)}Q${p(b)} ${round(cx)} ${round(cy)}Z`;
}

/** Étoile à quatre branches (éclat). */
export function sparklePath(cx: number, cy: number, r: number): string {
  const k = r * 0.28;
  return (
    `M${cx} ${cy - r}L${round(cx + k)} ${round(cy - k)}L${cx + r} ${cy}L${round(cx + k)} ${round(cy + k)}` +
    `L${cx} ${cy + r}L${round(cx - k)} ${round(cy + k)}L${cx - r} ${cy}L${round(cx - k)} ${round(cy - k)}Z`
  );
}

/** Éventail de feuilles de palmier partant d'un même point. */
export function palmCrown(cx: number, cy: number, angles: readonly number[], length: number, half: number): string[] {
  return angles.map((angle) => frondPath(cx, cy, angle, length, half));
}
