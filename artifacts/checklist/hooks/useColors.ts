import { useContext } from "react";
import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { ChecklistContext } from "@/context/ChecklistContext";

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) }
    : { r: 200, g: 16, b: 46 };
}

export function lightenHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

export function darkenHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const dr = Math.round(r * (1 - amount));
  const dg = Math.round(g * (1 - amount));
  const db = Math.round(b * (1 - amount));
  return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
}

export function useColors() {
  const scheme = useColorScheme();
  const palette =
    scheme === "dark" && "dark" in colors
      ? (colors as Record<string, typeof colors.light>).dark
      : colors.light;

  const ctx = useContext(ChecklistContext);
  const primaryColor = ctx?.appConfig?.primaryColor ?? palette.primary;

  return {
    ...palette,
    radius: colors.radius,
    primary: primaryColor,
    tint: primaryColor,
    secondary: lightenHex(primaryColor, 0.92),
    accent: lightenHex(primaryColor, 0.92),
    secondaryForeground: primaryColor,
    accentForeground: primaryColor,
  };
}
