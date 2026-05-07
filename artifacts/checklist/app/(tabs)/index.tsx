import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Task, useChecklist } from "@/context/ChecklistContext";
import { useColors } from "@/hooks/useColors";

type ListItem =
  | { type: "header"; category: string; completed: number; total: number }
  | { type: "task"; task: Task };

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
        testID={`task-${task.id}`}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: task.completed ? colors.primary : isOptional ? colors.border : colors.primary + "80",
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
            <Text style={[styles.optionalBadge, { color: colors.mutedForeground, borderColor: colors.border }]}>
              optional
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

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

export default function ChecklistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tasks, sections, toggleTask, resetChecklist } = useChecklist();
  const completeBannerAnim = useRef(new Animated.Value(0)).current;
  const isWeb = Platform.OS === "web";

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const progress = totalTasks > 0 ? completedTasks / totalTasks : 0;
  const allDone = completedTasks === totalTasks && totalTasks > 0;

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

  const handleToggle = useCallback(
    (id: number) => toggleTask(id),
    [toggleTask]
  );

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetChecklist();
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
      {/* Sticky Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.primary, paddingTop: topPadding },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.headerTitle}>Closing Checklist</Text>
              <Text style={styles.headerSubtitle}>Pizza Hut</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              style={styles.iconAction}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.iconActionText}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
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
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` as any }]}
            />
          </View>
        </View>
      </View>

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
          paddingBottom: (isWeb ? 34 : insets.bottom) + 80,
        }}
        showsVerticalScrollIndicator={false}
      />

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
                {
                  translateY: completeBannerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.bannerLogo}
            resizeMode="contain"
          />
          <Text style={styles.bannerText}>Shift Complete. Great job team!</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
    marginBottom: 14,
    marginTop: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: { width: 40, height: 40 },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconAction: {
    width: 36,
    height: 36,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionText: {
    fontSize: 16,
  },
  resetButton: {
    backgroundColor: "rgba(0,0,0,0.2)",
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
  taskTextContainer: {
    flex: 1,
    gap: 3,
  },
  taskText: {
    fontSize: 15,
    lineHeight: 22,
  },
  optionalBadge: {
    fontSize: 10,
    fontStyle: "italic",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: "flex-start",
  },
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
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  bannerLogo: { width: 22, height: 22 },
  bannerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
