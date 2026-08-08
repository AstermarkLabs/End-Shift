import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Divider, List, Switch, TextInput as PaperTextInput } from "react-native-paper";

import { Ionicons } from "@expo/vector-icons";

import { ProfileAccountType } from "@workspace/api-client-react";

import { useAuth } from "@/context/AuthContext";
import { useChecklist } from "@/context/ChecklistContext";
import shape from "@/constants/shape";
import { typeStyle } from "@/constants/typography";
import { useMd } from "@/theme/useMd";
import { STORAGE_MODE_KEY } from "@/utils/localChecklistStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  "#C8102E", "#E53935", "#E91E63", "#9C27B0",
  "#3F51B5", "#2196F3", "#009688", "#4CAF50",
  "#FF9800", "#607D8B",
];

// Human names for the swatch grid — surfaced in the "Theme color" row
// subtitle so the row reads like a real setting value, not a hex code.
const COLOR_NAMES: Record<string, string> = {
  "#C8102E": "Flag Red",
  "#E53935": "Cardinal",
  "#E91E63": "Cerise",
  "#9C27B0": "Violet",
  "#3F51B5": "Indigo",
  "#2196F3": "Sky Blue",
  "#009688": "Teal",
  "#4CAF50": "Leaf Green",
  "#FF9800": "Amber",
  "#607D8B": "Slate",
};
const DEFAULT_SEED_COLOR = "#C8102E";

const ICON_OPTIONS = [
  "🍕", "🍔", "🌮", "🍜", "🍗", "☕",
  "🍣", "🏪", "✅", "📋", "⭐", "🔧",
  "🏠", "🎯", "🚀", "💼",
];

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  const md = useMd();
  return (
    <Text style={[typeStyle("titleSmall"), styles.sectionLabel, { color: md.primary }]}>{title}</Text>
  );
}

// ─── Tappable row ────────────────────────────────────────────────────────────
// tint picks the left icon badge's background — mirrors the mock's varied
// badge colors per row (brand-red for appearance, info-blue for identity
// rows, neutral gray for everything else, error-red for destructive rows).

type RowTint = "primary" | "info" | "neutral" | "destructive";

// "info" has no dedicated M3 role in this app's red-seeded palette — hardcoded
// rather than borrowing tertiary (which itself derives from the brand seed
// and would just render pink/orange, not the blue the mock actually shows).
const INFO_CONTAINER = "#DCE8FA";

function tintBackground(tint: RowTint, md: ReturnType<typeof useMd>) {
  switch (tint) {
    case "primary": return md.primaryContainer;
    case "info": return INFO_CONTAINER;
    case "destructive": return md.errorContainer;
    default: return md.surfaceContainerHighest;
  }
}

function SettingsRow({
  label, subtitle, onPress, tint = "neutral", icon, left, right, hideChevron,
}: {
  label: string;
  subtitle?: string;
  onPress?: () => void;
  tint?: RowTint;
  icon?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  hideChevron?: boolean;
}) {
  const md = useMd();
  const textColor = tint === "destructive" ? md.error : md.onSurface;
  return (
    <List.Item
      title={label}
      description={subtitle}
      onPress={onPress}
      titleStyle={[typeStyle("bodyLarge"), { color: textColor }]}
      descriptionStyle={[typeStyle("bodyMedium"), { color: md.onSurfaceVariant }]}
      style={styles.listItem}
      left={() =>
        left ?? (
          <View style={[styles.rowIcon, { borderRadius: shape.sm, backgroundColor: tintBackground(tint, md) }]}>
            <Text style={styles.rowIconText}>{icon}</Text>
          </View>
        )
      }
      right={() => right ?? (hideChevron ? null : <Ionicons name="chevron-forward" size={18} color={md.onSurfaceVariant} />)}
    />
  );
}

// ─── App Settings Screen ──────────────────────────────────────────────────────

export default function AppSettingsScreen() {
  const md = useMd();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scheme = useColorScheme();
  const { completionHistory, clearHistory, resetChecklist, appConfig, updateAppConfig } = useChecklist();
  const { profile } = useAuth();
  const isBusiness = profile?.accountType === ProfileAccountType.BUSINESS;
  const isWeb = Platform.OS === "web";
  const [isNoAuthMode, setIsNoAuthMode] = useState(false);
  const [activeSheet, setActiveSheet] = useState<"branding" | "color" | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_MODE_KEY)
      .then((mode) => setIsNoAuthMode(mode === "local-no-auth"))
      .catch(() => setIsNoAuthMode(false));
  }, [profile]);

  const topPadding = isWeb ? 67 : insets.top;

  // Same resolution rule as theme/paperTheme.ts useAppThemeConfig — "system"
  // (default) follows the OS scheme; the switch below pins light/dark once
  // the user flips it. Keep these in sync if the rule ever changes.
  const resolvedDark = appConfig.darkMode === "system" ? scheme === "dark" : appConfig.darkMode === "dark";

  const canAdmin =
    isBusiness &&
    !!profile &&
    (profile.role.isSystem ||
      profile.role.rights.includes("manage_profiles") ||
      profile.role.rights.includes("manage_roles") ||
      profile.role.rights.includes("manage_org_units"));

  const [nameValue, setNameValue] = useState(appConfig.name);
  const [nameDirty, setNameDirty] = useState(false);
  const APP_NAME_MAX_LENGTH = 24;

  useEffect(() => {
    setNameValue(appConfig.name);
  }, [appConfig.name]);

  const pickCustomIcon = async () => {
    const MIME_TYPES = ["image/svg+xml", "image/jpeg", "image/webp", "image/png"];

    const result = await DocumentPicker.getDocumentAsync({
      type: MIME_TYPES,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUri = ev.target?.result as string;
        if (dataUri) {
          updateAppConfig({ customIconUri: dataUri });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      // Fallback: use URI directly (works for raster images on native)
      updateAppConfig({ customIconUri: asset.uri });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleNameSave = () => {
    const trimmed = nameValue.trim().slice(0, APP_NAME_MAX_LENGTH);
    if (!trimmed) return;
    setNameValue(trimmed);
    updateAppConfig({ name: trimmed });
    setNameDirty(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClearHistory = () => {
    if (completionHistory.length === 0) {
      Alert.alert(
        "No History",
        isBusiness ? "There are no saved shifts to clear." : "There is nothing saved to clear."
      );
      return;
    }
    Alert.alert(
      isBusiness ? "Clear Shift History" : "Clear History",
      isBusiness
        ? `Delete all ${completionHistory.length} saved shift${completionHistory.length !== 1 ? "s" : ""}? This cannot be undone.`
        : `Delete all ${completionHistory.length} saved ${completionHistory.length !== 1 ? "entries" : "entry"}? This cannot be undone.`,
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
          // Settings is a tab now — send the user to the checklist they just
          // reset rather than popping a stack that isn't there.
          router.navigate("/");
        },
      },
    ]);
  };

  const colorName = COLOR_NAMES[appConfig.primaryColor] ?? "Custom";
  const colorSubtitle =
    appConfig.primaryColor === DEFAULT_SEED_COLOR ? `${colorName} — brand seed` : colorName;

  return (
    <View style={[styles.container, { backgroundColor: md.surface }]}>
      {/* Top app bar */}
      <View style={[styles.header, { backgroundColor: md.surface, paddingTop: topPadding }]}>
        <View style={styles.headerTop}>
          {/* No back affordance — this is a tab, there is nothing to go back to. */}
          <View style={styles.headerLeft}>
            <Text style={[typeStyle("headlineMedium"), styles.headerTitle, { color: md.onSurface }]} numberOfLines={1}>
              Settings
            </Text>
          </View>
        </View>
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
        <Card
          mode="outlined"
          style={[styles.group, { backgroundColor: md.surfaceContainerLowest, borderColor: md.outlineVariant, borderRadius: shape.md }]}
        >
          <View style={styles.appearanceRow}>
            <Text style={[typeStyle("labelMedium"), styles.appearanceLabel, { color: md.onSurfaceVariant }]}>App Name</Text>
            <View style={styles.nameRow}>
              <PaperTextInput
                mode="outlined"
                dense
                value={nameValue}
                onChangeText={(v) => { setNameValue(v); setNameDirty(v.trim() !== appConfig.name); }}
                returnKeyType="done"
                onSubmitEditing={handleNameSave}
                onBlur={handleNameSave}
                editable={!isBusiness}
                maxLength={APP_NAME_MAX_LENGTH}
                placeholder="App name"
                style={[styles.nameInput, { opacity: isBusiness ? 0.6 : 1 }]}
              />
              {nameDirty && !isBusiness && (
                <Button mode="contained-tonal" onPress={handleNameSave} style={{ borderRadius: shape.sm }}>
                  Save
                </Button>
              )}
            </View>
            {isBusiness ? (
              <Text style={[typeStyle("bodyMedium"), { color: md.onSurfaceVariant }]}>Set from your profile.</Text>
            ) : null}
          </View>
          <Divider style={{ backgroundColor: md.outlineVariant }} />
          <SettingsRow
            icon="☀️"
            label="Dark theme"
            subtitle={resolvedDark ? "On" : "Off"}
            tint="primary"
            right={
              <Switch
                value={resolvedDark}
                onValueChange={(v) => {
                  updateAppConfig({ darkMode: v ? "dark" : "light" });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                color={md.primary}
              />
            }
          />
          <Divider style={{ backgroundColor: md.outlineVariant }} />
          <SettingsRow
            icon={appConfig.customIconUri ? undefined : appConfig.icon}
            left={
              appConfig.customIconUri ? (
                <View style={[styles.rowIcon, { borderRadius: shape.sm, backgroundColor: md.primaryContainer, overflow: "hidden" }]}>
                  <Image source={{ uri: appConfig.customIconUri }} style={styles.rowIconImage} resizeMode="cover" />
                </View>
              ) : undefined
            }
            label="App icon"
            subtitle="Pick an icon for your team"
            tint="primary"
            onPress={() => setActiveSheet("branding")}
          />
          <Divider style={{ backgroundColor: md.outlineVariant }} />
          <SettingsRow
            left={<View style={[styles.colorSwatchDot, { backgroundColor: appConfig.primaryColor }]} />}
            label="Theme color"
            subtitle={colorSubtitle}
            onPress={() => setActiveSheet("color")}
          />
        </Card>

        {/* ── Account ── */}
        {(isNoAuthMode && !profile) || !!profile ? (
          <>
            <SectionLabel title="ACCOUNT" />
            <Card
              mode="outlined"
              style={[styles.group, { backgroundColor: md.surfaceContainerLowest, borderColor: md.outlineVariant, borderRadius: shape.md }]}
            >
              {isNoAuthMode && !profile && (
                <SettingsRow
                  icon="🔐"
                  label="Create Account"
                  subtitle="Add a password to protect your checklists"
                  tint="info"
                  onPress={() => {
                    router.push("/create-account");
                  }}
                />
              )}
              {!!profile && (
                <SettingsRow
                  icon="👤"
                  label="Profile"
                  subtitle={profile.username}
                  tint="info"
                  onPress={() => {
                    router.push("/profile");
                  }}
                />
              )}
              {canAdmin && (
                <>
                  <Divider style={{ backgroundColor: md.outlineVariant }} />
                  <SettingsRow
                    icon="🛠️"
                    label="Admin"
                    subtitle="Users, roles & org units"
                    onPress={() => {
                      router.push("/admin");
                    }}
                  />
                </>
              )}
            </Card>
          </>
        ) : null}

        {/* ── Export / Import ── */}
        <SectionLabel title="EXPORT & IMPORT" />
        <Card
          mode="outlined"
          style={[styles.group, { backgroundColor: md.surfaceContainerLowest, borderColor: md.outlineVariant, borderRadius: shape.md }]}
        >
          <SettingsRow
            icon="📤"
            label="Export Settings"
            subtitle="Logo, title, date positioning"
            onPress={() => {
              router.push("/export-settings");
            }}
          />
          <Divider style={{ backgroundColor: md.outlineVariant }} />
          <SettingsRow
            icon="📥"
            label="Import Checklist"
            subtitle="Load a checklist from a file"
            onPress={() => {
              router.push("/import-checklist");
            }}
          />
        </Card>

        {/* ── History ── */}
        <SectionLabel title={isBusiness ? "SHIFT HISTORY" : "HISTORY"} />
        <Card
          mode="outlined"
          style={[styles.group, { backgroundColor: md.surfaceContainerLowest, borderColor: md.outlineVariant, borderRadius: shape.md }]}
        >
          <SettingsRow
            icon="🕐"
            label={isBusiness ? "View Shift History" : "View History"}
            subtitle={
              completionHistory.length === 0
                ? isBusiness ? "No saved shifts yet" : "No saved entries yet"
                : isBusiness
                  ? `${completionHistory.length} saved shift${completionHistory.length !== 1 ? "s" : ""}`
                  : `${completionHistory.length} saved ${completionHistory.length !== 1 ? "entries" : "entry"}`
            }
            onPress={() => {
              router.navigate("/history");
            }}
          />
          <Divider style={{ backgroundColor: md.outlineVariant }} />
          <SettingsRow
            icon="🗑️"
            label={isBusiness ? "Clear Shift History" : "Clear History"}
            tint="destructive"
            onPress={handleClearHistory}
            hideChevron
          />
        </Card>

        {/* ── Current Checklist ── */}
        <SectionLabel title="CURRENT CHECKLIST" />
        <Card
          mode="outlined"
          style={[styles.group, { backgroundColor: md.surfaceContainerLowest, borderColor: md.outlineVariant, borderRadius: shape.md }]}
        >
          <SettingsRow
            icon="↺"
            label="Reset shift"
            subtitle="Uncheck every task"
            onPress={handleResetTasks}
          />
        </Card>

        {/* ── About ── */}
        <SectionLabel title="ABOUT" />
        <Card
          mode="outlined"
          style={[styles.group, { backgroundColor: md.surfaceContainerLowest, borderColor: md.outlineVariant, borderRadius: shape.md }]}
        >
          <List.Item
            title={appConfig.name}
            description="Version 1.0"
            titleStyle={[typeStyle("bodyLarge"), { color: md.onSurface }]}
            descriptionStyle={[typeStyle("bodyMedium"), { color: md.onSurfaceVariant }]}
            style={styles.listItem}
            left={() => (
              <View style={[styles.rowIcon, { borderRadius: shape.sm, backgroundColor: md.secondaryContainer }]}>
                <Text style={styles.rowIconText}>{appConfig.icon}</Text>
              </View>
            )}
          />
        </Card>
      </ScrollView>

      {/* ── App icon / name sheet ── */}
      <Modal visible={activeSheet === "branding"} animationType="slide" transparent onRequestClose={() => setActiveSheet(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: md.scrim + "66" }]} onPress={() => setActiveSheet(null)} />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: md.surfaceContainerHigh,
                paddingBottom: insets.bottom + 20,
                borderTopLeftRadius: shape.xl,
                borderTopRightRadius: shape.xl,
              },
            ]}
          >
            <View style={[styles.modalHandle, { backgroundColor: md.onSurfaceVariant, opacity: 0.4 }]} />
            <Text style={[typeStyle("titleLarge"), { color: md.onSurface }]}>App Icon</Text>

            <Text style={[typeStyle("labelMedium"), styles.appearanceLabel, { color: md.onSurfaceVariant }]}>Icon</Text>
            <View style={styles.iconRow}>
              {appConfig.customIconUri && (
                <View style={styles.customIconWrap}>
                  <TouchableOpacity
                    onPress={() => updateAppConfig({ customIconUri: undefined })}
                    style={[
                      styles.iconOption,
                      {
                        borderRadius: shape.sm,
                        borderColor: md.primary,
                        backgroundColor: md.secondaryContainer,
                        padding: 0,
                        overflow: "hidden",
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: appConfig.customIconUri }}
                      style={[styles.customIconImage, { borderRadius: shape.xs }]}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateAppConfig({ customIconUri: undefined })}
                    style={[styles.customIconRemove, { backgroundColor: md.error }]}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={[typeStyle("labelLarge"), styles.customIconRemoveText, { color: md.onError }]}>×</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                onPress={pickCustomIcon}
                style={[
                  styles.iconOption,
                  styles.uploadTile,
                  {
                    borderRadius: shape.sm,
                    borderColor: md.outlineVariant,
                    borderStyle: "dashed",
                    backgroundColor: md.surfaceContainerHighest,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.uploadTileIcon, { color: md.onSurfaceVariant }]}>+</Text>
                <Text style={[typeStyle("labelSmall"), styles.uploadTileLabel, { color: md.onSurfaceVariant }]}>Upload</Text>
              </TouchableOpacity>

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
                        borderRadius: shape.sm,
                        backgroundColor: selected ? md.secondaryContainer : md.surfaceContainerHighest,
                        borderColor: selected ? md.primary : "transparent",
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.iconOptionText}>{ic}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Button mode="contained" onPress={() => setActiveSheet(null)} style={{ flex: 1, borderRadius: shape.md }}>
                Done
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Theme color sheet ── */}
      <Modal visible={activeSheet === "color"} animationType="slide" transparent onRequestClose={() => setActiveSheet(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: md.scrim + "66" }]} onPress={() => setActiveSheet(null)} />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: md.surfaceContainerHigh,
                paddingBottom: insets.bottom + 20,
                borderTopLeftRadius: shape.xl,
                borderTopRightRadius: shape.xl,
              },
            ]}
          >
            <View style={[styles.modalHandle, { backgroundColor: md.onSurfaceVariant, opacity: 0.4 }]} />
            <Text style={[typeStyle("titleLarge"), { color: md.onSurface }]}>Theme Color</Text>
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
                      selected && [styles.swatchSelected, { borderColor: md.surfaceContainerHigh }],
                    ]}
                    activeOpacity={0.8}
                  >
                    {selected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <Button mode="contained" onPress={() => setActiveSheet(null)} style={{ flex: 1, borderRadius: shape.md }}>
                Done
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 8,
    paddingBottom: 4,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
    marginRight: 8,
  },
  headerIconBtn: { margin: 0 },
  headerTitle: { flexShrink: 1 },

  sectionLabel: {
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },

  group: {
    marginHorizontal: 16,
    overflow: "hidden",
  },

  appearanceRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  appearanceLabel: { textTransform: "uppercase", letterSpacing: 0.5 },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameInput: {
    flex: 1,
  },

  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchSelected: {
    borderWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  colorSwatchDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignSelf: "center",
  },

  iconRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  iconOption: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  iconOptionText: { fontSize: 22 },

  customIconWrap: { position: "relative" },
  customIconImage: { width: 40, height: 40 },
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
  customIconRemoveText: { lineHeight: 16 },

  uploadTile: { flexDirection: "column", gap: 1, borderWidth: 2 },
  uploadTileIcon: { fontSize: 18, lineHeight: 20 },
  uploadTileLabel: { letterSpacing: 0.3 },

  // Standard rows (List.Item based)
  listItem: { paddingHorizontal: 6, paddingVertical: 2 },
  rowIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    alignSelf: "center",
  },
  rowIconText: { fontSize: 18 },
  rowIconImage: { width: 36, height: 36 },

  // Bottom sheet modal (App Branding / Theme Color)
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalSheet: {
    padding: 20,
    gap: 12,
    maxHeight: "85%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
});
