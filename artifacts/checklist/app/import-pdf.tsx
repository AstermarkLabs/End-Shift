import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createChecklist,
  createChecklistTask,
  importChecklistFromPdf,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useChecklist } from "@/context/ChecklistContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReviewTask {
  text: string;
  required: boolean;
  included: boolean;
}

interface ReviewSection {
  title: string;
  tasks: ReviewTask[];
}

type Stage = "pick" | "uploading" | "review" | "creating";

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportPdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { onChecklistImported } = useChecklist();

  const [stage, setStage] = useState<Stage>("pick");
  const [sections, setSections] = useState<ReviewSection[]>([]);
  const [checklistName, setChecklistName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const styles = makeStyles(colors);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handlePickPdf() {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;

      const asset = picked.assets[0];
      const suggestedName = (asset.name ?? "Imported Checklist").replace(
        /\.pdf$/i,
        "",
      );
      setChecklistName(suggestedName);
      setError(null);
      setStage("uploading");

      const result = await importChecklistFromPdf({
        file: {
          uri: asset.uri,
          name: asset.name ?? "document.pdf",
          type: "application/pdf",
        } as unknown as string,
      });

      if (result.sections.length === 0 || result.sections.every((s) => s.tasks.length === 0)) {
        setError(
          "No tasks were found in this PDF. Make sure it contains a list of items.",
        );
        setStage("pick");
        return;
      }

      setSections(
        result.sections.map((s) => ({
          title: s.title,
          tasks: s.tasks.map((t) => ({
            text: t.text,
            required: t.required,
            included: true,
          })),
        })),
      );
      setStage("review");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to process the PDF.";
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
          <Text style={styles.headerTitle}>Import from PDF</Text>
          <View style={styles.closeBtn} />
        </View>

        <View style={styles.pickBody}>
          <Text style={styles.pickIcon}>📄</Text>
          <Text style={styles.pickTitle}>Upload a Checklist PDF</Text>
          <Text style={styles.pickSubtitle}>
            We'll scan the PDF and extract the tasks automatically.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {uploading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.tint} />
              <Text style={styles.loadingText}>Analysing PDF…</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.pickBtn} onPress={handlePickPdf}>
              <Text style={styles.pickBtnText}>Choose PDF</Text>
            </TouchableOpacity>
          )}
        </View>
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
      <View
        style={[styles.header, { paddingTop: insets.top }]}
      >
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

        <Text style={styles.nameLabel}>Checklist Name</Text>
        <TextInput
          style={styles.nameInput}
          value={checklistName}
          onChangeText={setChecklistName}
          placeholder="Enter checklist name"
          placeholderTextColor={colors.mutedForeground}
          editable={!creating}
        />

        {sections.map((section, si) => (
          <View key={si} style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.tasks.map((task, ti) => (
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
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom || 16 }]}
      >
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
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      gap: 16,
    },
    pickIcon: {
      fontSize: 64,
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
    pickBtn: {
      marginTop: 8,
      backgroundColor: colors.tint,
      paddingVertical: 14,
      paddingHorizontal: 40,
      borderRadius: 12,
    },
    pickBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
      fontFamily: "Inter_600SemiBold",
    },
    loadingBox: {
      marginTop: 8,
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
