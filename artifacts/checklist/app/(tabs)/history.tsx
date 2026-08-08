import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Checkbox, Divider, IconButton, ProgressBar } from "react-native-paper";

import { Ionicons } from "@expo/vector-icons";

import { ExportModal } from "@/components/ExportModal";
import { CompletedChecklist, useChecklist } from "@/context/ChecklistContext";
import shape from "@/constants/shape";
import { typeStyle } from "@/constants/typography";
import { useMd } from "@/theme/useMd";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = days[d.getDay()];
  const month = months[d.getMonth()];
  const date = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day}, ${month} ${date}, ${year}  •  ${hours}:${minutes} ${ampm}`;
}

function formatDuration(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Entry Card ───────────────────────────────────────────────────────────────

function HistoryCard({ entry }: { entry: CompletedChecklist }) {
  const md = useMd();
  const { deleteHistoryEntry } = useChecklist();
  const [expanded, setExpanded] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);

  const total = entry.tasks.length;
  const done = entry.tasks.filter((t) => t.completed).length;
  const requiredTotal = entry.tasks.filter((t) => t.required).length;
  const requiredDone = entry.tasks.filter((t) => t.required && t.completed).length;
  const progress = total > 0 ? done / total : 0;
  const allRequired = requiredTotal === requiredDone;

  const handleDelete = () => {
    Alert.alert(
      "Delete Record",
      `Remove this history entry for "${entry.checklistName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteHistoryEntry(entry.id),
        },
      ]
    );
  };

  return (
    <Card mode="elevated" style={[styles.card, { backgroundColor: md.surfaceContainerHigh, borderRadius: shape.lg }]}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={[styles.checklistBadge, { backgroundColor: md.primaryContainer, borderRadius: shape.sm }]}>
          <Text style={[typeStyle("labelLarge"), { color: md.onPrimaryContainer }]} numberOfLines={1}>
            {entry.checklistName}
          </Text>
        </View>
        <View style={styles.cardHeaderRight}>
          <Text style={[typeStyle("labelMedium"), { color: md.onSurfaceVariant }]}>
            {formatDuration(entry.completedAt)}
          </Text>
          <IconButton
            icon={() => <Ionicons name="share-outline" size={18} color={md.onSurfaceVariant} />}
            size={18}
            onPress={() => setExportVisible(true)}
            accessibilityLabel="Export shift"
            style={styles.cardActionBtn}
          />
          <IconButton
            icon={() => <Ionicons name="trash-outline" size={18} color={md.error} />}
            size={18}
            onPress={handleDelete}
            accessibilityLabel="Delete shift record"
            style={styles.cardActionBtn}
          />
        </View>
      </View>

      <ExportModal
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        data={{
          checklistName: entry.checklistName,
          sections: entry.sections,
          tasks: entry.tasks,
          completedAt: entry.completedAt,
        }}
      />

      {/* Date */}
      <Text style={[typeStyle("bodySmall"), styles.dateText, { color: md.onSurfaceVariant }]}>
        {formatDate(entry.completedAt)}
      </Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statBadge, { backgroundColor: md.surfaceContainerHighest, borderRadius: shape.sm }]}>
          <Text style={[typeStyle("titleMedium"), { color: md.onSurface }]}>{done}/{total}</Text>
          <Text style={[typeStyle("labelSmall"), styles.statLabel, { color: md.onSurfaceVariant }]}>tasks done</Text>
        </View>
        <View
          style={[
            styles.statBadge,
            { borderRadius: shape.sm, backgroundColor: allRequired ? md.successContainer : md.surfaceContainerHighest },
          ]}
        >
          <Text style={[typeStyle("titleMedium"), { color: allRequired ? md.onSuccessContainer : md.onSurface }]}>
            {requiredDone}/{requiredTotal}
          </Text>
          <Text style={[typeStyle("labelSmall"), styles.statLabel, { color: allRequired ? md.onSuccessContainer : md.onSurfaceVariant }]}>
            required
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <ProgressBar
          progress={progress}
          color={progress === 1 ? md.success : md.primary}
          style={{ backgroundColor: md.surfaceContainerHighest, borderRadius: shape.full, height: 4 }}
        />
      </View>

      {/* Expand / collapse */}
      <Divider style={{ backgroundColor: md.outlineVariant, marginTop: 8 }} />
      <Button
        mode="text"
        onPress={() => setExpanded((e) => !e)}
        icon={expanded ? "chevron-up" : "chevron-down"}
        contentStyle={{ flexDirection: "row-reverse" }}
        style={styles.expandBtn}
      >
        {expanded ? "Hide Tasks" : "Show Tasks"}
      </Button>

      {/* Task detail */}
      {expanded && (
        <View>
          <Divider style={{ backgroundColor: md.outlineVariant }} />
          {entry.sections.map((section) => {
            const sectionTasks = entry.tasks.filter((t) => t.category === section);
            if (sectionTasks.length === 0) return null;
            const sectionDone = sectionTasks.filter((t) => t.completed).length;
            return (
              <View key={section}>
                <View
                  style={[
                    styles.sectionHeader,
                    { backgroundColor: md.surfaceContainerHighest, borderLeftColor: md.primary },
                  ]}
                >
                  <Text style={[typeStyle("labelMedium"), styles.sectionTitle, { color: md.onSurface }]} numberOfLines={1}>
                    {section}
                  </Text>
                  <Text style={[typeStyle("labelSmall"), { color: md.onSurfaceVariant }]}>
                    {sectionDone}/{sectionTasks.length}
                  </Text>
                </View>
                {sectionTasks.map((task) => (
                  <View key={task.id}>
                    <View style={styles.taskRow}>
                      <Checkbox
                        status={task.completed ? "checked" : "unchecked"}
                        disabled
                        color={md.primary}
                        uncheckedColor={md.onSurfaceVariant}
                      />
                      <Text
                        style={[
                          typeStyle("bodyMedium"),
                          {
                            color: task.completed ? md.onSurfaceVariant : md.onSurface,
                            textDecorationLine: task.completed ? "line-through" : "none",
                            fontFamily:
                              task.required && !task.completed ? "Inter_500Medium" : "Inter_400Regular",
                            opacity: task.completed ? 0.6 : 1,
                            flex: 1,
                          },
                        ]}
                      >
                        {task.text}
                      </Text>
                      {!task.required && (
                        <Text
                          style={[
                            styles.optBadge,
                            typeStyle("labelSmall"),
                            { color: md.onSurfaceVariant, borderColor: md.outlineVariant, borderRadius: shape.xs },
                          ]}
                        >
                          opt
                        </Text>
                      )}
                    </View>
                    <Divider style={{ backgroundColor: md.outlineVariant, marginLeft: 14 }} />
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

// ─── History Screen ───────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const md = useMd();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completionHistory, clearHistory } = useChecklist();
  const isWeb = Platform.OS === "web";
  const topPadding = isWeb ? 67 : insets.top;

  const handleClearAll = () => {
    Alert.alert("Clear History", "Delete all shift history records? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All", style: "destructive", onPress: clearHistory },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: md.surface }]}>
      {/* Top app bar */}
      <View style={[styles.header, { backgroundColor: md.surface, paddingTop: topPadding }]}>
        <View style={styles.headerTop}>
          {/* No back affordance — this is a tab, there is nothing to go back to. */}
          <View style={styles.headerLeft}>
            <Text style={[typeStyle("headlineMedium"), styles.headerTitle, { color: md.onSurface }]} numberOfLines={1}>
              Shift History
            </Text>
          </View>
          {completionHistory.length > 0 && (
            <Button mode="text" textColor={md.error} onPress={handleClearAll}>
              Clear All
            </Button>
          )}
        </View>
      </View>

      {completionHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="clipboard-outline" size={48} color={md.onSurfaceVariant} />
          <Text style={[typeStyle("titleMedium"), { color: md.onSurface }]}>No history yet</Text>
          <Text style={[typeStyle("bodyMedium"), styles.emptyHint, { color: md.onSurfaceVariant }]}>
            Complete a shift from the checklist screen to save a record here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={completionHistory}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: 12,
            paddingBottom: (isWeb ? 34 : insets.bottom) + 40,
            gap: 12,
          }}
          renderItem={({ item }) => <HistoryCard entry={item} />}
          ListHeaderComponent={
            <Text style={[typeStyle("labelMedium"), styles.recordCount, { color: md.onSurfaceVariant }]}>
              {completionHistory.length} shift{completionHistory.length !== 1 ? "s" : ""} recorded
            </Text>
          }
        />
      )}
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
    paddingHorizontal: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
    marginRight: 8,
  },
  headerIconBtn: { margin: 0 },
  headerTitle: { flexShrink: 1 },

  recordCount: { marginBottom: 4, paddingHorizontal: 2 },

  // Card
  card: {
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  checklistBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 1,
  },
  cardActionBtn: { margin: 0 },
  dateText: { paddingHorizontal: 14, paddingBottom: 10 },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  statBadge: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statLabel: { textTransform: "uppercase", letterSpacing: 0.5 },

  // Progress
  progressWrap: {
    marginHorizontal: 14,
    marginBottom: 2,
  },

  // Expand
  expandBtn: {
    marginVertical: 2,
  },

  // Task list
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderLeftWidth: 3,
  },
  sectionTitle: { textTransform: "uppercase", letterSpacing: 0.8, flex: 1 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 4,
  },
  optBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginTop: 3,
    fontStyle: "italic",
  },

  // Empty
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyHint: { textAlign: "center" },
});
