// ─────────────────────────────────────────────────────────────────────────
// react-native-paper (MD3) theme, built from the app's Material 3 role
// palette (constants/colors.ts md3Light/md3Dark) and adjusted for a
// per-tenant custom brand color (context/ChecklistContext appConfig.primaryColor),
// the same way hooks/useColors.ts already overrides the legacy palette.
//
// Paper's MD3Colors type does NOT include the surfaceContainer*/surfaceDim/
// surfaceBright/success* roles the design uses throughout — those are a
// custom extension attached alongside Paper's own colors (`extendedColors`)
// and read via useAppTheme() rather than react-native-paper's own useTheme().
// ─────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import {
  MD3DarkTheme,
  MD3LightTheme,
  configureFonts,
  useTheme,
  type MD3Theme,
} from "react-native-paper";

import { md3Dark, md3Light, md3Seed, type Md3RolePalette } from "@/constants/colors";
import shape from "@/constants/shape";
import { typeScale, typeStyle, type TypeRole } from "@/constants/typography";
import { ChecklistContext } from "@/context/ChecklistContext";
import { alphaHex, darkenHex, lightenHex } from "@/utils/color";

export type ExtendedColors = {
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceDim: string;
  surfaceBright: string;
  success: string;
  successContainer: string;
  onSuccessContainer: string;
};

export type AppTheme = MD3Theme & { extendedColors: ExtendedColors };

function extendedColorsFrom(role: Md3RolePalette): ExtendedColors {
  return {
    surfaceContainerLowest: role.surfaceContainerLowest,
    surfaceContainerLow: role.surfaceContainerLow,
    surfaceContainer: role.surfaceContainer,
    surfaceContainerHigh: role.surfaceContainerHigh,
    surfaceContainerHighest: role.surfaceContainerHighest,
    surfaceDim: role.surfaceDim,
    surfaceBright: role.surfaceBright,
    success: role.success,
    successContainer: role.successContainer,
    onSuccessContainer: role.onSuccessContainer,
  };
}

// ── Fonts ────────────────────────────────────────────────────────────────
// Without this, every react-native-paper built-in (Button label, TextInput,
// List.Item, Appbar title, Dialog title) renders in the platform system font
// while hand-styled text uses Inter — a visible split down the middle of the
// app. Paper's MD3 font config uses the same 15 role names as our type scale,
// so it maps straight across.
//
// Weight is carried by the font FAMILY (Inter_500Medium, Inter_700Bold, …),
// never by `fontWeight` — the two fight each other and resolve differently on
// iOS vs Android. Paper's MD3Type requires `fontWeight`, so the config is cast
// rather than given a weight it must not have.
const md3Fonts = configureFonts({
  config: Object.fromEntries(
    (Object.keys(typeScale) as TypeRole[]).map((role) => [role, typeStyle(role)]),
  ) as never,
});

// M3 elevation is a surface-tint ramp. Paper ships one seeded from its stock
// #6750A4 purple, which survives `...base.colors` and tints every elevated
// Card/Surface/FAB. Map the levels onto the design's own surfaceContainer ramp.
function elevationFrom(role: Md3RolePalette) {
  return {
    level0: "transparent",
    level1: role.surfaceContainerLow,
    level2: role.surfaceContainer,
    level3: role.surfaceContainerHigh,
    level4: role.surfaceContainerHigh,
    level5: role.surfaceContainerHighest,
  } as const;
}

function paperColorsFrom(role: Md3RolePalette, base: MD3Theme) {
  return {
    ...base.colors,
    // Paper's own stock-purple defaults for these survive the spread below
    // unless they are overridden explicitly.
    surfaceTint: role.surfaceTint,
    elevation: elevationFrom(role),
    surfaceDisabled: alphaHex(role.onSurface, 0.12),
    onSurfaceDisabled: alphaHex(role.onSurface, 0.38),
    backdrop: alphaHex(role.scrim, 0.4),
    primary: role.primary,
    onPrimary: role.onPrimary,
    primaryContainer: role.primaryContainer,
    onPrimaryContainer: role.onPrimaryContainer,
    secondary: role.secondary,
    onSecondary: role.onSecondary,
    secondaryContainer: role.secondaryContainer,
    onSecondaryContainer: role.onSecondaryContainer,
    tertiary: role.tertiary,
    onTertiary: role.onTertiary,
    tertiaryContainer: role.tertiaryContainer,
    onTertiaryContainer: role.onTertiaryContainer,
    error: role.error,
    onError: role.onError,
    errorContainer: role.errorContainer,
    onErrorContainer: role.onErrorContainer,
    surface: role.surface,
    onSurface: role.onSurface,
    surfaceVariant: role.surfaceVariant,
    onSurfaceVariant: role.onSurfaceVariant,
    background: role.surface,
    onBackground: role.onSurface,
    outline: role.outline,
    outlineVariant: role.outlineVariant,
    inverseSurface: role.inverseSurface,
    inverseOnSurface: role.inverseOnSurface,
    inversePrimary: role.inversePrimary,
    scrim: role.scrim,
  };
}

function buildTheme(role: Md3RolePalette, dark: boolean): AppTheme {
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    dark,
    // Paper derives radii from `roundness` with per-component multipliers
    // (Button = 5x, Card = 3x), so a single value cannot express the design's
    // shape scale. Keeping the MD3 default of 4 makes Paper's own multipliers
    // land on spec (Button 20 = pill at 40px, Card 12); anywhere the design
    // asks for something else — Card lg/16, Dialog + sheet xl/28, text field
    // xs/4 — set `borderRadius` from `@/constants/shape` at the call site.
    roundness: shape.xs,
    fonts: md3Fonts,
    colors: paperColorsFrom(role, base),
    extendedColors: extendedColorsFrom(role),
  };
}

// Re-seed the primary/secondary/tertiary-adjacent roles from a custom brand
// color (business tenants set appConfig.primaryColor). This is an
// approximation — not full HCT/tonal-palette color science — matching the
// lighten/darken approach hooks/useColors.ts already uses for the legacy
// palette. Neutral roles (surface, error, outline, success, ...) are kept
// from the static M3 scheme since they aren't seed-derived in the mockup.
function reseed(role: Md3RolePalette, seed: string, dark: boolean): Md3RolePalette {
  if (seed.toLowerCase() === md3Seed.toLowerCase()) return role;
  const onSeed = dark ? darkenHex(seed, 0.7) : "#FFFFFF";
  const container = dark ? darkenHex(seed, 0.55) : lightenHex(seed, 0.82);
  const onContainer = dark ? lightenHex(seed, 0.82) : darkenHex(seed, 0.75);
  return {
    ...role,
    primary: dark ? lightenHex(seed, 0.35) : seed,
    onPrimary: onSeed,
    primaryContainer: container,
    onPrimaryContainer: onContainer,
    inversePrimary: dark ? seed : lightenHex(seed, 0.35),
    surfaceTint: dark ? lightenHex(seed, 0.35) : seed,
  };
}

export function getAppTheme(seed: string, dark: boolean): AppTheme {
  const role = reseed(dark ? md3Dark : md3Light, seed, dark);
  return buildTheme(role, dark);
}

// Resolves the current MD3 app theme from color scheme + per-tenant brand
// color, mirroring how hooks/useColors.ts resolves the legacy palette.
// darkMode "system" (default) follows the OS scheme; Settings > Dark theme
// lets the user pin "light"/"dark" explicitly via appConfig.
export function useAppThemeConfig(): AppTheme {
  const scheme = useColorScheme();
  const ctx = useContext(ChecklistContext);
  const mode = ctx?.appConfig?.darkMode ?? "system";
  const dark = mode === "system" ? scheme === "dark" : mode === "dark";
  const seed = ctx?.appConfig?.primaryColor ?? md3Seed;
  return useMemo(() => getAppTheme(seed, dark), [seed, dark]);
}

// Typed accessor for the extended (non-Paper-standard) MD3 color roles,
// e.g. const { surfaceContainerHigh } = useExtendedColors();
export function useExtendedColors(): ExtendedColors {
  const theme = useTheme<AppTheme>();
  return theme.extendedColors;
}
