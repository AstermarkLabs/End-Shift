import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

import { useColors } from "@/hooks/useColors";

interface Task {
  id: number;
  category: string;
  text: string;
  completed: boolean;
}

const INITIAL_TASKS: Task[] = [
  { id: 1, category: "1 Hour Before Closing", text: "Begin the daily count sheet and complete inventory counts.", completed: false },
  { id: 2, category: "1 Hour Before Closing", text: "Ensure all required labels are completed; pull any labels that need to be removed.", completed: false },
  { id: 3, category: "1 Hour Before Closing", text: "Pull product as required at this time.", completed: false },
  { id: 4, category: "1 Hour Before Closing", text: "Close the driver till.", completed: false },
  { id: 5, category: "1 Hour Before Closing", text: "Remove all trash except one can; replace liners in all bins.", completed: false },
  { id: 6, category: "1 Hour Before Closing", text: "Pull tea and thoroughly clean the coffee machine.", completed: false },
  { id: 7, category: "1 Hour Before Closing", text: "Reduce operations to bare minimum.", completed: false },
  { id: 8, category: "1 Hour Before Closing", text: "Wipe down countertops and the top of the make line.", completed: false },
  { id: 9, category: "1 Hour Before Closing", text: "Place lids on the make line.", completed: false },
  { id: 10, category: "1 Hour Before Closing", text: "Sweep floors.", completed: false },
  { id: 11, category: "1 Hour Before Closing", text: "Check the lobby for trash and dirty tables.", completed: false },
  { id: 12, category: "1 Hour Before Closing", text: "Check bathrooms for trash and debris.", completed: false },
  { id: 13, category: "30 Minutes Before Closing", text: "Filter the fryer. When refilling, allow it to continue filling until you are ready to leave so no oil remains at the bottom.", completed: false },
  { id: 14, category: "30 Minutes Before Closing", text: "Enter inventory counts and complete closing procedures on the tablet.", completed: false },
  { id: 15, category: "30 Minutes Before Closing", text: "Pull any remaining labels that are no longer needed.", completed: false },
  { id: 16, category: "30 Minutes Before Closing", text: "Remove sanitizer buckets.", completed: false },
  { id: 17, category: "30 Minutes Before Closing", text: "Mop floors if time permits.", completed: false },
  { id: 18, category: "30 Minutes Before Closing", text: "Close the front till. At this point, only the window till should remain open.", completed: false },
  { id: 19, category: "Driver Area Cleaning", text: "Sweep the driver area, including under the sink and drying shelves.", completed: false },
  { id: 20, category: "Driver Area Cleaning", text: "Clean the dishwasher.", completed: false },
  { id: 21, category: "Driver Area Cleaning", text: "Spray out and clean all trash bins.", completed: false },
  { id: 22, category: "Final Walk-Through", text: "Dishwasher is cleaned and turned off.", completed: false },
  { id: 23, category: "Final Walk-Through", text: "Dish bins are sprayed out.", completed: false },
  { id: 24, category: "Final Walk-Through", text: "Sink areas on both sides of the dishwasher are clean.", completed: false },
  { id: 25, category: "Final Walk-Through", text: "Back door is locked.", completed: false },
  { id: 26, category: "Final Walk-Through", text: "All lights are turned off.", completed: false },
  { id: 27, category: "Final Walk-Through", text: "Labels have been pulled.", completed: false },
  { id: 28, category: "Final Walk-Through", text: "Make line lids are on.", completed: false },
  { id: 29, category: "Final Walk-Through", text: "Counters are wiped down. LIDS are on cut table.", completed: false },
  { id: 30, category: "Final Walk-Through", text: "Trash has been taken out. (don't forget bathrooms)", completed: false },
  { id: 31, category: "Final Walk-Through", text: "Buckets have been removed.", completed: false },
  { id: 32, category: "Final Walk-Through", text: "TV, oven, proofer, and hot box are turned off.", completed: false },
  { id: 33, category: "Final Walk-Through", text: "Window is locked.", completed: false },
  { id: 34, category: "Final Walk-Through", text: "Safe is locked.", completed: false },
  { id: 35, category: "Final Walk-Through", text: "Both doors are locked.", completed: false },
  { id: 36, category: "Final Walk-Through", text: "Tea containers have been washed out.", completed: false },
];

const STORAGE_KEY = "@pizza_hut_checklist";

type ListItem =
  | { type: "header"; category: string; completed: number; total: number }
  | { type: "task"; task: Task };

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: number) => void }) {
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

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        style={[
          styles.taskRow,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
        testID={`task-${task.id}`}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: task.completed ? colors.primary : colors.border,
              backgroundColor: task.completed ? colors.primary : "transparent",
            },
          ]}
        >
          {task.completed && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </View>
        <Text
          style={[
            styles.taskText,
            {
              color: task.completed ? colors.mutedForeground : colors.foreground,
              textDecorationLine: task.completed ? "line-through" : "none",
            },
          ]}
        >
          {task.text}
        </Text>
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
          {
            backgroundColor: allDone ? colors.primary : colors.border,
          },
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
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const completeBannerAnim = useRef(new Animated.Value(0)).current;
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) {
        try {
          setTasks(JSON.parse(data));
        } catch {}
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const progress = totalTasks > 0 ? completedTasks / totalTasks : 0;
  const allDone = completedTasks === totalTasks;

  useEffect(() => {
    if (allDone && completedTasks > 0) {
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
  }, [allDone, completedTasks]);

  const toggleTask = useCallback((id: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }, []);

  const resetChecklist = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTasks((prev) => prev.map((t) => ({ ...t, completed: false })));
  };

  const categories = [...new Set(tasks.map((t) => t.category))];

  const listData: ListItem[] = [];
  for (const category of categories) {
    const categoryTasks = tasks.filter((t) => t.category === category);
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
  const headerHeight = 56;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sticky Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.primary,
            paddingTop: topPadding,
          },
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
          <TouchableOpacity
            onPress={resetChecklist}
            style={styles.resetButton}
            testID="reset-button"
          >
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
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
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` as any },
              ]}
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
          return <TaskRow task={item.task} onToggle={toggleTask} />;
        }}
        contentContainerStyle={{
          paddingBottom: (isWeb ? 34 : insets.bottom) + 80,
        }}
        showsVerticalScrollIndicator={false}
        scrollEnabled
      />

      {/* Completion Banner */}
      {allDone && completedTasks > 0 && (
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
  container: {
    flex: 1,
  },
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
  logo: {
    width: 40,
    height: 40,
  },
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
  progressSection: {
    gap: 6,
  },
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
  taskText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
    flex: 1,
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
  bannerLogo: {
    width: 22,
    height: 22,
  },
  bannerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
