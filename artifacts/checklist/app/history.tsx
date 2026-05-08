import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CompletedChecklist, useChecklist } from "@/context/ChecklistContext";
import { useColors } from "@/hooks/useColors";

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
  const colors = useColors();
  const { deleteHistoryEntry } = useChecklist();
  const [expanded, setExpanded] = useState(false);

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
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={[styles.checklistBadge, { backgroundColor: colors.primary + "18" }]}>
          <Text style={[styles.checklistBadgeText, { color: colors.primary }]} numberOfLines={1}>
            {entry.checklistName}
          </Text>
        </View>
        <View style={styles.cardHeaderRight}>
          <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
            {formatDuration(entry.completedAt)}
          </Text>
          <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date */}
      <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
        {formatDate(entry.completedAt)}
      </Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBadge}>
          <Text style={[styles.statNum, { color: colors.foreground }]}>{done}/{total}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>tasks done</Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: allRequired ? colors.primary + "15" : colors.muted }]}>
          <Text style={[styles.statNum, { color: allRequired ? colors.primary : colors.foreground }]}>
            {requiredDone}/{requiredTotal}
          </Text>
          <Text style={[styles.statLabel, { color: allRequired ? colors.primary : colors.mutedForeground }]}>
            required
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress * 100}%` as any, backgroundColor: progress === 1 ? colors.primary : colors.primary + "80" },
          ]}
        />
      </View>

      {/* Expand / collapse */}
      <TouchableOpacity
        style={[styles.expandBtn, { borderTopColor: colors.border }]}
        onPress={() => setExpanded((e) => !e)}
      >
        <Text style={[styles.expandBtnText, { color: colors.primary }]}>
          {expanded ? "Hide Tasks ▲" : "Show Tasks ▼"}
        </Text>
      </TouchableOpacity>

      {/* Task detail */}
      {expanded && (
        <View style={[styles.taskList, { borderTopColor: colors.border }]}>
          {entry.sections.map((section) => {
            const sectionTasks = entry.tasks.filter((t) => t.category === section);
            if (sectionTasks.length === 0) return null;
            const sectionDone = sectionTasks.filter((t) => t.completed).length;
            return (
              <View key={section}>
                <View style={[styles.sectionHeader, { backgroundColor: colors.muted, borderLeftColor: colors.primary }]}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {section}
                  </Text>
                  <Text style={[styles.sectionBadge, { color: colors.mutedForeground }]}>
                    {sectionDone}/{sectionTasks.length}
                  </Text>
                </View>
                {sectionTasks.map((task) => (
                  <View key={task.id} style={[styles.taskRow, { borderBottomColor: colors.border }]}>
                    <View
                      style={[
                        styles.taskIcon,
                        {
                          backgroundColor: task.completed ? colors.primary : "transparent",
                          borderColor: task.completed ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      {task.completed && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text
                      style={[
                        styles.taskText,
                        {
                          color: task.completed ? colors.mutedForeground : colors.foreground,
                          textDecorationLine: task.completed ? "line-through" : "none",
                          fontWeight: task.required && !task.completed ? "600" : "400",
                          opacity: task.completed ? 0.6 : 1,
                          flex: 1,
                        },
                      ]}
                    >
                      {task.text}
                    </Text>
                    {!task.required && (
                      <Text style={[styles.optBadge, { color: colors.mutedForeground, borderColor: colors.border }]}>
                        opt
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── History Screen ───────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const colors = useColors();
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPadding }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shift History</Text>
        {completionHistory.length > 0 ? (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {completionHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No history yet</Text>
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
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
            <Text style={[styles.recordCount, { color: colors.mutedForeground }]}>
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
  backBtn: { width: 70 },
  backBtnText: { color: "#fff", fontSize: 17, fontWeight: "500" },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: "Inter_700Bold",
  },
  clearBtn: { width: 70, alignItems: "flex-end" },
  clearBtnText: { color: "rgba(255,255,255,0.85)", fontSize: 14 },

  recordCount: {
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 4,
    paddingHorizontal: 2,
  },

  // Card
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
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
    gap: 10,
  },
  checklistBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 1,
  },
  checklistBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  timeAgo: { fontSize: 12 },
  deleteIcon: { fontSize: 16 },
  dateText: {
    fontSize: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
    lineHeight: 16,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  statNum: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11 },

  // Progress
  progressTrack: {
    height: 4,
    marginHorizontal: 14,
    marginBottom: 2,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },

  // Expand
  expandBtn: {
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  expandBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // Task list
  taskList: { borderTopWidth: StyleSheet.hairlineWidth },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderLeftWidth: 3,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    flex: 1,
  },
  sectionBadge: { fontSize: 11 },
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  taskIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  checkmark: { color: "#fff", fontSize: 10, fontWeight: "700", lineHeight: 12 },
  taskText: { fontSize: 13, lineHeight: 18 },
  optBadge: {
    fontSize: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 3,
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
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  emptyHint: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
