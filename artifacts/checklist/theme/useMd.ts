import { useTheme } from "react-native-paper";

import { AppTheme } from "@/theme/paperTheme";

// Resolves the MD3 theme (Paper's standard roles + the app's extended
// surfaceContainer*/success* roles) as a single flat object, mirroring the
// design prototype's c('role') lookups (m3/theme.js). Use this instead of
// react-native-paper's own useTheme() when a screen needs surfaceContainer*,
// surfaceDim/Bright, or success* — those aren't in Paper's MD3Colors type.
export function useMd() {
  const theme = useTheme<AppTheme>();
  return { theme, ...theme.colors, ...theme.extendedColors };
}
