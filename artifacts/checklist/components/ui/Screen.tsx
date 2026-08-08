// Safe-area + M3 surface wrapper. Screens were each repeating this pair.
import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMd } from "@/theme/useMd";

export default function Screen({
  children,
  edges = ["top"],
  style,
}: {
  children: React.ReactNode;
  /** Which safe-area edges to pad. Tab screens omit "bottom" — M3TabBar owns it. */
  edges?: ("top" | "bottom")[];
  style?: ViewStyle;
}) {
  const md = useMd();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: md.surface },
        edges.includes("top") && { paddingTop: insets.top },
        edges.includes("bottom") && { paddingBottom: insets.bottom },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
