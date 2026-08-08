// Material 3 type scale — ported from the design prototype (m3/theme.js
// M3_TYPE), with lineHeight/letterSpacing as numbers (React Native wants
// numbers, not the '20px' CSS strings the web mockup used).
//
// The mockup loads Roboto; this app already loads Inter via @expo-google-fonts/inter
// in app/_layout.tsx, so role weights map to the closest loaded Inter cut.

export type TypeRole =
  | "displayLarge"
  | "displayMedium"
  | "displaySmall"
  | "headlineLarge"
  | "headlineMedium"
  | "headlineSmall"
  | "titleLarge"
  | "titleMedium"
  | "titleSmall"
  | "bodyLarge"
  | "bodyMedium"
  | "bodySmall"
  | "labelLarge"
  | "labelMedium"
  | "labelSmall";

type TypeScaleEntry = {
  fontSize: number;
  lineHeight: number;
  fontWeight: "400" | "500" | "600" | "700";
  letterSpacing: number;
};

export const typeScale: Record<TypeRole, TypeScaleEntry> = {
  displayLarge: { fontSize: 57, lineHeight: 64, fontWeight: "400", letterSpacing: -0.25 },
  displayMedium: { fontSize: 45, lineHeight: 52, fontWeight: "400", letterSpacing: 0 },
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: "400", letterSpacing: 0 },
  headlineLarge: { fontSize: 32, lineHeight: 40, fontWeight: "400", letterSpacing: 0 },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: "400", letterSpacing: 0 },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: "400", letterSpacing: 0 },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: "400", letterSpacing: 0 },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: "500", letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: "500", letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: "400", letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: "400", letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: "500", letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: "500", letterSpacing: 0.5 },
};

const FONT_FAMILY_BY_WEIGHT: Record<TypeScaleEntry["fontWeight"], string> = {
  "400": "Inter_400Regular",
  "500": "Inter_500Medium",
  "600": "Inter_600SemiBold",
  "700": "Inter_700Bold",
};

// Spread a type role into a React Native text style object.
export function typeStyle(role: TypeRole) {
  const t = typeScale[role];
  return {
    fontFamily: FONT_FAMILY_BY_WEIGHT[t.fontWeight],
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
  };
}
