import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChecklist } from "@/context/ChecklistContext";
import { useColors } from "@/hooks/useColors";
import { extractTextFromPdf, ExtractionProgress } from "@/lib/pdf-extract";
import { parsePdfText, ParsedSection, ParsedTask } from "@/lib/pdf-parse";

import {
  createChecklist,
  createChecklistTask,
} from "@workspace/api-client-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage =
  | { kind: "idle" }
  | { kind: "picking" }
  | { kind: "processing"; message: string }
  | { kind: "review"; fileName: string }
  | { kind: "saving" };

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggleRequired,
  onDelete,
}: {
  task: ParsedTask;
  onToggleRequired: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.taskRow, { borderBottomColor: colors.border }]}>
      <View
        style={[
          styles.requiredDot,
          {
            backgroundColor: task.required ? colors.primary : "transparent",
            borderColor: task.required ? colors.primary : colors.border,
          },
        ]}
      />
      <Text style={[styles.taskText, { color: colors.foreground, flex: 1 }]} numberOfLines={3}>
        {task.text}
      </Text>
      <TouchableOpacity
        style={styles.reqToggle}
        onPress={() => onToggleRequired(task.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.reqToggleLabel, { color: colors.mutedForeground }]}>
          {task.required ? "Req" : "Opt"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.deleteBtn, { backgroundColor: colors.muted }]}
        onPress={() => onDelete(task.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={{ color: colors.destructive, fontSize: 14 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  section,
  onDeleteSection,
  onDeleteTask,
  onToggleRequired,
}: {
  section: ParsedSection;
  onDeleteSection: (id: string) => void;
  onDeleteTask: (sectionId: string, taskId: string) => void;
  onToggleRequired: (sectionId: string, taskId: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]} numberOfLines={1}>
          {section.title}
        </Text>
        <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
          {section.tasks.length} {section.tasks.length === 1 ? "task" : "tasks"}
        </Text>
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: colors.muted, marginLeft: 6 }]}
          onPress={() => onDeleteSection(section.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: colors.destructive, fontSize: 14 }}>✕</Text>
        </TouchableOpacity>
      </View>

      {section.tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onToggleRequired={(taskId) => onToggleRequired(section.id, taskId)}
          onDelete={(taskId) => onDeleteTask(section.id, taskId)}
        />
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ImportPdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { onChecklistImported } = useChecklist();

  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [checklistName, setChecklistName] = useState("");
  const [sections, setSections] = useState<ParsedSection[]>([]);
  const didLaunchPicker = useRef(false);

  const progressMessage = (p: ExtractionProgress): string => {
    switch (p.stage) {
      case "reading":
        return "Reading PDF…";
      case "extracting":
        return p.total
          ? `Extracting text (page ${p.page}/${p.total})…`
          : "Extracting text…";
      case "ocr_render":
        return "Rendering pages for OCR…";
      case "ocr_recognize":
        return p.total
          ? `Recognizing text (page ${p.page}/${p.total})…`
          : "Recognizing text…";
    }
  };

  const pickAndProcess = useCallback(async () => {
    setStage({ kind: "picking" });

    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
    } catch {
      router.back();
      return;
    }

    if (result.canceled || !result.assets?.length) {
      router.back();
      return;
    }

    const asset = result.assets[0];
    const fileName = asset.name ?? "document.pdf";
    const fileUri = asset.uri;

    setStage({ kind: "processing", message: "Reading PDF…" });

    try {
      const extraction = await extractTextFromPdf(fileUri, (p) => {
        setStage({ kind: "processing", message: progressMessage(p) });
      });

      const parsed = parsePdfText(extraction.text);

      if (parsed.sections.length === 0) {
        Alert.alert(
          "No tasks found",
          "The PDF didn't contain recognizable task structure. Make sure it has numbered or bulleted lists.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      const nameWithoutExt = fileName.replace(/\.pdf$/i, "").trim();
      setChecklistName(nameWithoutExt);
      setSections(parsed.sections);
      setStage({ kind: "review", fileName });
    } catch (e) {
      Alert.alert("Error", "Could not process the PDF. Please try another file.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [router]);

  // Launch the picker as soon as the screen mounts
  useEffect(() => {
    if (!didLaunchPicker.current) {
      didLaunchPicker.current = true;
      pickAndProcess();
    }
  }, [pickAndProcess]);

  const handleDeleteSection = useCallback((sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  }, []);

  const handleDeleteTask = useCallback((sectionId: string, taskId: string) => {
    setSections((prev) =>
      prev
        .map((s) =>
          s.id === sectionId
            ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }
            : s
        )
        .filter((s) => s.tasks.length > 0)
    );
  }, []);

  const handleToggleRequired = useCallback((sectionId: string, taskId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              tasks: s.tasks.map((t) =>
                t.id === taskId ? { ...t, required: !t.required } : t
              ),
            }
          : s
      )
    );
  }, []);

  const totalTasks = sections.reduce((n, s) => n + s.tasks.length, 0);

  const handleCreate = useCallback(async () => {
    const name = checklistName.trim();
    if (!name) return;
    if (totalTasks === 0) {
      Alert.alert("No tasks", "Add at least one task before creating the checklist.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStage({ kind: "saving" });

    try {
      const checklist = await createChecklist({ name });

      for (const section of sections) {
        for (let i = 0; i < section.tasks.length; i++) {
          const task = section.tasks[i];
          await createChecklistTask(checklist.id, {
            section: section.title,
            text: task.text,
            required: task.required,
            sortOrder: i,
          });
        }
      }

      onChecklistImported(checklist);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setStage({ kind: "review", fileName: "" });
      Alert.alert("Error", "Could not save the checklist. Please try again.");
    }
  }, [checklistName, sections, totalTasks, onChecklistImported, router]);

  // ── Loading / processing state ────────────────────────────────────────────

  if (stage.kind === "picking" || stage.kind === "processing" || stage.kind === "saving") {
    const message =
      stage.kind === "saving"
        ? `Creating checklist (${totalTasks} tasks)…`
        : stage.kind === "processing"
        ? stage.message
        : "Opening file picker…";

    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>{message}</Text>
      </View>
    );
  }

  // ── Review state ──────────────────────────────────────────────────────────

  const canCreate = checklistName.trim().length > 0 && totalTasks > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.primary,
            paddingTop: insets.top + 12,
          },
        ]}
      >
        <TouchableOpacity style={styles.headerSide} onPress={() => router.back()}>
          <Text style={styles.headerAction}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import PDF</Text>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={handleCreate}
          disabled={!canCreate}
        >
          <Text style={[styles.headerAction, { opacity: canCreate ? 1 : 0.4 }]}>
            Create
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Checklist name */}
        <View style={[styles.nameCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.nameLabel, { color: colors.mutedForeground }]}>
            CHECKLIST NAME
          </Text>
          <TextInput
            value={checklistName}
            onChangeText={setChecklistName}
            placeholder="Enter checklist name"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.nameInput,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
            returnKeyType="done"
            autoCapitalize="words"
          />
        </View>

        {/* Summary */}
        <View style={[styles.summaryRow]}>
          <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
            {sections.length} {sections.length === 1 ? "section" : "sections"} · {totalTasks}{" "}
            {totalTasks === 1 ? "task" : "tasks"}
          </Text>
          <Text style={[styles.summaryHint, { color: colors.mutedForeground }]}>
            Tap a dot to toggle required
          </Text>
        </View>

        {/* Legend */}
        <View style={[styles.legend, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>Required</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "transparent", borderColor: colors.border, borderWidth: 1.5 }]} />
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>Optional</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>Req/Opt = toggle</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>✕ = remove</Text>
          </View>
        </View>

        {/* Sections */}
        <View style={styles.sectionList}>
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              onDeleteSection={handleDeleteSection}
              onDeleteTask={handleDeleteTask}
              onToggleRequired={handleToggleRequired}
            />
          ))}
        </View>

        {sections.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              All sections removed. Go back and try a different PDF.
            </Text>
          </View>
        )}

        {/* Create button */}
        <TouchableOpacity
          style={[
            styles.createBtn,
            { backgroundColor: canCreate ? colors.primary : colors.muted },
          ]}
          onPress={handleCreate}
          disabled={!canCreate}
        >
          <Text style={[styles.createBtnText, { color: canCreate ? "#fff" : colors.mutedForeground }]}>
            Create Checklist · {totalTasks} {totalTasks === 1 ? "task" : "tasks"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
  },
  loadingText: {
    fontSize: 15,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },

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
  headerSide: { width: 70 },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: "Inter_700Bold",
  },
  headerAction: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },

  scrollContent: {
    padding: 16,
    gap: 12,
  },

  nameCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  nameLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontFamily: "Inter_600SemiBold",
  },
  nameInput: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  summaryText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
  },
  summaryHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  legend: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },

  sectionList: { gap: 10 },

  sectionCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  requiredDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  taskText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  reqToggle: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reqToggleLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  deleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  emptyState: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },

  createBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
