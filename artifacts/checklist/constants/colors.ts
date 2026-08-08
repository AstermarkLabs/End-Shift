// ─────────────────────────────────────────────────────────────────────────
// Material 3 role palettes — ported from the design prototype (m3/theme.js
// M3_LIGHT / M3_DARK), seeded from the brand red #C8102E. camelCase role
// names (RN convention) rather than the mockup's kebab-case CSS var names.
//
// `surfaceContainer*` / `surfaceDim` / `surfaceBright` / `success*` are not
// part of react-native-paper's MD3Colors type — they're a custom extension
// consumed via the extended app theme in theme/paperTheme.ts, not through
// Paper's own `theme.colors` typing.
// ─────────────────────────────────────────────────────────────────────────

export const md3Seed = "#C8102E";

export type Md3RolePalette = {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  success: string;
  successContainer: string;
  onSuccessContainer: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceDim: string;
  surfaceBright: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  scrim: string;
  surfaceTint: string;
};

export const md3Light: Md3RolePalette = {
  primary: "#B61C29",
  onPrimary: "#FFFFFF",
  primaryContainer: "#FFDAD8",
  onPrimaryContainer: "#410006",
  secondary: "#775654",
  onSecondary: "#FFFFFF",
  secondaryContainer: "#FFDAD6",
  onSecondaryContainer: "#2C1513",
  tertiary: "#735A2F",
  onTertiary: "#FFFFFF",
  tertiaryContainer: "#FFDEA8",
  onTertiaryContainer: "#271900",
  error: "#BA1A1A",
  onError: "#FFFFFF",
  errorContainer: "#FFDAD6",
  onErrorContainer: "#410002",
  success: "#3B6939",
  successContainer: "#BCF0B4",
  onSuccessContainer: "#002106",
  surface: "#FFF8F7",
  onSurface: "#271815",
  surfaceVariant: "#F5DDDA",
  onSurfaceVariant: "#534340",
  outline: "#857370",
  outlineVariant: "#D8C2BE",
  surfaceContainerLowest: "#FFFFFF",
  surfaceContainerLow: "#FFF0EE",
  surfaceContainer: "#FCEAE7",
  surfaceContainerHigh: "#F7E4E1",
  surfaceContainerHighest: "#F1DEDB",
  surfaceDim: "#E8D6D3",
  surfaceBright: "#FFF8F7",
  inverseSurface: "#3B2D2B",
  inverseOnSurface: "#FFEDEA",
  inversePrimary: "#FFB3B2",
  scrim: "#000000",
  surfaceTint: "#B61C29",
};

export const md3Dark: Md3RolePalette = {
  primary: "#FFB3B2",
  onPrimary: "#680010",
  primaryContainer: "#921620",
  onPrimaryContainer: "#FFDAD8",
  secondary: "#E7BDB8",
  onSecondary: "#442927",
  secondaryContainer: "#5D3F3C",
  onSecondaryContainer: "#FFDAD6",
  tertiary: "#E3C18C",
  onTertiary: "#402D04",
  tertiaryContainer: "#594419",
  onTertiaryContainer: "#FFDEA8",
  error: "#FFB4AB",
  onError: "#690005",
  errorContainer: "#93000A",
  onErrorContainer: "#FFDAD6",
  success: "#A1D39A",
  successContainer: "#235024",
  onSuccessContainer: "#BCF0B4",
  surface: "#1A1110",
  onSurface: "#F1DEDB",
  surfaceVariant: "#534340",
  onSurfaceVariant: "#D8C2BE",
  outline: "#A08C89",
  outlineVariant: "#534340",
  surfaceContainerLowest: "#140C0B",
  surfaceContainerLow: "#231918",
  surfaceContainer: "#271D1C",
  surfaceContainerHigh: "#322826",
  surfaceContainerHighest: "#3D3231",
  surfaceDim: "#1A1110",
  surfaceBright: "#423735",
  inverseSurface: "#F1DEDB",
  inverseOnSurface: "#382E2C",
  inversePrimary: "#B61C29",
  scrim: "#000000",
  surfaceTint: "#FFB3B2",
};
