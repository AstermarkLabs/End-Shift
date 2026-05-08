import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { Task, useChecklist } from "@/context/ChecklistContext";
import { useColors } from "@/hooks/useColors";

// ─── Name Modal ───────────────────────────────────────────────────────────────

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
          <Text style={[styles.nameModalTitle, { color: colors.foreground }]}>{title}</Text>
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
              { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border },
            ]}
          />
          <View style={styles.nameModalActions}>
            <TouchableOpacity style={[styles.nameModalBtn, { backgroundColor: colors.muted }]} onPress={onClose}>
              <Text style={[styles.nameModalBtnText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nameModalBtn, { backgroundColor: value.trim() ? colors.primary : colors.border, flex: 1.4 }]}
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

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function ChecklistTabBar() {
  const colors = useColors();
  const { checklists, activeChecklistId, setActiveChecklistId, addChecklist, updateChecklistName, removeChecklist } = useChecklist();
  const [modal, setModal] = useState<{ kind: "new" } | { kind: "rename"; id: string; name: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const handleTabPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveChecklistId(id);
  };

  const handleTabLongPress = (id: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(name, undefined, [
      { text: "Rename", onPress: () => setModal({ kind: "rename", id, name }) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
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
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={[styles.tabBarContainer, { backgroundColor: "#A0102A" }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarScroll}
      >
        {checklists.map((cl) => {
          const active = cl.id === activeChecklistId;
          return (
            <TouchableOpacity
              key={cl.id}
              onPress={() => handleTabPress(cl.id)}
              onLongPress={() => handleTabLongPress(cl.id, cl.name)}
              delayLongPress={400}
              style={[styles.tab, active ? { backgroundColor: "#fff" } : { backgroundColor: "transparent" }]}
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
          );
        })}
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
    </View>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
  isActive,
  dragHandleProps,
}: {
  task: Task;
  onToggle: (id: number) => void;
  isActive: boolean;
  dragHandleProps: object;
}) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const isOptional = !task.required;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onToggle(task.id);
  };

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        isActive && styles.taskRowActive,
      ]}
    >
      <Pressable
        onPress={handlePress}
        style={[
          styles.taskRow,
          {
            backgroundColor: isActive ? colors.accent : colors.card,
            borderBottomColor: colors.border,
            opacity: isOptional && !task.completed ? 0.7 : 1,
          },
        ]}
      >
        {/* Checkbox */}
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

        {/* Text */}
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
              style={[styles.optionalBadge, { color: colors.mutedForeground, borderColor: colors.border }]}
            >
              optional
            </Text>
          )}
        </View>

        {/* Drag handle */}
        <View
          {...dragHandleProps}
          style={styles.dragHandle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={[styles.dragLine, { backgroundColor: colors.mutedForeground }]} />
          <View style={[styles.dragLine, { backgroundColor: colors.mutedForeground }]} />
          <View style={[styles.dragLine, { backgroundColor: colors.mutedForeground }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Category Header ──────────────────────────────────────────────────────────

function CategoryHeader({ category, completed, total }: { category: string; completed: number; total: number }) {
  const colors = useColors();
  const allDone = completed === total;
  return (
    <View
      style={[
        styles.categoryHeader,
        { backgroundColor: allDone ? colors.secondary : colors.muted, borderLeftColor: colors.primary },
      ]}
    >
      <Text style={[styles.categoryTitle, { color: allDone ? colors.primary : colors.foreground }]}>
        {category}
      </Text>
      <View style={[styles.categoryBadge, { backgroundColor: allDone ? colors.primary : colors.border }]}>
        <Text style={[styles.categoryBadgeText, { color: allDone ? "#fff" : colors.mutedForeground }]}>
          {completed}/{total}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChecklistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tasks, sections, toggleTask, resetChecklist, reorderTasksInSection } = useChecklist();
  const completeBannerAnim = useRef(new Animated.Value(0)).current;
  const isWeb = Platform.OS === "web";
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const progress = totalTasks > 0 ? completedTasks / totalTasks : 0;
  const allDone = completedTasks === totalTasks && totalTasks > 0;

  useEffect(() => {
    if (allDone) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(completeBannerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }).start();
    } else {
      Animated.timing(completeBannerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [allDone]);

  const handleToggle = useCallback((id: number) => toggleTask(id), [toggleTask]);

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetChecklist();
  };

  const topPadding = isWeb ? 67 : insets.top;

  const hasTasks = tasks.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPadding }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Image source={require("../../assets/images/logo.png")} style={styles.logo} resizeMode="contain" />
            <View>
              <Text style={styles.headerTitle}>Pizza Hut</Text>
              <Text style={styles.headerSubtitle}>Shift Checklists</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push("/settings")} style={styles.iconAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.iconActionText}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressLabel}>{completedTasks}/{totalTasks} — {Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <ChecklistTabBar />

      {/* Empty state */}
      {!hasTasks && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>No tasks yet</Text>
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            Tap ⚙️ to add sections and tasks to this checklist.
          </Text>
        </View>
      )}

      {/* Sections + sortable tasks */}
      {hasTasks && (
        <ScrollView
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: (isWeb ? 34 : insets.bottom) + 80 }}
        >
          {sections.map((section) => {
            const sectionTasks = tasks.filter((t) => t.category === section);
            if (sectionTasks.length === 0) return null;
            const completedCount = sectionTasks.filter((t) => t.completed).length;
            return (
              <View key={section}>
                <CategoryHeader category={section} completed={completedCount} total={sectionTasks.length} />
                <SortableList
                  data={sectionTasks}
                  keyExtractor={(t) => String(t.id)}
                  rowHeight={52}
                  onDragStart={() => setScrollEnabled(false)}
                  onDragEnd={() => setScrollEnabled(true)}
                  onReorder={(newData) => reorderTasksInSection(section, newData)}
                  renderItem={({ item, isActive, dragHandleProps }) => (
                    <TaskRow
                      task={item}
                      onToggle={handleToggle}
                      isActive={isActive}
                      dragHandleProps={dragHandleProps}
                    />
                  )}
                />
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Completion Banner */}
      {allDone && (
        <Animated.View
          style={[
            styles.completionBanner,
            {
              backgroundColor: colors.primary,
              bottom: (isWeb ? 34 : insets.bottom) + 20,
              opacity: completeBannerAnim,
              transform: [
                { translateY: completeBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
              ],
            },
          ]}
        >
          <Image source={require("../../assets/images/logo.png")} style={styles.bannerLogo} resizeMode="contain" />
          <Text style={styles.bannerText}>Shift Complete. Great job team!</Text>
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 38, height: 38 },
  headerTitle: { fontSize: 19, fontWeight: "700", color: "#FFFFFF", fontFamily: "Inter_700Bold" },
  headerSubtitle: { fontSize: 11, color: "rgba(255,255,255,0.72)", fontFamily: "Inter_400Regular", marginTop: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconAction: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  iconActionText: { fontSize: 18 },
  resetButton: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  resetButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  progressSection: { gap: 6 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_500Medium" },
  progressTrack: { height: 6, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#FFFFFF", borderRadius: 3 },

  // Tab bar
  tabBarContainer: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.2)" },
  tabBarScroll: { paddingHorizontal: 12, paddingVertical: 9, gap: 7, alignItems: "center" },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, maxWidth: 180 },
  tabText: { fontSize: 13 },
  addTabBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  addTabText: { color: "rgba(255,255,255,0.75)", fontSize: 20, lineHeight: 24 },

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
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  categoryBadgeText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // Task
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 13,
    marginHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  taskRowActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 100,
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
  checkmark: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", lineHeight: 16 },
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

  // Drag handle (on task rows)
  dragHandle: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginLeft: 6,
    marginTop: 1,
    opacity: 0.35,
    cursor: "grab" as any,
  },
  dragLine: { width: 14, height: 2, borderRadius: 1 },

  // Empty
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  emptyHint: { fontSize: 14, textAlign: "center", lineHeight: 20, fontFamily: "Inter_400Regular" },

  // Completion banner
  completionBanner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  bannerLogo: { width: 24, height: 24 },
  bannerText: { color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },

  // Name modal
  nameModalOverlay: { flex: 1, justifyContent: "center" },
  nameModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  nameModalBox: { margin: 28, borderRadius: 18, padding: 22, gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  nameModalTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  nameModalInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  nameModalActions: { flexDirection: "row", gap: 10 },
  nameModalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  nameModalBtnText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
