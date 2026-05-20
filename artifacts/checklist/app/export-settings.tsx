import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChecklist } from "@/context/ChecklistContext";
import type { AppConfig } from "@/context/ChecklistContext";
import { useColors } from "@/hooks/useColors";
import type { HeaderPosition } from "@/utils/exportChecklist";

// ─── Position picker ──────────────────────────────────────────────────────────

function PositionPicker({
  value,
  onChange,
}: {
  value: HeaderPosition;
  onChange: (v: HeaderPosition) => void;
}) {
  const colors = useColors();
  const options: { key: HeaderPosition; label: string }[] = [
    { key: "left", label: "Left" },
    { key: "center", label: "Center" },
    { key: "right", label: "Right" },
  ];
  return (
    <View style={styles.posRow}>
      {options.map(({ key, label }) => {
        const sel = value === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => {
              onChange(key);
              Haptics.selectionAsync();
            }}
            activeOpacity={0.75}
            style={[
              styles.posPill,
              {
                backgroundColor: sel ? colors.primary : colors.muted,
                borderColor: sel ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.posPillText,
                { color: sel ? "#fff" : colors.foreground },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Setting row wrappers ─────────────────────────────────────────────────────

function SettingBlock({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.block,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {children}
    </View>
  );
}

function SettingRow({
  label,
  hint,
  children,
  last,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.settingRow,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.settingLabel}>
        <Text style={[styles.settingLabelText, { color: colors.foreground }]}>
          {label}
        </Text>
        {hint ? (
          <Text
            style={[styles.settingHint, { color: colors.mutedForeground }]}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
      {title}
    </Text>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ExportSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { appConfig, updateAppConfig } = useChecklist();
  const isWeb = Platform.OS === "web";
  const topPadding = isWeb ? 67 : insets.top;

  function update(patch: Partial<AppConfig>) {
    updateAppConfig(patch);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.primary, paddingTop: topPadding },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export Settings</Text>
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
        {/* ── Logo ── */}
        <SectionLabel title="LOGO" />
        <SettingBlock>
          <SettingRow label="Include Logo" hint="Uses your app icon image if set">
            <Switch
              value={appConfig.exportLogoEnabled}
              onValueChange={(v) => update({ exportLogoEnabled: v })}
              trackColor={{ false: colors.muted, true: colors.primary + "80" }}
              thumbColor={
                appConfig.exportLogoEnabled
                  ? colors.primary
                  : colors.mutedForeground
              }
            />
          </SettingRow>
          {appConfig.exportLogoEnabled && (
            <SettingRow label="Logo Position" last>
              <PositionPicker
                value={appConfig.exportLogoPosition}
                onChange={(v) => update({ exportLogoPosition: v })}
              />
            </SettingRow>
          )}
        </SettingBlock>

        {/* ── Title ── */}
        <SectionLabel title="TITLE" />
        <SettingBlock>
          <SettingRow
            label="Title Position"
            hint="Checklist name used as document title"
            last
          >
            <PositionPicker
              value={appConfig.exportTitlePosition}
              onChange={(v) => update({ exportTitlePosition: v })}
            />
          </SettingRow>
        </SettingBlock>

        {/* ── Date ── */}
        <SectionLabel title="DATE" />
        <SettingBlock>
          <SettingRow label="Show Date">
            <Switch
              value={appConfig.exportDateEnabled}
              onValueChange={(v) => update({ exportDateEnabled: v })}
              trackColor={{ false: colors.muted, true: colors.primary + "80" }}
              thumbColor={
                appConfig.exportDateEnabled
                  ? colors.primary
                  : colors.mutedForeground
              }
            />
          </SettingRow>
          {appConfig.exportDateEnabled && (
            <SettingRow label="Date Position" last>
              <PositionPicker
                value={appConfig.exportDatePosition}
                onChange={(v) => update({ exportDatePosition: v })}
              />
            </SettingRow>
          )}
        </SettingBlock>

        {/* ── Preview hint ── */}
        <SectionLabel title="PREVIEW" />
        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.previewHeader}>
            <PreviewCell position="left" appConfig={appConfig} />
            <PreviewCell position="center" appConfig={appConfig} />
            <PreviewCell position="right" appConfig={appConfig} />
          </View>
          <View
            style={[styles.previewDivider, { backgroundColor: colors.primary }]}
          />
          <View style={styles.previewTask}>
            <View
              style={[
                styles.previewCheckbox,
                { borderColor: colors.primary },
              ]}
            />
            <View
              style={[
                styles.previewLine,
                { backgroundColor: colors.muted, width: "60%" },
              ]}
            />
          </View>
          <View style={styles.previewTask}>
            <View
              style={[
                styles.previewCheckbox,
                {
                  borderColor: colors.primary,
                  backgroundColor: colors.primary,
                },
              ]}
            />
            <View
              style={[
                styles.previewLine,
                {
                  backgroundColor: colors.muted,
                  width: "45%",
                  opacity: 0.4,
                },
              ]}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function PreviewCell({
  position,
  appConfig,
}: {
  position: HeaderPosition;
  appConfig: AppConfig;
}) {
  const colors = useColors();
  const hasLogo =
    appConfig.exportLogoEnabled &&
    appConfig.exportLogoPosition === position &&
    !!appConfig.customIconUri;
  const hasTitle = appConfig.exportTitlePosition === position;
  const hasDate =
    appConfig.exportDateEnabled && appConfig.exportDatePosition === position;

  const textAlign =
    position === "left"
      ? "left"
      : position === "right"
        ? "right"
        : "center";

  if (!hasLogo && !hasTitle && !hasDate) {
    return <View style={styles.previewCell} />;
  }

  return (
    <View style={[styles.previewCell, { alignItems: position === "left" ? "flex-start" : position === "right" ? "flex-end" : "center" }]}>
      {hasLogo && (
        <View
          style={[
            styles.previewLogoPlaceholder,
            { backgroundColor: colors.primary + "30" },
          ]}
        >
          <Text style={{ fontSize: 8, color: colors.primary }}>IMG</Text>
        </View>
      )}
      {hasTitle && (
        <View
          style={[
            styles.previewTitleLine,
            { backgroundColor: colors.foreground, alignSelf: textAlign === "left" ? "flex-start" : textAlign === "right" ? "flex-end" : "center" },
          ]}
        />
      )}
      {hasDate && (
        <View
          style={[
            styles.previewDateLine,
            { backgroundColor: colors.mutedForeground, alignSelf: textAlign === "left" ? "flex-start" : textAlign === "right" ? "flex-end" : "center" },
          ]}
        />
      )}
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

  block: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    minHeight: 56,
  },
  settingLabel: { flex: 1, gap: 2 },
  settingLabelText: { fontSize: 15, fontWeight: "500", fontFamily: "Inter_500Medium" },
  settingHint: { fontSize: 12, fontFamily: "Inter_400Regular" },

  posRow: { flexDirection: "row", gap: 6 },
  posPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
  },
  posPillText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // Preview
  previewCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    marginBottom: 8,
  },
  previewCell: { flex: 1, gap: 4 },
  previewLogoPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  previewTitleLine: {
    height: 6,
    width: 40,
    borderRadius: 3,
  },
  previewDateLine: {
    height: 4,
    width: 28,
    borderRadius: 2,
    opacity: 0.5,
  },
  previewDivider: { height: 2, borderRadius: 1, marginBottom: 10 },
  previewTask: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 7,
  },
  previewCheckbox: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  previewLine: { height: 5, borderRadius: 3 },
});
