// Material 3 onboarding stepper — ported from the design prototype's Stepper
// (m3/components-nav.jsx). Completed steps show a check, the active step shows
// its label, connectors fill with `primary` behind the cursor.
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { typeStyle } from "@/constants/typography";
import { useMd } from "@/theme/useMd";

export type Step = { id: string; label: string };

export default function M3Stepper({ steps, current }: { steps: Step[]; current: string }) {
  const md = useMd();
  const idx = steps.findIndex((s) => s.id === current);

  return (
    <View style={styles.row}>
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        const filled = done || active;

        return (
          <React.Fragment key={s.id}>
            <View style={styles.step}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: filled ? md.primary : md.surfaceContainerHighest },
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={14} color={md.onPrimary} />
                ) : (
                  <Text
                    style={[
                      typeStyle("labelMedium"),
                      { color: filled ? md.onPrimary : md.onSurfaceVariant },
                    ]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              {active && (
                <Text style={[typeStyle("labelLarge"), { color: md.primary }]} numberOfLines={1}>
                  {s.label}
                </Text>
              )}
            </View>
            {i < steps.length - 1 && (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: done ? md.primary : md.outlineVariant },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  step: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  connector: { flex: 1, height: 2, borderRadius: 1 },
});
