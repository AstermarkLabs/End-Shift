import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SortableList } from "@/components/SortableList";
import { ChecklistMeta, Task, useChecklist } from "@/context/ChecklistContext";
import { useColors } from "@/hooks/useColors";

// ─── Name Modal (for creating / renaming checklists) ─────────────────────────

function NameModal({
  visible,
  initial,
  title,
  onSave,
  onClose,
}: {
  visible: boolean;
  initial: string;
  title: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.nameModalOverlay}
      >
        <Pressable style={styles.nameModalBackdrop} onPress={onClose} />
        <View style={[styles.nameModalBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.nameModalTitle, { color: colors.foreground }]}>
            {title}
          </Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Checklist name"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
            style={[
              styles.nameModalInput,
              {
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />
          <View style={styles.nameModalActions}>
            <TouchableOpacity
              style={[styles.nameModalBtn, { backgroundColor: colors.muted }]}
              onPress={onClose}
            >
              <Text style={[styles.nameModalBtnText, { color: colors.foreground }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.nameModalBtn,
                {
                  backgroundColor: value.trim() ? colors.primary : colors.border,
                  flex: 1.4,
                },
              ]}
              onPress={handleSave}
              disabled={!value.trim()}
            >
              <Text style={[styles.nameModalBtnText, { color: "#fff" }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Tab Context Menu ─────────────────────────────────────────────────────────

function TabContextMenu({
  target,
  onClose,
  onEdit,
  onRename,
  onDelete,
}: {
  target: { id: string; name: string } | null;
  onClose: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  if (!target) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.ctxBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.ctxSheet,
            {
              backgroundColor: colors.card,
              paddingBottom: (isWeb ? 16 : insets.bottom) + 12,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.ctxHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.ctxTitle, { color: colors.mutedForeground }]}>
            {target.name}
          </Text>

          <TouchableOpacity
            style={[styles.ctxRow, { borderBottomColor: colors.border }]}
            onPress={onEdit}
            activeOpacity={0.7}
          >
            <Text style={styles.ctxRowIcon}>✏️</Text>
            <Text style={[styles.ctxRowText, { color: colors.foreground }]}>
              Edit Tasks & Sections
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ctxRow, { borderBottomColor: colors.border }]}
            onPress={onRename}
            activeOpacity={0.7}
          >
            <Text style={styles.ctxRowIcon}>🔤</Text>
            <Text style={[styles.ctxRowText, { color: colors.foreground }]}>
              Rename
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ctxRow, { borderBottomColor: "transparent" }]}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <Text style={styles.ctxRowIcon}>🗑️</Text>
            <Text style={[styles.ctxRowText, { color: colors.destructive }]}>
              Delete
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ctxCancelBtn, { backgroundColor: colors.muted }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.ctxCancelText, { color: colors.foreground }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function ChecklistTabBar() {
  const colors = useColors();
  const router = useRouter();
  const {
    checklists,
    activeChecklistId,
    setActiveChecklistId,
    addChecklist,
    updateChecklistName,
    removeChecklist,
    reorderChecklists,
  } = useChecklist();

  const [modal, setModal] = useState<
    { kind: "new" } | { kind: "rename"; id: string; name: string } | null
  >(null);
  const [ctxTarget, setCtxTarget] = useState<{ id: string; name: string } | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const handleTabPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveChecklistId(id);
  };

  const handleTabLongPress = (id: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCtxTarget({ id, name });
  };

  const handleCtxEdit = () => {
    if (!ctxTarget) return;
    setCtxTarget(null);
    setActiveChecklistId(ctxTarget.id);
    router.push("/checklist-settings");
  };

  const handleCtxRename = () => {
    if (!ctxTarget) return;
    const { id, name } = ctxTarget;
    setCtxTarget(null);
    setModal({ kind: "rename", id, name });
  };

  const handleCtxDelete = () => {
    if (!ctxTarget) return;
    const { id, name } = ctxTarget;
    setCtxTarget(null);
    if (checklists.length <= 1) {
      Alert.alert("Can't delete", "You must keep at least one checklist.");
      return;
    }
    Alert.alert("Delete Checklist", `Delete "${name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          removeChecklist(id);
        },
      },
    ]);
  };

  const renderTab = ({
    item: cl,
    isActive: isDragging,
    dragHandleProps,
  }: {
    item: ChecklistMeta;
    index: number;
    isActive: boolean;
    dragHandleProps: object;
  }) => {
    const active = cl.id === activeChecklistId;
    return (
      <View
        {...dragHandleProps}
        style={[
          styles.tab,
          active ? { backgroundColor: "#fff" } : { backgroundColor: "transparent" },
          isDragging && styles.tabDragging,
        ]}
      >
        <TouchableOpacity
          onPress={() => handleTabPress(cl.id)}
          onLongPress={() => handleTabLongPress(cl.id, cl.name)}
          delayLongPress={450}
          style={styles.tabTouchable}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: active ? colors.primary : "rgba(255,255,255,0.75)",
                fontFamily: active ? "Inter_700Bold" : "Inter_400Regular",
                fontWeight: active ? "700" : "400",
              },
            ]}
            numberOfLines={1}
          >
            {cl.name}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.tabBarContainer, { backgroundColor: colors.primary + "cc" }]}>
      <ScrollView
        horizontal
        scrollEnabled={scrollEnabled}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarScroll}
      >
        <SortableList
          data={checklists}
          keyExtractor={(cl) => cl.id}
          direction="horizontal"
          claimOnStart={false}
          itemSize={110}
          onDragStart={() => setScrollEnabled(false)}
          onDragEnd={() => setScrollEnabled(true)}
          onReorder={reorderChecklists}
          renderItem={renderTab}
        />

        {/* Add button */}
        <TouchableOpacity onPress={() => setModal({ kind: "new" })} style={styles.addTabBtn}>
          <Text style={styles.addTabText}>＋</Text>
        </TouchableOpacity>
      </ScrollView>

      <NameModal
        visible={modal !== null}
        initial={modal?.kind === "rename" ? modal.name : ""}
        title={modal?.kind === "rename" ? "Rename Checklist" : "New Checklist"}
        onSave={(name) => {
          if (modal?.kind === "rename") updateChecklistName(modal.id, name);
          else addChecklist(name);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onClose={() => setModal(null)}
      />

      <TabContextMenu
        target={ctxTarget}
        onClose={() => setCtxTarget(null)}
        onEdit={handleCtxEdit}
        onRename={handleCtxRename}
        onDelete={handleCtxDelete}
      />
    </View>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (id: number) => void;
}) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onToggle(task.id);
  };

  const isOptional = !task.required;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        style={[
          styles.taskRow,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            opacity: isOptional && !task.completed ? 0.7 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: task.completed
                ? colors.primary
                : isOptional
                ? colors.border
                : colors.primary + "80",
              backgroundColor: task.completed ? colors.primary : "transparent",
            },
          ]}
        >
          {task.completed && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.taskTextContainer}>
          <Text
            style={[
              styles.taskText,
              {
                color: task.completed
                  ? colors.mutedForeground
                  : isOptional
                  ? colors.mutedForeground
                  : colors.foreground,
                textDecorationLine: task.completed ? "line-through" : "none",
                fontWeight: task.required ? "600" : "400",
                fontFamily: task.required ? "Inter_600SemiBold" : "Inter_400Regular",
              },
            ]}
          >
            {task.text}
          </Text>
          {isOptional && !task.completed && (
            <Text
              style={[
                styles.optionalBadge,
                { color: colors.mutedForeground, borderColor: colors.border },
              ]}
            >
              optional
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Category Header ──────────────────────────────────────────────────────────

function CategoryHeader({
  category,
  completed,
  total,
}: {
  category: string;
  completed: number;
  total: number;
}) {
  const colors = useColors();
  const allDone = completed === total;

  return (
    <View
      style={[
        styles.categoryHeader,
        {
          backgroundColor: allDone ? colors.secondary : colors.muted,
          borderLeftColor: colors.primary,
        },
      ]}
    >
      <Text
        style={[
          styles.categoryTitle,
          { color: allDone ? colors.primary : colors.foreground },
        ]}
      >
        {category}
      </Text>
      <View
        style={[
          styles.categoryBadge,
          { backgroundColor: allDone ? colors.primary : colors.border },
        ]}
      >
        <Text
          style={[
            styles.categoryBadgeText,
            { color: allDone ? "#fff" : colors.mutedForeground },
          ]}
        >
          {completed}/{total}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type ListItem =
  | { type: "header"; category: string; completed: number; total: number }
  | { type: "task"; task: Task };

export default function ChecklistScreen() {
  // Web platform: dashboard is the primary view
  if (Platform.OS === "web") {
    return <Redirect href="/reports" />;
  }

  return <ChecklistScreenNative />;
}

function ChecklistScreenNative() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tasks, sections, toggleTask, resetChecklist, completeChecklist, completionHistory, appConfig } = useChecklist();
  const completeBannerAnim = useRef(new Animated.Value(0)).current;
  const isWeb = Platform.OS === "web";

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const progress = totalTasks > 0 ? completedTasks / totalTasks : 0;

  const requiredTasks = tasks.filter((t) => t.required);
  const allRequiredDone = requiredTasks.length > 0 && requiredTasks.every((t) => t.completed);
  const allDone = allRequiredDone;

  useEffect(() => {
    if (allDone) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(completeBannerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.timing(completeBannerAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [allDone]);

  const handleToggle = useCallback((id: number) => toggleTask(id), [toggleTask]);

  const handleShiftMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "End of Shift",
      "Do you want to save this shift to history before resetting?",
      [
        {
          text: "Save & Reset",
          onPress: () => {
            completeChecklist();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
        {
          text: "Just Reset",
          style: "destructive",
          onPress: () => resetChecklist(),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleCompleteFromBanner = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeChecklist();
  };

  const listData: ListItem[] = [];
  for (const category of sections) {
    const categoryTasks = tasks.filter((t) => t.category === category);
    if (categoryTasks.length === 0) continue;
    const completedInCategory = categoryTasks.filter((t) => t.completed).length;
    listData.push({
      type: "header",
      category,
      completed: completedInCategory,
      total: categoryTasks.length,
    });
    for (const task of categoryTasks) {
      listData.push({ type: "task", task });
    }
  }

  const topPadding = isWeb ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPadding }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              {appConfig.customIconUri ? (
                <Image
                  source={{ uri: appConfig.customIconUri }}
                  style={styles.headerCustomIcon}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.headerIconText}>{appConfig.icon}</Text>
              )}
            </View>
            <Text style={styles.headerTitle}>{appConfig.name}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push("/import-pdf")}
              style={styles.iconAction}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Import from PDF"
            >
              <Text style={styles.iconActionText}>📄</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/reports")}
              style={styles.iconAction}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Shift Reports"
            >
              <Text style={styles.iconActionText}>📊</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/history")}
              style={styles.iconAction}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.iconActionText}>🕐</Text>
              {completionHistory.length > 0 && (
                <View style={styles.historyBadge}>
                  <Text style={styles.historyBadgeText}>
                    {completionHistory.length > 9 ? "9+" : completionHistory.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              style={styles.iconAction}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.iconActionText}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShiftMenu} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressLabel}>
              {completedTasks}/{totalTasks} — {Math.round(progress * 100)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <ChecklistTabBar />

      {/* Empty state */}
      {listData.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
            No tasks yet
          </Text>
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            Tap ⚙️ to add sections and tasks to this checklist.
          </Text>
        </View>
      )}

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={(item) =>
          item.type === "header" ? `cat-${item.category}` : `task-${item.task.id}`
        }
        renderItem={({ item }) => {
          if (item.type === "header") {
            return (
              <CategoryHeader
                category={item.category}
                completed={item.completed}
                total={item.total}
              />
            );
          }
          return <TaskRow task={item.task} onToggle={handleToggle} />;
        }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 16,
        }}
        showsVerticalScrollIndicator={false}
      />

      {/* Completion Footer */}
      {allDone && (
        <Animated.View
          style={[
            styles.completionFooter,
            {
              paddingBottom: (isWeb ? 16 : insets.bottom) + 8,
              opacity: completeBannerAnim,
              transform: [
                {
                  translateY: completeBannerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [80, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[styles.footerMessage, { color: colors.primary }]}>
            All required tasks complete!
          </Text>
          <TouchableOpacity
            onPress={handleCompleteFromBanner}
            style={[styles.footerCompleteBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={styles.footerCompleteBtnText}>Complete</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headerIconText: { fontSize: 20 },
  headerCustomIcon: { width: 36, height: 36, borderRadius: 10 },
  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconAction: {
    width: 36,
    height: 36,
    backgroundColor: "transparent",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionText: { fontSize: 18 },
  historyBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  historyBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#C1121F",
    lineHeight: 12,
  },
  resetButton: {
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  resetButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  progressSection: { gap: 6 },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  progressTrack: {
    height: 6,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 3,
  },

  // Tab bar
  tabBarContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.2)",
  },
  tabBarScroll: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 7,
    alignItems: "center",
  },
  tab: {
    borderRadius: 20,
    maxWidth: 180,
    overflow: "hidden",
  },
  tabTouchable: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tabDragging: {
    opacity: 0.85,
    transform: [{ scale: 1.05 }],
  },
  tabText: {
    fontSize: 13,
  },
  addTabBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  addTabText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 20,
    lineHeight: 24,
  },

  // Category
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
    marginHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    flex: 1,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },

  // Task
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 1,
    flexShrink: 0,
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  taskTextContainer: { flex: 1, gap: 3 },
  taskText: { fontSize: 15, lineHeight: 22 },
  optionalBadge: {
    fontSize: 10,
    fontStyle: "italic",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: "flex-start",
  },

  // Tab context menu
  ctxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  ctxSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: 28,
    paddingHorizontal: 12,
    gap: 4,
  },
  ctxHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  ctxTitle: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  ctxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 10,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ctxRowIcon: { fontSize: 18, width: 24, textAlign: "center" },
  ctxRowText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  ctxCancelBtn: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  ctxCancelText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  emptyHint: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },

  // Completion footer
  completionFooter: {
    paddingHorizontal: 20,
    paddingTop: 14,
    alignItems: "center",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
    backgroundColor: "#fff",
  },
  footerMessage: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  footerCompleteBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  footerCompleteBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },

  // Name modal
  nameModalOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  nameModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  nameModalBox: {
    borderRadius: 16,
    padding: 22,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  nameModalTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  nameModalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  nameModalActions: {
    flexDirection: "row",
    gap: 10,
  },
  nameModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  nameModalBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
