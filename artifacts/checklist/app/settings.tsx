import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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

import { Task, useChecklist } from "@/context/ChecklistContext";
import { useColors } from "@/hooks/useColors";

type EditTarget =
  | { kind: "section"; title: string }
  | { kind: "task"; task: Task }
  | { kind: "newTask"; category: string }
  | { kind: "newSection" }
  | null;

function EditModal({
  target,
  onClose,
}: {
  target: NonNullable<EditTarget>;
  onClose: () => void;
}) {
  const colors = useColors();
  const { addSection, updateSection, addTask, updateTask } = useChecklist();

  const isSection = target.kind === "section" || target.kind === "newSection";
  const isNewSection = target.kind === "newSection";
  const isTask = target.kind === "task";
  const isNewTask = target.kind === "newTask";

  const [text, setText] = useState(
    isSection && !isNewSection
      ? (target as { kind: "section"; title: string }).title
      : isTask
      ? (target as { kind: "task"; task: Task }).task.text
      : ""
  );
  const [required, setRequired] = useState(
    isTask ? (target as { kind: "task"; task: Task }).task.required : true
  );

  const valid = text.trim().length > 0;

  const handleSave = () => {
    if (!valid) return;
    if (isNewSection) {
      addSection(text.trim());
    } else if (target.kind === "section") {
      updateSection(target.title, text.trim());
    } else if (isNewTask && target.kind === "newTask") {
      addTask(target.category, text.trim(), required);
    } else if (isTask && target.kind === "task") {
      updateTask(target.task.id, { text: text.trim(), required });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View
          style={[styles.modalSheet, { backgroundColor: colors.card }]}
        >
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            {isNewSection
              ? "Add Section"
              : target.kind === "section"
              ? "Edit Section"
              : isNewTask
              ? "Add Task"
              : "Edit Task"}
          </Text>

          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
            {isSection ? "Section title" : "Task description"}
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={isSection ? "e.g. End of Night" : "Describe the task…"}
            placeholderTextColor={colors.mutedForeground}
            multiline={!isSection}
            numberOfLines={isSection ? 1 : 3}
            autoFocus
            style={[
              styles.textInput,
              {
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.border,
                minHeight: isSection ? 44 : 88,
              },
            ]}
          />

          {!isSection && (
            <View style={styles.requiredRow}>
              <View>
                <Text style={[styles.requiredLabel, { color: colors.foreground }]}>
                  Required task
                </Text>
                <Text style={[styles.requiredHint, { color: colors.mutedForeground }]}>
                  Required tasks are shown in bold
                </Text>
              </View>
              <Switch
                value={required}
                onValueChange={setRequired}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.muted }]}
              onPress={onClose}
            >
              <Text style={[styles.modalBtnText, { color: colors.foreground }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalBtn,
                {
                  backgroundColor: valid ? colors.primary : colors.border,
                  flex: 1.5,
                },
              ]}
              onPress={handleSave}
              disabled={!valid}
            >
              <Text style={[styles.modalBtnText, { color: "#fff" }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TaskSettingsRow({
  task,
  onEdit,
}: {
  task: Task;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const colors = useColors();
  const { removeTask, updateTask } = useChecklist();

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Remove Task", `Remove "${task.text}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removeTask(task.id),
      },
    ]);
  };

  const toggleRequired = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateTask(task.id, { required: !task.required });
  };

  return (
    <View
      style={[
        styles.taskSettingsRow,
        { borderBottomColor: colors.border },
      ]}
    >
      <TouchableOpacity onPress={toggleRequired} style={styles.requiredPill}>
        <View
          style={[
            styles.requiredDot,
            {
              backgroundColor: task.required ? colors.primary : colors.border,
            },
          ]}
        />
        <Text
          style={[
            styles.taskSettingsText,
            {
              color: task.required ? colors.foreground : colors.mutedForeground,
              fontWeight: task.required ? "600" : "400",
              flex: 1,
            },
          ]}
          numberOfLines={2}
        >
          {task.text}
        </Text>
      </TouchableOpacity>

      <View style={styles.taskActions}>
        <TouchableOpacity
          onPress={onEdit}
          style={[styles.iconBtn, { backgroundColor: colors.muted }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.iconBtnText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRemove}
          style={[styles.iconBtn, { backgroundColor: "#fff0f0" }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.iconBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SectionCard({
  title,
  tasks,
  onEdit,
}: {
  title: string;
  tasks: Task[];
  onEdit: (t: EditTarget) => void;
}) {
  const colors = useColors();
  const { removeSection } = useChecklist();
  const [expanded, setExpanded] = useState(true);

  const handleRemoveSection = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Remove Section",
      `Remove "${title}" and all ${tasks.length} task${tasks.length !== 1 ? "s" : ""} in it?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeSection(title),
        },
      ]
    );
  };

  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Section Header */}
      <View style={[styles.sectionCardHeader, { borderBottomColor: expanded ? colors.border : "transparent" }]}>
        <TouchableOpacity
          onPress={() => setExpanded((e) => !e)}
          style={styles.sectionTitleRow}
        >
          <Text style={[styles.chevron, { color: colors.mutedForeground }]}>
            {expanded ? "▾" : "▸"}
          </Text>
          <Text style={[styles.sectionCardTitle, { color: colors.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.taskCount, { color: colors.mutedForeground }]}>
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>
        <View style={styles.sectionHeaderActions}>
          <TouchableOpacity
            onPress={() => onEdit({ kind: "section", title })}
            style={[styles.iconBtn, { backgroundColor: colors.muted }]}
          >
            <Text style={styles.iconBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleRemoveSection}
            style={[styles.iconBtn, { backgroundColor: "#fff0f0" }]}
          >
            <Text style={styles.iconBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tasks */}
      {expanded && (
        <View>
          {tasks.map((task) => (
            <TaskSettingsRow
              key={task.id}
              task={task}
              onRemove={() => {}}
              onEdit={() => onEdit({ kind: "task", task })}
            />
          ))}
          <TouchableOpacity
            style={[styles.addTaskBtn, { borderColor: colors.border }]}
            onPress={() => onEdit({ kind: "newTask", category: title })}
          >
            <Text style={[styles.addTaskBtnText, { color: colors.primary }]}>
              + Add Task
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sections, tasks } = useChecklist();
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const isWeb = Platform.OS === "web";

  const topPadding = isWeb ? 67 : insets.top;

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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Legend */}
      <View style={[styles.legend, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.legendItem}>
          <View style={[styles.requiredDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.foreground, fontWeight: "600" }]}>
            Required
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.requiredDot, { backgroundColor: colors.border }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
            Optional
          </Text>
        </View>
        <Text style={[styles.legendHint, { color: colors.mutedForeground }]}>
          Tap the dot to toggle
        </Text>
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item}
        renderItem={({ item: section }) => (
          <SectionCard
            title={section}
            tasks={tasks.filter((t) => t.category === section)}
            onEdit={setEditTarget}
          />
        )}
        contentContainerStyle={{
          padding: 12,
          paddingBottom: (isWeb ? 34 : insets.bottom) + 80,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <TouchableOpacity
            style={[styles.addSectionBtn, { borderColor: colors.primary }]}
            onPress={() => setEditTarget({ kind: "newSection" })}
          >
            <Text style={[styles.addSectionBtnText, { color: colors.primary }]}>
              + Add Section
            </Text>
          </TouchableOpacity>
        }
      />

      {editTarget && (
        <EditModal target={editTarget} onClose={() => setEditTarget(null)} />
      )}
    </View>
  );
}

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
  backBtn: {
    width: 70,
  },
  backBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "500",
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: "Inter_700Bold",
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendText: {
    fontSize: 13,
  },
  legendHint: {
    fontSize: 12,
    marginLeft: "auto",
    fontStyle: "italic",
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  sectionTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chevron: {
    fontSize: 14,
    width: 14,
  },
  sectionCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  taskCount: {
    fontSize: 12,
  },
  sectionHeaderActions: {
    flexDirection: "row",
    gap: 6,
  },
  taskSettingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  requiredPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  requiredDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  taskSettingsText: {
    fontSize: 13,
    lineHeight: 18,
  },
  taskActions: {
    flexDirection: "row",
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: {
    fontSize: 14,
  },
  addTaskBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  addTaskBtnText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  addSectionBtn: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  addSectionBtnText: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  requiredRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  requiredLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  requiredHint: {
    fontSize: 12,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
