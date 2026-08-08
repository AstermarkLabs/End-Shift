import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Chip, IconButton, List, Switch, TextInput as PaperTextInput } from "react-native-paper";

import { Ionicons } from "@expo/vector-icons";

import {
  listRoles,
  getChecklistRoles,
  updateChecklistRoles,
} from "@workspace/api-client-react";
import type { Role } from "@workspace/api-client-react";

import { SortableList } from "@/components/SortableList";
import { Task, useChecklist } from "@/context/ChecklistContext";
import shape from "@/constants/shape";
import { typeStyle } from "@/constants/typography";
import { useMd } from "@/theme/useMd";

// ─── Drag Handle ─────────────────────────────────────────────────────────────

function DragHandle({
  panHandlers,
  isActive,
}: {
  panHandlers: object;
  isActive: boolean;
}) {
  const md = useMd();
  return (
    <View
      {...panHandlers}
      style={[styles.dragHandle, { opacity: isActive ? 0.4 : 0.55 }]}
    >
      <View style={[styles.dragLine, { backgroundColor: md.onSurfaceVariant }]} />
      <View style={[styles.dragLine, { backgroundColor: md.onSurfaceVariant }]} />
      <View style={[styles.dragLine, { backgroundColor: md.onSurfaceVariant }]} />
    </View>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
// NOTE: renaming a section is keyed by its title string (updateSection(oldTitle,
// newTitle) + tasks are filtered by t.category === title), so this stays a
// modal commit boundary rather than an inline per-keystroke field — an inline
// input would fragment the section into a new category on every keystroke.

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
  const md = useMd();
  const insets = useSafeAreaInsets();
  const { addSection, updateSection, addTask, updateTask } = useChecklist();

  const isNewSection = target.kind === "newSection";
  const isSection = target.kind === "section" || isNewSection;
  const isTask = target.kind === "task";
  const isNewTask = target.kind === "newTask";

  const [text, setText] = useState(
    target.kind === "section"
      ? target.title
      : target.kind === "task"
      ? target.task.text
      : ""
  );
  const [required, setRequired] = useState(
    target.kind === "task" ? target.task.required : true
  );

  const valid = text.trim().length > 0;

  const handleSave = () => {
    if (!valid) return;
    if (isNewSection) addSection(text.trim());
    else if (target.kind === "section") updateSection(target.title, text.trim());
    else if (isNewTask && target.kind === "newTask") addTask(target.category, text.trim(), required);
    else if (isTask && target.kind === "task") updateTask(target.task.id, { text: text.trim(), required });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <Pressable style={[styles.modalBackdrop, { backgroundColor: md.scrim + "66" }]} onPress={onClose} />
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
          <Text style={[styles.modalTitle, { color: md.onSurface }]}>
            {isNewSection ? "Add Section" : target.kind === "section" ? "Edit Section" : isNewTask ? "Add Task" : "Edit Task"}
          </Text>
          <PaperTextInput
            mode="outlined"
            label={isSection ? "Section title" : "Task description"}
            value={text}
            onChangeText={setText}
            placeholder={isSection ? "e.g. End of Night" : "Describe the task…"}
            multiline={!isSection}
            numberOfLines={isSection ? 1 : 3}
            autoFocus
            style={{ minHeight: isSection ? undefined : 88 }}
          />
          {!isSection && (
            <View style={styles.requiredRow}>
              <View>
                <Text style={[styles.requiredLabel, { color: md.onSurface }]}>Required task</Text>
                <Text style={[styles.requiredHint, { color: md.onSurfaceVariant }]}>Required tasks are shown in bold</Text>
              </View>
              <Switch value={required} onValueChange={setRequired} color={md.primary} />
            </View>
          )}
          <View style={styles.modalActions}>
            <Button mode="text" onPress={onClose}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleSave} disabled={!valid} style={{ flex: 1.5, borderRadius: shape.md }}>
              Save
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskSettingsRow({
  task,
  isActive,
  dragHandleProps,
  onEdit,
}: {
  task: Task;
  isActive: boolean;
  dragHandleProps: object;
  onEdit: () => void;
}) {
  const md = useMd();
  const { removeTask, updateTask } = useChecklist();

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Remove Task", `Remove "${task.text}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeTask(task.id) },
    ]);
  };

  const toggleRequired = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateTask(task.id, { required: !task.required });
  };

  return (
    <View
      style={[
        styles.taskRow,
        {
          borderRadius: shape.sm,
          backgroundColor: isActive ? md.surfaceContainerHighest : md.surfaceContainerLow,
        },
      ]}
    >
      <DragHandle panHandlers={dragHandleProps} isActive={isActive} />
      <Text
        style={[
          typeStyle("bodyMedium"),
          {
            color: task.required ? md.onSurface : md.onSurfaceVariant,
            fontFamily: task.required ? "Inter_500Medium" : "Inter_400Regular",
            flex: 1,
          },
        ]}
        numberOfLines={2}
      >
        {task.text}
      </Text>
      <Chip
        compact
        onPress={toggleRequired}
        style={{
          backgroundColor: task.required ? md.secondaryContainer : md.surfaceContainerHighest,
          borderRadius: shape.sm,
        }}
        textStyle={[
          typeStyle("labelSmall"),
          { color: task.required ? md.onSecondaryContainer : md.onSurfaceVariant },
        ]}
      >
        {task.required ? "required" : "optional"}
      </Chip>
      <View style={styles.rowActions}>
        <IconButton
          icon={() => <Ionicons name="pencil" size={14} color={md.onSurfaceVariant} />}
          size={14}
          onPress={onEdit}
          style={[styles.iconBtn, { backgroundColor: md.surfaceContainerHighest }]}
        />
        <IconButton
          icon={() => <Ionicons name="trash-outline" size={14} color={md.error} />}
          size={14}
          onPress={handleRemove}
          style={[styles.iconBtn, { backgroundColor: md.errorContainer }]}
        />
      </View>
    </View>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  isActive: sectionActive,
  dragHandleProps,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  title: string;
  isActive: boolean;
  dragHandleProps: object;
  onEdit: (t: EditTarget) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const md = useMd();
  const { tasks, removeSection, reorderTasksInSection } = useChecklist();
  const sectionTasks = tasks.filter((t) => t.category === title);
  const [expanded, setExpanded] = useState(true);

  const handleRemoveSection = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Remove Section",
      `Remove "${title}" and all ${sectionTasks.length} task${sectionTasks.length !== 1 ? "s" : ""} in it?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeSection(title) },
      ]
    );
  };

  return (
    <Card
      mode="outlined"
      style={[
        styles.sectionCard,
        {
          borderRadius: shape.lg,
          borderColor: sectionActive ? md.primary : md.outlineVariant,
          borderWidth: sectionActive ? 1.5 : StyleSheet.hairlineWidth,
          backgroundColor: md.surface,
        },
      ]}
    >
      {/* Section header */}
      <View style={[styles.sectionHeader, { borderBottomColor: expanded ? md.outlineVariant : "transparent" }]}>
        <DragHandle panHandlers={dragHandleProps} isActive={sectionActive} />
        <TouchableOpacity onPress={() => setExpanded((e) => !e)} style={styles.sectionTitleRow}>
          <Ionicons name={expanded ? "chevron-down" : "chevron-forward"} size={14} color={md.onSurfaceVariant} />
          <Text style={[styles.sectionTitle, { color: md.onSurface }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.taskCount, { color: md.onSurfaceVariant }]}>
            {sectionTasks.length} task{sectionTasks.length !== 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>
        <View style={styles.rowActions}>
          <IconButton
            icon={() => <Ionicons name="pencil" size={14} color={md.onSurfaceVariant} />}
            size={14}
            onPress={() => onEdit({ kind: "section", title })}
            style={[styles.iconBtn, { backgroundColor: md.surfaceContainerHighest }]}
          />
          <IconButton
            icon={() => <Ionicons name="trash-outline" size={14} color={md.error} />}
            size={14}
            onPress={handleRemoveSection}
            style={[styles.iconBtn, { backgroundColor: md.errorContainer }]}
          />
        </View>
      </View>

      {/* Sortable tasks */}
      {expanded && (
        <View>
          <SortableList
            data={sectionTasks}
            keyExtractor={(t) => String(t.id)}
            itemSize={48}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onReorder={(newData) => reorderTasksInSection(title, newData)}
            renderItem={({ item, isActive, dragHandleProps: hp }) => (
              <TaskSettingsRow
                task={item}
                isActive={isActive}
                dragHandleProps={hp}
                onEdit={() => onEdit({ kind: "task", task: item })}
              />
            )}
          />
          <Button
            mode="text"
            icon="plus"
            compact
            onPress={() => onEdit({ kind: "newTask", category: title })}
            style={styles.addTaskBtn}
            contentStyle={{ justifyContent: "flex-start" }}
          >
            Add a task
          </Button>
        </View>
      )}
    </Card>
  );
}

// ─── Role Restrict Card ───────────────────────────────────────────────────────

function RoleRestrictCard({ checklistId }: { checklistId: string }) {
  const md = useMd();
  const numericId = parseInt(checklistId, 10);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allowedRoleIds, setAllowedRoleIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(numericId)) return;
    setLoading(true);
    try {
      const [roles, restrictions] = await Promise.all([
        listRoles(),
        getChecklistRoles(numericId),
      ]);
      setAllRoles(roles);
      setAllowedRoleIds(restrictions.allowedRoleIds);
    } finally {
      setLoading(false);
    }
  }, [numericId]);

  useEffect(() => { load(); }, [load]);

  const toggleRole = async (roleId: number) => {
    const next = allowedRoleIds.includes(roleId)
      ? allowedRoleIds.filter((r) => r !== roleId)
      : [...allowedRoleIds, roleId];
    setAllowedRoleIds(next);
    setSaving(true);
    try {
      const result = await updateChecklistRoles(numericId, { roleIds: next });
      setAllowedRoleIds(result.allowedRoleIds);
    } catch {
      setAllowedRoleIds(allowedRoleIds);
    } finally {
      setSaving(false);
    }
  };

  const hint =
    allowedRoleIds.length === 0
      ? "Visible to all roles"
      : `Restricted to ${allowedRoleIds.length} role${allowedRoleIds.length !== 1 ? "s" : ""}`;

  return (
    <Card mode="outlined" style={[styles.roleCard, { borderRadius: shape.lg, borderColor: md.outlineVariant, backgroundColor: md.surface }]}>
      <Text style={[styles.roleCardLabel, { color: md.onSurfaceVariant }]}>RESTRICT TO ROLES</Text>
      <Text style={[styles.roleCardHint, { color: md.onSurfaceVariant }]}>{hint}</Text>
      {loading ? (
        <Text style={[styles.roleCardHint, { color: md.onSurfaceVariant, padding: 4 }]}>
          Loading roles…
        </Text>
      ) : allRoles.length === 0 ? (
        <Text style={[styles.roleCardHint, { color: md.onSurfaceVariant }]}>
          No roles found for this tenant.
        </Text>
      ) : (
        allRoles.map((role) => (
          <List.Item
            key={role.id}
            title={role.name}
            description={allowedRoleIds.length === 0 ? "unrestricted" : undefined}
            titleStyle={[typeStyle("bodyLarge"), { color: md.onSurface }]}
            descriptionStyle={[typeStyle("bodySmall"), { color: md.onSurfaceVariant }]}
            style={[styles.roleRow, { borderTopColor: md.outlineVariant }]}
            right={() => (
              <Switch
                value={allowedRoleIds.includes(role.id)}
                onValueChange={() => toggleRole(role.id)}
                color={md.primary}
                disabled={saving}
              />
            )}
          />
        ))
      )}
    </Card>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────

export default function ChecklistSettingsScreen() {
  const md = useMd();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { checklists, activeChecklistId, updateChecklistName, sections, tasks, reorderSections, storageMode } = useChecklist();
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const isWeb = Platform.OS === "web";
  const topPadding = isWeb ? 67 : insets.top;

  const activeMeta = checklists.find((c) => c.id === activeChecklistId);
  const [nameValue, setNameValue] = useState(activeMeta?.name ?? "");
  const [nameDirty, setNameDirty] = useState(false);

  const handleNameSave = () => {
    if (!nameValue.trim() || !activeMeta) return;
    updateChecklistName(activeMeta.id, nameValue.trim());
    setNameDirty(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.container, { backgroundColor: md.surface }]}>
      {/* Top app bar */}
      <View
        style={[
          styles.header,
          { backgroundColor: md.surface, borderBottomColor: md.outlineVariant, paddingTop: topPadding },
        ]}
      >
        <IconButton
          icon={() => <Ionicons name="chevron-back" size={22} color={md.onSurfaceVariant} />}
          onPress={() => router.back()}
          style={styles.backIconBtn}
        />
        <Text style={[styles.headerTitle, { color: md.onSurface }]} numberOfLines={1}>
          Edit Tasks &amp; Sections
        </Text>
        <Button mode="text" onPress={() => router.back()} textColor={md.primary} compact>
          Done
        </Button>
      </View>

      <ScrollView
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 12,
          paddingBottom: (isWeb ? 34 : insets.bottom) + 80,
          gap: 12,
        }}
      >
        {/* Checklist name card */}
        <Card mode="outlined" style={[styles.nameCard, { borderRadius: shape.lg, borderColor: md.outlineVariant, backgroundColor: md.surface }]}>
          <Text style={[styles.nameCardLabel, { color: md.onSurfaceVariant }]}>CHECKLIST NAME</Text>
          <View style={styles.nameCardRow}>
            <PaperTextInput
              mode="outlined"
              dense
              value={nameValue}
              onChangeText={(v) => {
                setNameValue(v);
                setNameDirty(v.trim() !== (activeMeta?.name ?? ""));
              }}
              placeholder="Checklist name"
              returnKeyType="done"
              onSubmitEditing={handleNameSave}
              style={styles.nameCardInput}
            />
            {nameDirty && (
              <Button mode="contained" onPress={handleNameSave} compact style={{ borderRadius: shape.sm }}>
                Save
              </Button>
            )}
          </View>
        </Card>

        {/* Legend */}
        <View style={[styles.legend, { backgroundColor: md.surfaceContainerLow, borderColor: md.outlineVariant, borderRadius: shape.lg }]}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: md.secondaryContainer }]} />
            <Text style={[typeStyle("bodyMedium"), { color: md.onSurface, fontFamily: "Inter_500Medium" }]}>Required</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: md.surfaceContainerHighest }]} />
            <Text style={[typeStyle("bodyMedium"), { color: md.onSurfaceVariant }]}>Optional</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="reorder-two" size={16} color={md.onSurfaceVariant} />
            <Text style={[typeStyle("bodyMedium"), { color: md.onSurfaceVariant }]}>Hold to reorder</Text>
          </View>
        </View>

        {/* Sortable sections */}
        <SortableList
          data={sections}
          keyExtractor={(s) => s}
          itemSize={56}
          onDragStart={() => setScrollEnabled(false)}
          onDragEnd={() => setScrollEnabled(true)}
          onReorder={reorderSections}
          style={{ gap: 12 }}
          renderItem={({ item: section, isActive, dragHandleProps }) => (
            <SectionCard
              title={section}
              isActive={isActive}
              dragHandleProps={dragHandleProps}
              onEdit={setEditTarget}
              onDragStart={() => setScrollEnabled(false)}
              onDragEnd={() => setScrollEnabled(true)}
            />
          )}
        />

        {/* Add section */}
        <Button
          mode="outlined"
          onPress={() => setEditTarget({ kind: "newSection" })}
          style={{ borderRadius: shape.lg, borderColor: md.primary }}
        >
          + Add Section
        </Button>

        {/* Role restrictions — personal (local-storage) accounts have no tenant/role system */}
        {activeChecklistId && storageMode === "cloud" ? (
          <RoleRestrictCard checklistId={activeChecklistId} />
        ) : null}
      </ScrollView>

      {editTarget && <EditModal target={editTarget} onClose={() => setEditTarget(null)} />}
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
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backIconBtn: { margin: 0 },
  headerTitle: {
    flex: 1,
    ...typeStyle("titleLarge"),
    fontFamily: "Inter_700Bold",
  },

  // Drag handle
  dragHandle: {
    width: 30,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flexShrink: 0,
    cursor: "grab" as any,
  },
  dragLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
  },

  // Name card
  nameCard: {
    padding: 14,
    gap: 8,
  },
  nameCardLabel: {
    ...typeStyle("labelMedium"),
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  nameCardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameCardInput: {
    flex: 1,
  },

  // Legend
  legend: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },

  // Section card
  sectionCard: {
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  sectionTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  sectionTitle: { ...typeStyle("titleSmall"), fontFamily: "Inter_700Bold", flex: 1 },
  taskCount: typeStyle("labelMedium"),
  rowActions: { flexDirection: "row", gap: 6 },
  iconBtn: { width: 28, height: 28, margin: 0, borderRadius: 8 },

  // Task row
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
    paddingVertical: 6,
    marginHorizontal: 10,
    marginVertical: 3,
    gap: 8,
  },

  addTaskBtn: {
    marginHorizontal: 6,
    marginBottom: 6,
    alignSelf: "flex-start",
  },

  // Role card
  roleCard: {
    padding: 14,
    gap: 4,
  },
  roleCardLabel: {
    ...typeStyle("labelMedium"),
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  roleCardHint: {
    ...typeStyle("bodySmall"),
    marginBottom: 4,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  roleInfo: { flex: 1, gap: 1 },
  roleName: typeStyle("bodyLarge"),
  roleAccess: typeStyle("labelSmall"),

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalSheet: { padding: 20, paddingBottom: 36, gap: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  modalTitle: { ...typeStyle("headlineSmall"), marginBottom: 4 },
  inputLabel: { ...typeStyle("labelMedium"), textTransform: "uppercase", letterSpacing: 0.5 },
  textInput: {
    ...typeStyle("bodyLarge"),
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  requiredRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  requiredLabel: { ...typeStyle("bodyLarge"), fontFamily: "Inter_500Medium" },
  requiredHint: { ...typeStyle("bodySmall"), marginTop: 2 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4, alignItems: "center" },
});
