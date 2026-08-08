import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Switch } from "react-native-paper";

import { useChecklist } from "@/context/ChecklistContext";
import type { AppConfig } from "@/context/ChecklistContext";
import shape from "@/constants/shape";
import { typeStyle } from "@/constants/typography";
import { useMd } from "@/theme/useMd";
import type { HeaderPosition } from "@/utils/exportChecklist";

// ─── Position picker ──────────────────────────────────────────────────────────

function PositionPicker({
  value,
  onChange,
}: {
  value: HeaderPosition;
  onChange: (v: HeaderPosition) => void;
}) {
  const md = useMd();
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
                borderRadius: shape.sm,
                backgroundColor: sel ? md.secondaryContainer : "transparent",
                borderColor: sel ? "transparent" : md.outlineVariant,
              },
            ]}
          >
            <Text style={[styles.posPillText, { color: sel ? md.onSecondaryContainer : md.onSurfaceVariant }]}>
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
  const md = useMd();
  return (
    <View
      style={[
        styles.block,
        { borderRadius: shape.md, borderColor: md.outlineVariant, backgroundColor: md.surface },
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
  const md = useMd();
  return (
    <View
      style={[
        styles.settingRow,
        {
          borderBottomColor: md.outlineVariant,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.settingLabel}>
        <Text style={[styles.settingLabelText, { color: md.onSurface }]}>{label}</Text>
        {hint ? <Text style={[styles.settingHint, { color: md.onSurfaceVariant }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  const md = useMd();
  return <Text style={[styles.sectionLabel, { color: md.primary }]}>{title}</Text>;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ExportSettingsScreen() {
  const md = useMd();
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
    <View style={[styles.container, { backgroundColor: md.surface }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: md.surfaceContainerLow, paddingTop: topPadding }]}>
        <IconButton icon="chevron-left" iconColor={md.onSurface} onPress={() => router.back()} style={styles.backBtn} />
        <Text style={[styles.headerTitle, { color: md.onSurface }]}>Export Settings</Text>
        <View style={{ width: 48 }} />
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
            <Switch value={appConfig.exportLogoEnabled} onValueChange={(v) => update({ exportLogoEnabled: v })} />
          </SettingRow>
          {appConfig.exportLogoEnabled && (
            <SettingRow label="Logo Position" last>
              <PositionPicker value={appConfig.exportLogoPosition} onChange={(v) => update({ exportLogoPosition: v })} />
            </SettingRow>
          )}
        </SettingBlock>

        {/* ── Title ── */}
        <SectionLabel title="TITLE" />
        <SettingBlock>
          <SettingRow label="Title Position" hint="Checklist name used as document title" last>
            <PositionPicker value={appConfig.exportTitlePosition} onChange={(v) => update({ exportTitlePosition: v })} />
          </SettingRow>
        </SettingBlock>

        {/* ── Date ── */}
        <SectionLabel title="DATE" />
        <SettingBlock>
          <SettingRow label="Show Date">
            <Switch value={appConfig.exportDateEnabled} onValueChange={(v) => update({ exportDateEnabled: v })} />
          </SettingRow>
          {appConfig.exportDateEnabled && (
            <SettingRow label="Date Position" last>
              <PositionPicker value={appConfig.exportDatePosition} onChange={(v) => update({ exportDatePosition: v })} />
            </SettingRow>
          )}
        </SettingBlock>

        {/* ── Preview hint ── */}
        <SectionLabel title="PREVIEW" />
        <View style={[styles.previewCard, { borderRadius: shape.md, borderColor: md.outlineVariant, backgroundColor: md.surfaceContainerHigh }]}>
          <View style={styles.previewHeader}>
            <PreviewCell position="left" appConfig={appConfig} />
            <PreviewCell position="center" appConfig={appConfig} />
            <PreviewCell position="right" appConfig={appConfig} />
          </View>
          <View style={[styles.previewDivider, { backgroundColor: md.primary }]} />
          <View style={styles.previewTask}>
            <View style={[styles.previewCheckbox, { borderRadius: shape.xs, borderColor: md.primary }]} />
            <View style={[styles.previewLine, { backgroundColor: md.surfaceContainerHighest, width: "60%" }]} />
          </View>
          <View style={styles.previewTask}>
            <View style={[styles.previewCheckbox, { borderRadius: shape.xs, borderColor: md.primary, backgroundColor: md.primary }]} />
            <View style={[styles.previewLine, { backgroundColor: md.surfaceContainerHighest, width: "45%", opacity: 0.6 }]} />
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
  const md = useMd();
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
        <View style={[styles.previewLogoPlaceholder, { borderRadius: shape.xs, backgroundColor: md.primaryContainer }]}>
          <Text style={{ fontSize: 8, color: md.onPrimaryContainer }}>IMG</Text>
        </View>
      )}
      {hasTitle && (
        <View
          style={[
            styles.previewTitleLine,
            { backgroundColor: md.onSurface, alignSelf: textAlign === "left" ? "flex-start" : textAlign === "right" ? "flex-end" : "center" },
          ]}
        />
      )}
      {hasDate && (
        <View
          style={[
            styles.previewDateLine,
            { backgroundColor: md.onSurfaceVariant, alignSelf: textAlign === "left" ? "flex-start" : textAlign === "right" ? "flex-end" : "center" },
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
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  backBtn: { margin: 0 },
  headerTitle: {
    ...typeStyle("titleLarge"),
    flex: 1,
    textAlign: "center",
    fontFamily: "Inter_700Bold",
  },

  sectionLabel: {
    ...typeStyle("titleSmall"),
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
    fontFamily: "Inter_700Bold",
  },

  block: {
    marginHorizontal: 16,
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
  settingLabelText: { ...typeStyle("bodyLarge"), fontFamily: "Inter_500Medium" },
  settingHint: typeStyle("bodySmall"),

  posRow: { flexDirection: "row", gap: 6 },
  posPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    alignItems: "center",
  },
  posPillText: typeStyle("labelMedium"),

  // Preview
  previewCard: {
    marginHorizontal: 16,
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
    borderWidth: 1.5,
  },
  previewLine: { height: 5, borderRadius: 3 },
});
