// WCAG 2.2 contrast-ratio math for the live computed-style audit (D-04/D-05).
// The audit samples rendered styles via browser_evaluate, but the luminance/
// ratio formulas must not drift from the W3C definition — the shipped token
// contract (10-UI-SPEC §Color) claims specific AA ratios, so the math lives
// here under Vitest. compositeAlpha handles the /70 label (the 70%-alpha
// foreground must be blended over the panel before the ratio, Pitfall 2).

export function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function compositeAlpha(
  fg: [number, number, number],
  bg: [number, number, number],
  alpha: number
): [number, number, number] {
  return fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as [number, number, number];
}
