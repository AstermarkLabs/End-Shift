import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChecklist } from "@/context/ChecklistContext";
import { useColors } from "@/hooks/useColors";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  "#C8102E", "#E53935", "#E91E63", "#9C27B0",
  "#3F51B5", "#2196F3", "#009688", "#4CAF50",
  "#FF9800", "#607D8B",
];

const ICON_OPTIONS = [
  "🍕", "🍔", "🌮", "🍜", "🍗", "☕",
  "🍣", "🏪", "✅", "📋", "⭐", "🔧",
  "🏠", "🎯", "🚀", "💼",
];

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{title}</Text>
  );
}

// ─── Tappable row ────────────────────────────────────────────────────────────

function SettingsRow({
  label, subtitle, onPress, destructive, icon,
}: {
  label: string; subtitle?: string; onPress: () => void;
  destructive?: boolean; icon: string;
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

// ─── App Settings Screen ──────────────────────────────────────────────────────

export default function AppSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completionHistory, clearHistory, resetChecklist, appConfig, updateAppConfig } = useChecklist();
  const isWeb = Platform.OS === "web";
  const topPadding = isWeb ? 67 : insets.top;

  const [nameValue, setNameValue] = useState(appConfig.name);
  const [nameDirty, setNameDirty] = useState(false);

  useEffect(() => {
    setNameValue(appConfig.name);
  }, [appConfig.name]);

  const pickCustomIcon = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/svg+xml,image/jpeg,image/webp,image/png";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const uri = ev.target?.result as string;
          if (uri) {
            updateAppConfig({ customIconUri: uri });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow photo access to pick a custom icon.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        updateAppConfig({ customIconUri: uri });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleNameSave = () => {
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    updateAppConfig({ name: trimmed });
    setNameDirty(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

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
    Alert.alert("Reset All Tasks", "Uncheck all tasks in the current checklist?", [
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
    ]);
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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingVertical: 20,
          paddingBottom: (isWeb ? 34 : insets.bottom) + 40,
          gap: 4,
        }}
      >
        {/* ── Appearance ── */}
        <SectionLabel title="APPEARANCE" />
        <View style={[styles.group, { borderColor: colors.border }]}>

          {/* App name */}
          <View style={[styles.appearanceRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.appearanceLabel, { color: colors.mutedForeground }]}>App Name</Text>
            <View style={styles.nameRow}>
              <TextInput
                value={nameValue}
                onChangeText={(v) => { setNameValue(v); setNameDirty(v.trim() !== appConfig.name); }}
                returnKeyType="done"
                onSubmitEditing={handleNameSave}
                onBlur={handleNameSave}
                placeholder="App name"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.nameInput,
                  { color: colors.foreground, borderColor: nameDirty ? colors.primary : colors.border },
                ]}
              />
              {nameDirty && (
                <TouchableOpacity
                  onPress={handleNameSave}
                  style={[styles.nameSaveBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.nameSaveBtnText}>Save</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Color picker */}
          <View style={[styles.appearanceRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.appearanceLabel, { color: colors.mutedForeground }]}>Color</Text>
            <View style={styles.swatchRow}>
              {COLOR_OPTIONS.map((c) => {
                const selected = appConfig.primaryColor === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => {
                      updateAppConfig({ primaryColor: c });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      selected && styles.swatchSelected,
                    ]}
                    activeOpacity={0.8}
                  >
                    {selected && <Text style={styles.swatchCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Icon picker */}
          <View style={[styles.appearanceRow, { backgroundColor: colors.card, borderBottomColor: "transparent" }]}>
            <Text style={[styles.appearanceLabel, { color: colors.mutedForeground }]}>Icon</Text>
            <View style={styles.iconRow}>
              {/* Custom uploaded image tile */}
              {appConfig.customIconUri && (
                <View style={styles.customIconWrap}>
                  <TouchableOpacity
                    onPress={() => updateAppConfig({ customIconUri: undefined })}
                    style={[
                      styles.iconOption,
                      {
                        borderColor: colors.primary,
                        backgroundColor: colors.secondary,
                        padding: 0,
                        overflow: "hidden",
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: appConfig.customIconUri }}
                      style={styles.customIconImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateAppConfig({ customIconUri: undefined })}
                    style={[styles.customIconRemove, { backgroundColor: colors.destructive }]}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.customIconRemoveText}>×</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Upload tile */}
              <TouchableOpacity
                onPress={pickCustomIcon}
                style={[
                  styles.iconOption,
                  styles.uploadTile,
                  {
                    borderColor: colors.border,
                    borderStyle: "dashed",
                    backgroundColor: colors.muted,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.uploadTileIcon, { color: colors.mutedForeground }]}>+</Text>
                <Text style={[styles.uploadTileLabel, { color: colors.mutedForeground }]}>Upload</Text>
              </TouchableOpacity>

              {/* Emoji tiles */}
              {ICON_OPTIONS.map((ic) => {
                const selected = !appConfig.customIconUri && appConfig.icon === ic;
                return (
                  <TouchableOpacity
                    key={ic}
                    onPress={() => {
                      updateAppConfig({ icon: ic, customIconUri: undefined });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.iconOption,
                      {
                        backgroundColor: selected ? colors.secondary : colors.muted,
                        borderColor: selected ? colors.primary : "transparent",
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.iconOptionText}>{ic}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Shift History ── */}
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

        {/* ── Current Checklist ── */}
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

        {/* ── About ── */}
        <SectionLabel title="ABOUT" />
        <View style={[styles.group, { borderColor: colors.border }]}>
          <View style={[styles.row, { backgroundColor: colors.card, borderBottomColor: "transparent" }]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.secondary }]}>
              <Text style={styles.rowIconText}>{appConfig.icon}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{appConfig.name}</Text>
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

  // Appearance rows
  appearanceRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appearanceLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  nameSaveBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  nameSaveBtnText: { color: "#fff", fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  swatchCheck: { color: "#fff", fontSize: 14, fontWeight: "700" },

  iconRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  iconOptionText: { fontSize: 22 },

  customIconWrap: { position: "relative" },
  customIconImage: { width: 40, height: 40, borderRadius: 8 },
  customIconRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  customIconRemoveText: { color: "#fff", fontSize: 13, fontWeight: "700", lineHeight: 16 },

  uploadTile: { flexDirection: "column", gap: 1, borderWidth: 2 },
  uploadTileIcon: { fontSize: 18, fontWeight: "300", lineHeight: 20 },
  uploadTileLabel: { fontSize: 9, fontWeight: "600", fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },

  // Standard rows
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
