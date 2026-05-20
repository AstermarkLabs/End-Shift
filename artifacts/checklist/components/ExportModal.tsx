import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useChecklist } from "@/context/ChecklistContext";
import { useColors } from "@/hooks/useColors";
import {
  DOCX_NATIVE_UNSUPPORTED,
  exportChecklist,
  type ExportData,
  type ExportFormat,
} from "@/utils/exportChecklist";

// ─── Format pill ──────────────────────────────────────────────────────────────

function FormatPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.formatPill,
        {
          backgroundColor: selected ? colors.primary : colors.muted,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.formatPillText,
          { color: selected ? "#fff" : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── ExportModal ──────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  data: ExportData;
}

export function ExportModal({ visible, onClose, data }: Props) {
  const colors = useColors();
  const { appConfig } = useChecklist();

  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [includeStatus, setIncludeStatus] = useState(true);
  const [loading, setLoading] = useState(false);

  const formats: { key: ExportFormat; label: string; nativeOnly?: boolean }[] = [
    { key: "pdf", label: "PDF" },
    { key: "csv", label: "CSV" },
    { key: "docx", label: "DOCX" },
  ];

  const handleExport = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await exportChecklist(data, appConfig, {
        format,
        includeCompletionStatus: includeStatus,
      });
      onClose();
    } catch (err) {
      Alert.alert(
        "Export failed",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {/* Handle */}
        <View
          style={[styles.handle, { backgroundColor: colors.border }]}
        />

        <Text style={[styles.title, { color: colors.foreground }]}>
          Export Checklist
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {data.checklistName}
        </Text>

        {/* Format selector */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          FORMAT
        </Text>
        <View style={styles.formatRow}>
          {formats.map(({ key, label }) => {
            const disabled = key === "docx" && DOCX_NATIVE_UNSUPPORTED;
            return (
              <FormatPill
                key={key}
                label={disabled ? `${label} ✦` : label}
                selected={format === key}
                onPress={() => {
                  if (disabled) return;
                  setFormat(key);
                  Haptics.selectionAsync();
                }}
              />
            );
          })}
        </View>
        {DOCX_NATIVE_UNSUPPORTED && (
          <Text style={[styles.docxNote, { color: colors.mutedForeground }]}>
            ✦ DOCX download is available on web
          </Text>
        )}

        {/* Completion status toggle */}
        <View
          style={[styles.toggleRow, { borderColor: colors.border }]}
        >
          <View style={styles.toggleBody}>
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
              Include completion status
            </Text>
            <Text
              style={[styles.toggleHint, { color: colors.mutedForeground }]}
            >
              {includeStatus
                ? "Shows which tasks were checked off"
                : "Exports as a blank template"}
            </Text>
          </View>
          <Switch
            value={includeStatus}
            onValueChange={(v) => {
              setIncludeStatus(v);
              Haptics.selectionAsync();
            }}
            trackColor={{
              false: colors.muted,
              true: colors.primary + "80",
            }}
            thumbColor={includeStatus ? colors.primary : colors.mutedForeground}
          />
        </View>

        {/* Export button */}
        <TouchableOpacity
          style={[
            styles.exportBtn,
            { backgroundColor: loading ? colors.muted : colors.primary },
          ]}
          onPress={handleExport}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.exportBtnText}>
              Export as {format.toUpperCase()}
            </Text>
          )}
        </TouchableOpacity>

        {Platform.OS !== "web" && (
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  label: {
    fontSize: 10.5,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  formatRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  formatPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1.5,
  },
  formatPillText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
    gap: 12,
  },
  toggleBody: { flex: 1, gap: 2 },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
  toggleHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  exportBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  exportBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  cancelBtn: { paddingVertical: 14, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  docxNote: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: -12, marginBottom: 8 },
});
