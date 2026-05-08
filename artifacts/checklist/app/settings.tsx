import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChecklist } from "@/context/ChecklistContext";
import { useColors } from "@/hooks/useColors";

// ─── Row ──────────────────────────────────────────────────────────────────────

function SettingsRow({
  label,
  subtitle,
  onPress,
  destructive,
  icon,
}: {
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  icon: string;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: destructive ? "#fff0f0" : colors.muted }]}>
        <Text style={styles.rowIconText}>{icon}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: destructive ? colors.destructive : colors.foreground }]}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Text style={[styles.chevron, { color: colors.border }]}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{title}</Text>
  );
}

// ─── App-wide Settings Screen ─────────────────────────────────────────────────

export default function AppSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completionHistory, clearHistory, resetChecklist } = useChecklist();
  const isWeb = Platform.OS === "web";
  const topPadding = isWeb ? 67 : insets.top;

  const handleClearHistory = () => {
    if (completionHistory.length === 0) {
      Alert.alert("No History", "There are no saved shifts to clear.");
      return;
    }
    Alert.alert(
      "Clear Shift History",
      `Delete all ${completionHistory.length} saved shift${completionHistory.length !== 1 ? "s" : ""}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            clearHistory();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const handleResetTasks = () => {
    Alert.alert(
      "Reset All Tasks",
      "Uncheck all tasks in the current checklist?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            resetChecklist();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPadding }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingVertical: 20,
          paddingBottom: (isWeb ? 34 : insets.bottom) + 40,
          gap: 4,
        }}
      >
        {/* History */}
        <SectionLabel title="SHIFT HISTORY" />
        <View style={[styles.group, { borderColor: colors.border }]}>
          <SettingsRow
            icon="🕐"
            label="View Shift History"
            subtitle={
              completionHistory.length === 0
                ? "No saved shifts yet"
                : `${completionHistory.length} saved shift${completionHistory.length !== 1 ? "s" : ""}`
            }
            onPress={() => {
              router.back();
              setTimeout(() => router.push("/history"), 50);
            }}
          />
          <SettingsRow
            icon="🗑️"
            label="Clear Shift History"
            subtitle="Permanently delete all saved shifts"
            onPress={handleClearHistory}
            destructive
          />
        </View>

        {/* Checklist */}
        <SectionLabel title="CURRENT CHECKLIST" />
        <View style={[styles.group, { borderColor: colors.border }]}>
          <SettingsRow
            icon="↺"
            label="Reset All Tasks"
            subtitle="Uncheck all tasks without saving"
            onPress={handleResetTasks}
            destructive
          />
        </View>

        {/* About */}
        <SectionLabel title="ABOUT" />
        <View style={[styles.group, { borderColor: colors.border }]}>
          <View style={[styles.row, { backgroundColor: colors.card, borderBottomColor: "transparent" }]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.muted }]}>
              <Text style={styles.rowIconText}>🍕</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>End Shift</Text>
              <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Version 1.0</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  backBtn: { width: 70 },
  backBtnText: { color: "#fff", fontSize: 17, fontWeight: "500" },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: "Inter_700Bold",
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
    fontFamily: "Inter_600SemiBold",
  },

  group: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowIconText: { fontSize: 18 },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: "500", fontFamily: "Inter_500Medium" },
  rowSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  chevron: { fontSize: 20, fontWeight: "300" },
});
