import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createChecklist,
  createChecklistTask,
  importChecklistFromDocx,
  importChecklistFromPdf,
  importChecklistFromSpreadsheet,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useChecklist } from "@/context/ChecklistContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type ImportType = "pdf" | "docx" | "spreadsheet";

interface ReviewTask {
  text: string;
  required: boolean;
  included: boolean;
  subsection: string | null;
}

interface ReviewSection {
  title: string;
  tasks: ReviewTask[];
}

type Stage = "pick" | "uploading" | "review" | "creating";

// ── Helpers ───────────────────────────────────────────────────────────────────

const IMPORT_CONFIG: Record<
  ImportType,
  { label: string; icon: string; mimeType: string | string[]; ext: string; loadingText: string }
> = {
  pdf: {
    label: "PDF",
    icon: "📄",
    mimeType: "application/pdf",
    ext: ".pdf",
    loadingText: "Analysing PDF…",
  },
  docx: {
    label: "Word Document (.docx)",
    icon: "📝",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: ".docx",
    loadingText: "Reading Word document…",
  },
  spreadsheet: {
    label: "Spreadsheet (.xlsx / .csv)",
    icon: "📊",
    mimeType: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ],
    ext: ".xlsx/.csv",
    loadingText: "Reading spreadsheet…",
  },
};

function stripExtension(name: string): string {
  return name.replace(/\.(pdf|docx?|xlsx?|csv)$/i, "");
}

const TEMPLATE_PREVIEW_COLS = ["section", "task", "required", "subsection"] as const;
const TEMPLATE_PREVIEW_ROWS: [string, string, string, string][] = [
  ["Opening", "Count registers", "yes", ""],
  ["Opening", "Check stock levels", "no", "Dry goods"],
  ["Closing", "Lock all doors", "yes", ""],
];

function getTemplateUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";
  return `${base}/api/checklists/import/spreadsheet/template`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportChecklistScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { onChecklistImported } = useChecklist();

  const [stage, setStage] = useState<Stage>("pick");
  const [importType, setImportType] = useState<ImportType>("pdf");
  const [sections, setSections] = useState<ReviewSection[]>([]);
  const [checklistName, setChecklistName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [templateCopied, setTemplateCopied] = useState(false);
  const [showHeadingTip, setShowHeadingTip] = useState(false);

  const styles = makeStyles(colors);
  const config = IMPORT_CONFIG[importType];

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleShareTemplate() {
    const url = getTemplateUrl();
    if (Platform.OS === "web") {
      try {
        await Clipboard.setStringAsync(url);
        setTemplateCopied(true);
        setTimeout(() => setTemplateCopied(false), 2000);
      } catch {
        Alert.alert("Could not copy", "Please copy the link manually: " + url);
      }
    } else {
      try {
        await Share.share({ url, message: url, title: "CSV Checklist Template" });
      } catch (err) {
        // Ignore user-dismissed share sheet; only surface real errors
        const errMsg = err instanceof Error ? err.message : "";
        if (!errMsg.includes("dismissed")) {
          Alert.alert("Share failed", "Could not open the share sheet. Please try again.");
        }
      }
    }
  }

  async function handlePick(type: ImportType) {
    setImportType(type);
    const cfg = IMPORT_CONFIG[type];
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: Array.isArray(cfg.mimeType) ? cfg.mimeType : [cfg.mimeType],
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;

      const asset = picked.assets[0];
      const suggestedName = stripExtension(asset.name ?? "Imported Checklist");
      setChecklistName(suggestedName);
      setError(null);
      setStage("uploading");

      const filePayload = {
        uri: asset.uri,
        name: asset.name ?? `document${cfg.ext}`,
        type: Array.isArray(cfg.mimeType) ? cfg.mimeType[0] : cfg.mimeType,
      } as unknown as string;

      let result: Awaited<ReturnType<typeof importChecklistFromPdf>>;

      if (type === "pdf") {
        result = await importChecklistFromPdf({ file: filePayload });
      } else if (type === "docx") {
        result = await importChecklistFromDocx({ file: filePayload });
      } else {
        result = await importChecklistFromSpreadsheet({ file: filePayload });
      }

      if (
        result.sections.length === 0 ||
        result.sections.every((s) => s.tasks.length === 0)
      ) {
        setError(
          "No tasks were found in this file. Make sure it contains a list of items.",
        );
        setStage("pick");
        return;
      }

      const mapped = result.sections.map((s) => ({
        title: s.title,
        tasks: s.tasks.map((t) => ({
          text: t.text,
          required: t.required,
          included: true,
          subsection: t.subsection ?? null,
        })),
      }));
      setSections(mapped);
      setShowHeadingTip(
        type === "docx" &&
          mapped.length === 1 &&
          mapped[0].title === "General Tasks",
      );
      setStage("review");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to process the file.";
      setError(msg);
      setStage("pick");
    }
  }

  function toggleTask(sectionIdx: number, taskIdx: number) {
    setSections((prev) =>
      prev.map((s, si) =>
        si !== sectionIdx
          ? s
          : {
              ...s,
              tasks: s.tasks.map((t, ti) =>
                ti !== taskIdx ? t : { ...t, included: !t.included },
              ),
            },
      ),
    );
  }

  function toggleRequired(sectionIdx: number, taskIdx: number) {
    setSections((prev) =>
      prev.map((s, si) =>
        si !== sectionIdx
          ? s
          : {
              ...s,
              tasks: s.tasks.map((t, ti) =>
                ti !== taskIdx ? t : { ...t, required: !t.required },
              ),
            },
      ),
    );
  }

  async function handleCreate() {
    if (!checklistName.trim()) {
      Alert.alert("Name Required", "Please enter a name for the checklist.");
      return;
    }

    const includedSections = sections
      .map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.included) }))
      .filter((s) => s.tasks.length > 0);

    if (includedSections.length === 0) {
      Alert.alert("No Tasks", "Please include at least one task.");
      return;
    }

    setStage("creating");
    try {
      const checklist = await createChecklist({ name: checklistName.trim() });

      let sortOrder = 0;
      for (const section of includedSections) {
        for (const task of section.tasks) {
          await createChecklistTask(checklist.id, {
            section: section.title,
            subsection: task.subsection ?? undefined,
            text: task.text,
            required: task.required,
            sortOrder: sortOrder++,
          });
        }
      }

      onChecklistImported(checklist);
      router.back();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create the checklist.";
      Alert.alert("Error", msg);
      setStage("review");
    }
  }

  // ── Render: pick ───────────────────────────────────────────────────────────

  if (stage === "pick" || stage === "uploading") {
    const uploading = stage === "uploading";
    return (
      <View
        style={[
          styles.fullScreen,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Import Checklist</Text>
          <View style={styles.closeBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.pickBody}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.pickIcon}>📥</Text>
          <Text style={styles.pickTitle}>Choose a file to import</Text>
          <Text style={styles.pickSubtitle}>
            We'll extract the tasks automatically and let you review before saving.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {uploading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.tint} />
              <Text style={styles.loadingText}>{config.loadingText}</Text>
            </View>
          ) : (
            <View style={styles.pickOptions}>
              <TouchableOpacity
                style={styles.pickOption}
                onPress={() => handlePick("pdf")}
              >
                <Text style={styles.pickOptionIcon}>📄</Text>
                <View style={styles.pickOptionText}>
                  <Text style={[styles.pickOptionLabel, { color: colors.text }]}>PDF</Text>
                  <Text style={[styles.pickOptionDesc, { color: colors.mutedForeground }]}>
                    Any checklist PDF — we'll scan and extract tasks automatically.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pickOption}
                onPress={() => handlePick("docx")}
              >
                <Text style={styles.pickOptionIcon}>📝</Text>
                <View style={styles.pickOptionText}>
                  <Text style={[styles.pickOptionLabel, { color: colors.text }]}>
                    Word Document (.docx)
                  </Text>
                  <Text style={[styles.pickOptionDesc, { color: colors.mutedForeground }]}>
                    Headings become sections; bullet points and list items become tasks.
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.pickOption}>
                <TouchableOpacity
                  style={styles.pickOptionPressArea}
                  onPress={() => handlePick("spreadsheet")}
                >
                  <Text style={styles.pickOptionIcon}>📊</Text>
                  <View style={styles.pickOptionText}>
                    <Text style={[styles.pickOptionLabel, { color: colors.text }]}>
                      Spreadsheet (.xlsx / .xls / .csv)
                    </Text>
                    <Text style={[styles.pickOptionDesc, { color: colors.mutedForeground }]}>
                      Columns: <Text style={styles.mono}>section</Text>,{" "}
                      <Text style={styles.mono}>task</Text>,{" "}
                      <Text style={styles.mono}>required</Text>,{" "}
                      <Text style={styles.mono}>subsection</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
                {/* Inline template preview */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.previewScroll}
                  contentContainerStyle={styles.previewScrollContent}
                >
                  <View style={[styles.previewTable, { borderColor: colors.border }]}>
                    <View style={[styles.previewRow, styles.previewRowHeader, { backgroundColor: colors.muted ?? colors.secondary, borderBottomColor: colors.border }]}>
                      {TEMPLATE_PREVIEW_COLS.map((col) => (
                        <Text key={col} style={[styles.previewCell, styles.previewCellHeader, { color: colors.mutedForeground }]}>
                          {col}
                        </Text>
                      ))}
                    </View>
                    {TEMPLATE_PREVIEW_ROWS.map((row, i) => (
                      <View
                        key={i}
                        style={[
                          styles.previewRow,
                          i < TEMPLATE_PREVIEW_ROWS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                        ]}
                      >
                        {row.map((cell, j) => (
                          <Text
                            key={j}
                            numberOfLines={1}
                            style={[styles.previewCell, { color: cell ? colors.text : colors.mutedForeground }]}
                          >
                            {cell || "—"}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.templateLinkBtn}>
                  <TouchableOpacity
                    onPress={() => { void Linking.openURL(getTemplateUrl()); }}
                  >
                    <Text style={[styles.templateLink, { color: colors.tint }]}>
                      Download CSV template ↓
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { void handleShareTemplate(); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.shareIconBtn}
                  >
                    <Text style={[styles.shareIcon, { color: templateCopied ? colors.tint : colors.mutedForeground }]}>
                      {templateCopied ? "Copied!" : "⎘"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Render: review ─────────────────────────────────────────────────────────

  const creating = stage === "creating";
  const totalIncluded = sections.reduce(
    (n, s) => n + s.tasks.filter((t) => t.included).length,
    0,
  );

  return (
    <KeyboardAvoidingView
      style={styles.fullScreen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => setStage("pick")}
          style={styles.closeBtn}
          disabled={creating}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Tasks</Text>
        <View style={styles.closeBtn} />
      </View>

      <ScrollView
        style={styles.reviewScroll}
        contentContainerStyle={[
          styles.reviewContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.reviewHint}>
          Toggle tasks to include or exclude them. Tap "Required" to change
          whether a task is mandatory.
        </Text>

        {showHeadingTip ? (
          <View style={styles.headingTipBox}>
            <Text style={styles.headingTipText}>
              <Text style={styles.headingTipBold}>Tip: </Text>
              Add Heading 1 / Heading 2 styles in Word to split tasks into
              sections automatically.
            </Text>
            <TouchableOpacity
              onPress={() => setShowHeadingTip(false)}
              style={styles.headingTipDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.headingTipDismissText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.nameLabel}>Checklist Name</Text>
        <TextInput
          style={styles.nameInput}
          value={checklistName}
          onChangeText={setChecklistName}
          placeholder="Enter checklist name"
          placeholderTextColor={colors.mutedForeground}
          editable={!creating}
        />

        {sections.map((section, si) => {
          const items: React.ReactElement[] = [];
          let lastSub: string | null | undefined = undefined;
          section.tasks.forEach((task, ti) => {
            const sub = task.subsection ?? null;
            if (sub !== lastSub) {
              if (sub) {
                items.push(
                  <Text key={`sub-${si}-${ti}`} style={styles.subsectionLabel}>
                    {sub}
                  </Text>,
                );
              }
              lastSub = sub;
            }
            items.push(
              <View key={ti} style={styles.taskRow}>
                <TouchableOpacity
                  onPress={() => toggleTask(si, ti)}
                  style={styles.taskCheckbox}
                  disabled={creating}
                >
                  <Text style={styles.taskCheckboxIcon}>
                    {task.included ? "☑" : "☐"}
                  </Text>
                </TouchableOpacity>
                <Text
                  style={[
                    styles.taskText,
                    !task.included && styles.taskTextDimmed,
                  ]}
                  numberOfLines={3}
                >
                  {task.text}
                </Text>
                {task.included ? (
                  <TouchableOpacity
                    onPress={() => toggleRequired(si, ti)}
                    style={[
                      styles.reqBadge,
                      task.required && styles.reqBadgeActive,
                    ]}
                    disabled={creating}
                  >
                    <Text
                      style={[
                        styles.reqBadgeText,
                        task.required && styles.reqBadgeTextActive,
                      ]}
                    >
                      Required
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.reqBadgePlaceholder} />
                )}
              </View>,
            );
          });
          return (
            <View key={si} style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {items}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom || 16 }]}>
        {creating ? (
          <View style={styles.creatingRow}>
            <ActivityIndicator size="small" color={colors.tint} />
            <Text style={styles.creatingText}>Creating checklist…</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.createBtn,
              totalIncluded === 0 && styles.createBtnDisabled,
            ]}
            onPress={handleCreate}
            disabled={totalIncluded === 0}
          >
            <Text style={styles.createBtnText}>
              Create Checklist ({totalIncluded}{" "}
              {totalIncluded === 1 ? "task" : "tasks"})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    fullScreen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
    },
    closeBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    closeBtnText: {
      fontSize: 18,
      color: colors.mutedForeground,
    },

    // Pick stage
    pickBody: {
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 40,
      gap: 16,
    },
    pickIcon: {
      fontSize: 56,
    },
    pickTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
      fontFamily: "Inter_700Bold",
    },
    pickSubtitle: {
      fontSize: 15,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 22,
    },
    pickOptions: {
      width: "100%",
      gap: 10,
      marginTop: 8,
    },
    pickOption: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    pickOptionPressArea: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 16,
      gap: 14,
    },
    pickOptionIcon: {
      fontSize: 28,
      lineHeight: 32,
    },
    pickOptionText: {
      flex: 1,
      gap: 4,
    },
    pickOptionLabel: {
      fontSize: 15,
      fontWeight: "600",
      fontFamily: "Inter_600SemiBold",
    },
    pickOptionDesc: {
      fontSize: 13,
      lineHeight: 18,
    },
    mono: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 12,
    },
    templateLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 10,
    },
    templateLink: {
      fontSize: 13,
      fontWeight: "500",
      textDecorationLine: "underline",
    },
    shareIconBtn: {
      marginLeft: "auto",
    },
    shareIcon: {
      fontSize: 13,
      fontWeight: "500",
    },

    // Template preview table
    previewScroll: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
    },
    previewScrollContent: {
      flexGrow: 1,
    },
    previewTable: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 8,
      overflow: "hidden",
      flexDirection: "column",
    },
    previewRow: {
      flexDirection: "row",
    },
    previewRowHeader: {
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    previewCell: {
      width: 88,
      paddingHorizontal: 7,
      paddingVertical: 5,
      fontSize: 11,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    previewCellHeader: {
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    loadingBox: {
      marginTop: 16,
      alignItems: "center",
      gap: 12,
    },
    loadingText: {
      fontSize: 15,
      color: colors.mutedForeground,
    },
    errorBox: {
      backgroundColor: colors.destructive + "22",
      borderRadius: 10,
      padding: 14,
      width: "100%",
    },
    errorText: {
      color: colors.destructive,
      fontSize: 14,
      textAlign: "center",
    },

    // Heading tip banner
    headingTipBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: colors.tint + "18",
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.tint + "55",
      padding: 12,
      marginBottom: 8,
      gap: 10,
    },
    headingTipText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 19,
    },
    headingTipBold: {
      fontWeight: "700",
      fontFamily: "Inter_700Bold",
    },
    headingTipDismiss: {
      paddingTop: 1,
    },
    headingTipDismissText: {
      fontSize: 14,
      color: colors.mutedForeground,
    },

    // Review stage
    reviewScroll: {
      flex: 1,
    },
    reviewContent: {
      padding: 16,
      gap: 8,
    },
    reviewHint: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginBottom: 8,
      lineHeight: 18,
    },
    nameLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.mutedForeground,
      marginBottom: 4,
      fontFamily: "Inter_600SemiBold",
    },
    nameInput: {
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sectionBlock: {
      marginBottom: 12,
    },
    subsectionLabel: {
      fontSize: 11,
      fontWeight: "600",
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 2,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.tint,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      fontFamily: "Inter_700Bold",
    },
    taskRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 4,
      gap: 10,
    },
    taskCheckbox: {
      width: 24,
      alignItems: "center",
    },
    taskCheckboxIcon: {
      fontSize: 20,
      color: colors.tint,
    },
    taskText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    taskTextDimmed: {
      color: colors.mutedForeground,
      textDecorationLine: "line-through",
    },
    reqBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reqBadgeActive: {
      backgroundColor: colors.destructive + "22",
      borderColor: colors.destructive,
    },
    reqBadgeText: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: "500",
    },
    reqBadgeTextActive: {
      color: colors.destructive,
    },
    reqBadgePlaceholder: {
      width: 64,
    },

    // Footer
    footer: {
      padding: 16,
      backgroundColor: colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    createBtn: {
      backgroundColor: colors.tint,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    createBtnDisabled: {
      opacity: 0.4,
    },
    createBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
      fontFamily: "Inter_600SemiBold",
    },
    creatingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 14,
    },
    creatingText: {
      fontSize: 15,
      color: colors.mutedForeground,
    },
  });
}
