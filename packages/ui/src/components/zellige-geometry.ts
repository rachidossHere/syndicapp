// Géométrie du motif zellige (plan 02b) : une étoile à huit branches (deux carrés superposés, l'un
// tourné de 45°) au centre de la cellule, et un petit cercle à chaque coin qui se rejoint avec ceux
// des cellules voisines. Fonction pure : testée sans rendu. Le dessin est symétrique (rotations de
// 90°, miroirs) : identique en français et en arabe, sans inversion en RTL.

export type ZelligeCircle = { cx: number; cy: number; r: number };

export type ZelligeGeometry = {
  /** Côté de la cellule répétée. */
  cell: number;
  /** Carré aligné sur les axes (chemin SVG fermé). */
  square: string;
  /** Carré tourné de 45° (losange, chemin SVG fermé). */
  diamond: string;
  /** Cercles aux quatre coins de la cellule. */
  corners: ZelligeCircle[];
  /** Épaisseur du trait. */
  strokeWidth: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

/** Dessin d'une cellule de `cell` px de côté. */
export function zelligeGeometry(cell: number): ZelligeGeometry {
  const c = cell / 2;
  // Demi-côté du carré ; le losange a le même rayon circonscrit (sommets sur le cercle de r·√2).
  const r = cell * 0.3;
  const d = r * Math.SQRT2;
  const p = (x: number, y: number) => `${round(x)} ${round(y)}`;
  const square = `M${p(c - r, c - r)} L${p(c + r, c - r)} L${p(c + r, c + r)} L${p(c - r, c + r)} Z`;
  const diamond = `M${p(c, c - d)} L${p(c + d, c)} L${p(c, c + d)} L${p(c - d, c)} Z`;
  const cornerRadius = round(cell * 0.07);
  return {
    cell,
    square,
    diamond,
    corners: [
      { cx: 0, cy: 0, r: cornerRadius },
      { cx: cell, cy: 0, r: cornerRadius },
      { cx: 0, cy: cell, r: cornerRadius },
      { cx: cell, cy: cell, r: cornerRadius },
    ],
    strokeWidth: 1,
  };
}

/** Sommets d'un chemin « M x y L x y … Z » (pour les tests et les contrôles de symétrie). */
export function pathPoints(path: string): [number, number][] {
  return [...path.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(
    (match) => [Number(match[1]), Number(match[2])] as [number, number],
  );
}
