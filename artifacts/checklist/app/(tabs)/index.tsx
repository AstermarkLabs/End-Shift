import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  FAB,
  IconButton,
  Portal,
  ProgressBar,
  TextInput as PaperTextInput,
} from "react-native-paper";

import { Ionicons } from "@expo/vector-icons";

import { ExportModal } from "@/components/ExportModal";
import { SortableList } from "@/components/SortableList";
import { M3BottomSheet, SheetRow } from "@/components/ui/M3BottomSheet";
import { useAuth } from "@/context/AuthContext";
import { ChecklistMeta, Task, useChecklist } from "@/context/ChecklistContext";
import shape from "@/constants/shape";
import { typeStyle } from "@/constants/typography";
import { useMd } from "@/theme/useMd";

// ─── Name dialog (for creating / renaming checklists) ────────────────────────
// The design's NameDialog (m3/App.jsx): M3 basic dialog on
// surface-container-high, xl corners, text field, text + filled actions.

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
  const md = useMd();
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
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onClose}
        style={{ backgroundColor: md.surfaceContainerHigh, borderRadius: shape.xl }}
      >
        <Dialog.Title style={[typeStyle("headlineSmall"), { color: md.onSurface }]}>
          {title}
        </Dialog.Title>
        <Dialog.Content>
          <PaperTextInput
            mode="outlined"
            label="Checklist name"
            value={value}
            onChangeText={setValue}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
            outlineStyle={{ borderRadius: shape.xs }}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button mode="text" onPress={onClose}>
            Cancel
          </Button>
          <Button mode="contained" onPress={handleSave} disabled={!value.trim()}>
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

// ─── Overflow menu (modal bottom sheet) ──────────────────────────────────────

function HamburgerMenu({
  visible,
  onClose,
  onSettings,
  onHistory,
  onReset,
  onSwitchAccount,
  onSignOut,
  historyCount,
  isNoAuthMode,
  isSignedIn,
}: {
  visible: boolean;
  onClose: () => void;
  onSettings: () => void;
  onHistory: () => void;
  onReset: () => void;
  onSwitchAccount: () => void;
  onSignOut: () => void;
  historyCount: number;
  isNoAuthMode: boolean;
  isSignedIn: boolean;
}) {
  return (
    <M3BottomSheet visible={visible} onDismiss={onClose}>
      <SheetRow icon="settings-outline" label="Settings" onPress={onSettings} />
      <SheetRow icon="time-outline" label="History" onPress={onHistory} badge={historyCount} />
      <SheetRow icon="refresh-outline" label="Reset Shift" destructive onPress={onReset} />
      {isNoAuthMode && (
        <SheetRow icon="swap-horizontal-outline" label="Switch Account" onPress={onSwitchAccount} />
      )}
      {isSignedIn && (
        <SheetRow icon="log-out-outline" label="Sign Out" destructive onPress={onSignOut} />
      )}
    </M3BottomSheet>
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
  // The design's checklist menu sheet (m3/App.jsx): titled with the checklist
  // name, then edit / rename / delete rows.
  return (
    <M3BottomSheet visible={target !== null} onDismiss={onClose} title={target?.name}>
      <SheetRow icon="create-outline" label="Edit Tasks & Sections" onPress={onEdit} />
      <SheetRow icon="text-outline" label="Rename" onPress={onRename} />
      <SheetRow icon="trash-outline" label="Delete" destructive onPress={onDelete} />
    </M3BottomSheet>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function ChecklistTabBar() {
  const md = useMd();
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
      <View {...dragHandleProps} style={[styles.tab, isDragging && styles.tabDragging]}>
        <Chip
          selected={active}
          showSelectedCheck={active}
          onPress={() => handleTabPress(cl.id)}
          onLongPress={() => handleTabLongPress(cl.id, cl.name)}
          delayLongPress={450}
          mode="flat"
          style={[
            styles.tabChip,
            {
              borderRadius: shape.sm,
              backgroundColor: active ? md.secondaryContainer : "transparent",
              borderColor: md.outlineVariant,
              borderWidth: active ? 0 : 1,
            },
          ]}
          textStyle={[
            typeStyle("labelLarge"),
            {
              color: active ? md.onSecondaryContainer : md.onSurfaceVariant,
              fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
            },
          ]}
        >
          {cl.name}
        </Chip>
      </View>
    );
  };

  return (
    <View style={[styles.tabBarContainer, { backgroundColor: md.surface, borderBottomColor: md.outlineVariant }]}>
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

        <IconButton
          icon="plus"
          mode="outlined"
          size={18}
          iconColor={md.primary}
          onPress={() => setModal({ kind: "new" })}
          style={[styles.addTabBtn, { borderRadius: shape.sm, borderColor: md.outlineVariant }]}
        />
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
  const md = useMd();
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
            backgroundColor: md.surface,
            opacity: isOptional && !task.completed ? 0.78 : 1,
          },
        ]}
      >
        <Checkbox
          status={task.completed ? "checked" : "unchecked"}
          onPress={handlePress}
          color={md.primary}
          uncheckedColor={md.onSurfaceVariant}
        />
        <View style={styles.taskTextContainer}>
          <Text
            style={[
              typeStyle("bodyLarge"),
              {
                color: task.completed ? md.onSurfaceVariant : md.onSurface,
                textDecorationLine: task.completed ? "line-through" : "none",
                // Required tasks read heavier. Weight rides on the family — never
                // set fontWeight alongside it.
                fontFamily: task.required ? "Inter_500Medium" : "Inter_400Regular",
              },
            ]}
          >
            {task.text}
          </Text>
          {isOptional && !task.completed && (
            <View
              style={[
                styles.optionalBadge,
                { backgroundColor: md.surfaceContainerHighest, borderRadius: shape.xs },
              ]}
            >
              <Text style={[typeStyle("labelSmall"), { color: md.onSurfaceVariant, fontStyle: "italic" }]}>
                optional
              </Text>
            </View>
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
  const md = useMd();
  const allDone = completed === total;

  // Design (m3/checklist.jsx): no filled banner — an uppercase titleSmall label,
  // a count pill that flips to `primary` when the section is done, and a check.
  return (
    <View style={styles.categoryHeader}>
      <Text
        style={[
          typeStyle("titleSmall"),
          styles.categoryTitle,
          { color: allDone ? md.primary : md.onSurfaceVariant },
        ]}
      >
        {category}
      </Text>
      <View
        style={[
          styles.categoryBadge,
          {
            borderRadius: shape.sm,
            backgroundColor: allDone ? md.primary : md.surfaceContainerHighest,
          },
        ]}
      >
        <Text style={[typeStyle("labelSmall"), { color: allDone ? md.onPrimary : md.onSurfaceVariant }]}>
          {completed}/{total}
        </Text>
      </View>
      {allDone && <Ionicons name="checkmark" size={14} color={md.primary} />}
    </View>
  );
}

// ─── Subsection Header ────────────────────────────────────────────────────────

function SubsectionHeader({ subsection }: { subsection: string }) {
  const md = useMd();
  return (
    <View style={[styles.subsectionHeader, { borderLeftColor: md.outlineVariant }]}>
      <Text style={[typeStyle("labelMedium"), styles.subsectionTitle, { color: md.onSurfaceVariant }]}>
        {subsection}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type ListItem =
  | { type: "header"; category: string; completed: number; total: number }
  | { type: "subheader"; subsection: string }
  | { type: "task"; task: Task };

export default function ChecklistScreen() {
  // Web platform: dashboard is the primary view
  if (Platform.OS === "web") {
    return <Redirect href="/reports" />;
  }

  return <ChecklistScreenNative />;
}

function ChecklistScreenNative() {
  const md = useMd();
  const insets = useSafeAreaInsets();
  const { profile, signOut, noAuthMode } = useAuth();
  const router = useRouter();
  const { tasks, sections, toggleTask, resetChecklist, completeChecklist, completionHistory, appConfig } = useChecklist();
  const completeBannerAnim = useRef(new Animated.Value(0)).current;
  const isWeb = Platform.OS === "web";
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);

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
    let lastSubsection: string | null | undefined = undefined;
    for (const task of categoryTasks) {
      const sub = task.subsection ?? null;
      if (sub !== lastSubsection) {
        if (sub) listData.push({ type: "subheader", subsection: sub });
        lastSubsection = sub;
      }
      listData.push({ type: "task", task });
    }
  }

  const topPadding = isWeb ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: md.surface }]}>
      {/* Top app bar */}
      <View style={[styles.header, { backgroundColor: md.surface, paddingTop: topPadding }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIconWrap, { borderRadius: shape.sm, backgroundColor: md.primaryContainer }]}>
              {appConfig.customIconUri ? (
                <Image
                  source={{ uri: appConfig.customIconUri }}
                  style={[styles.headerCustomIcon, { borderRadius: shape.sm }]}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.headerIconText}>{appConfig.icon}</Text>
              )}
            </View>
            <Text
              style={[typeStyle("titleLarge"), styles.headerTitle, { color: md.onSurface }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {appConfig.name}
            </Text>
          </View>
          {/* Reports moved to the tab bar — no icon button for it here. */}
          <View style={styles.headerActions}>
            <IconButton
              icon={() => <Ionicons name="download-outline" size={20} color={md.onSurfaceVariant} />}
              onPress={() => router.push("/import-checklist")}
              accessibilityLabel="Import Checklist"
            />
            <IconButton
              icon={() => <Ionicons name="share-outline" size={20} color={md.onSurfaceVariant} />}
              onPress={() => setExportVisible(true)}
              accessibilityLabel="Export Checklist"
            />
            <IconButton
              icon={() => <Ionicons name="ellipsis-vertical" size={20} color={md.onSurfaceVariant} />}
              onPress={() => setHamburgerOpen(true)}
              accessibilityLabel="More options"
            />
          </View>
        </View>
      </View>

      {/* Checklist selector chips */}
      <ChecklistTabBar />

      {/* Progress card */}
      <View style={[styles.progressCardWrap, { backgroundColor: md.surface }]}>
        <View style={[styles.progressCard, { borderRadius: shape.lg, backgroundColor: md.surfaceContainerHigh }]}>
          <View style={styles.progressLabelRow}>
            <Text style={[typeStyle("titleMedium"), { color: md.onSurface }]}>Progress</Text>
            <Text style={[typeStyle("titleMedium"), { color: md.primary }]}>
              {completedTasks}/{totalTasks} · {Math.round(progress * 100)}%
            </Text>
          </View>
          <ProgressBar
            progress={progress}
            color={md.primary}
            style={{ backgroundColor: md.surfaceContainerHighest, borderRadius: shape.full, height: 6 }}
          />
        </View>
      </View>

      {/* Empty state */}
      {listData.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="clipboard-outline" size={40} color={md.onSurfaceVariant} />
          <Text style={[typeStyle("titleMedium"), { color: md.onSurface }]}>No tasks yet</Text>
          <Text style={[typeStyle("bodyMedium"), styles.emptyHint, { color: md.onSurfaceVariant }]}>
            Add sections and tasks to this checklist, then start your first shift.
          </Text>
          <Button
            mode="contained-tonal"
            icon={() => <Ionicons name="create-outline" size={18} color={md.onSecondaryContainer} />}
            onPress={() => router.push("/checklist-settings")}
            style={{ marginTop: 8 }}
          >
            Edit tasks &amp; sections
          </Button>
        </View>
      )}

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={(item) => {
          if (item.type === "header") return `cat-${item.category}`;
          if (item.type === "subheader") return `sub-${item.subsection}`;
          return `task-${item.task.id}`;
        }}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return <CategoryHeader category={item.category} completed={item.completed} total={item.total} />;
          }
          if (item.type === "subheader") {
            return <SubsectionHeader subsection={item.subsection} />;
          }
          return <TaskRow task={item.task} onToggle={handleToggle} />;
        }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 16,
        }}
        showsVerticalScrollIndicator={false}
      />

      <HamburgerMenu
        visible={hamburgerOpen}
        onClose={() => setHamburgerOpen(false)}
        onSettings={() => { setHamburgerOpen(false); router.navigate("/settings"); }}
        onHistory={() => { setHamburgerOpen(false); router.navigate("/history"); }}
        onReset={() => { setHamburgerOpen(false); handleShiftMenu(); }}
        onSwitchAccount={() => { setHamburgerOpen(false); router.replace("/login"); }}
        onSignOut={() => {
          setHamburgerOpen(false);
          Alert.alert("Sign Out", "Sign out of your account?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign Out", style: "destructive", onPress: () => { void signOut(); } },
          ]);
        }}
        historyCount={completionHistory.length}
        isNoAuthMode={noAuthMode}
        isSignedIn={!!profile}
      />

      <ExportModal
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        data={{
          checklistName: appConfig.name,
          sections,
          tasks,
        }}
      />

      {/* Completion FAB */}
      <Animated.View
        pointerEvents={allDone ? "auto" : "none"}
        style={[
          styles.completionFabWrap,
          {
            bottom: (isWeb ? 16 : insets.bottom) + 16,
            opacity: completeBannerAnim,
            transform: [{ scale: completeBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          },
        ]}
      >
        <FAB
          icon="check"
          label="Complete shift"
          onPress={handleCompleteFromBanner}
          color={md.onPrimary}
          style={{ backgroundColor: md.primary }}
        />
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 8,
    paddingBottom: 4,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    marginTop: 4,
    paddingHorizontal: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
    marginRight: 8,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headerIconText: { fontSize: 20 },
  headerCustomIcon: { width: 36, height: 36 },
  headerTitle: { flexShrink: 1 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  progressCardWrap: { paddingHorizontal: 12, paddingBottom: 12 },
  progressCard: { padding: 16, gap: 10 },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },

  // Tab bar
  tabBarContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBarScroll: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 7,
    alignItems: "center",
  },
  tab: {
    maxWidth: 180,
  },
  tabChip: {
    borderWidth: 1,
  },
  tabDragging: {
    opacity: 0.85,
    transform: [{ scale: 1.05 }],
  },
  addTabBtn: {
    margin: 0,
  },

  // Category
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },
  subsectionHeader: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
    paddingLeft: 10,
    paddingVertical: 4,
    borderLeftWidth: 2,
  },
  subsectionTitle: { textTransform: "uppercase", letterSpacing: 0.4 },
  categoryTitle: { textTransform: "uppercase", letterSpacing: 0.8 },
  categoryBadge: {
    height: 20,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  // Task
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
  },
  taskTextContainer: { flex: 1, gap: 3 },
  optionalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignSelf: "flex-start",
  },

  // Tab context menu

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyHint: { textAlign: "center" },

  // Completion FAB
  completionFabWrap: {
    position: "absolute",
    right: 16,
    zIndex: 30,
  },

});
