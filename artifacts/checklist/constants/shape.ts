// Material 3 (Expressive) shape scale — corner radii used across the app.
// Mirrors the M3_SHAPE tokens in the design prototype (m3/theme.js).
const shape = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  xxl: 36,
  full: 9999,
} as const;

export type ShapeToken = keyof typeof shape;

export default shape;
