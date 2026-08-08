// Hex color helpers shared by the M3 theme layer.
//
// These used to live in hooks/useColors.ts. They were extracted so that
// theme/paperTheme.ts does not depend on the legacy palette hook, which is
// being deleted at the end of the Material 3 migration.

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) }
    : { r: 200, g: 16, b: 46 };
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");
}

export function lightenHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `#${toHex(r + (255 - r) * amount)}${toHex(g + (255 - g) * amount)}${toHex(b + (255 - b) * amount)}`;
}

export function darkenHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `#${toHex(r * (1 - amount))}${toHex(g * (1 - amount))}${toHex(b * (1 - amount))}`;
}

// rgba() string from a hex color — the React Native equivalent of the design
// prototype's `color-mix(in srgb, <color> n%, transparent)` state layers.
export function alphaHex(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
