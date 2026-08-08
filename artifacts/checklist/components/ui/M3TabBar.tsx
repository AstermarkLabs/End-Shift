// Material 3 navigation bar, used as expo-router's custom `tabBar`.
// Ported from the design prototype's NavigationBar (m3/components-nav.jsx):
// 80px tall on `surfaceContainer`, a 64x32 `secondaryContainer` pill behind
// the active icon, `labelMedium` label, error-colored badge.
//
// react-native-paper's own BottomNavigation owns routing state and fights
// expo-router, so only the presentation is reused here.
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import shape from "@/constants/shape";
import { typeStyle } from "@/constants/typography";
import { useChecklist } from "@/context/ChecklistContext";
import { useMd } from "@/theme/useMd";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

// Design order: Close / History / Reports / Settings (m3/App.jsx navItems).
const ICONS: Record<string, { icon: IoniconName; activeIcon: IoniconName }> = {
  index: { icon: "checkbox-outline", activeIcon: "checkbox" },
  history: { icon: "time-outline", activeIcon: "time" },
  reports: { icon: "bar-chart-outline", activeIcon: "bar-chart" },
  settings: { icon: "settings-outline", activeIcon: "settings" },
};

// Structurally typed rather than importing BottomTabBarProps:
// @react-navigation/bottom-tabs is only a transitive dependency of expo-router
// and is not resolvable from this package. This covers everything used below.
type TabRoute = { key: string; name: string };

type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarLabel?: unknown;
        tabBarAccessibilityLabel?: string;
      };
    }
  >;
  navigation: {
    emit(event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }): { defaultPrevented: boolean };
    navigate(name: string): void;
  };
};

export default function M3TabBar({ state, descriptors, navigation }: TabBarProps) {
  const md = useMd();
  const insets = useSafeAreaInsets();
  const { completionHistory } = useChecklist();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: md.surfaceContainer, paddingBottom: 16 + insets.bottom },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === "string"
            ? options.tabBarLabel
            : (options.title ?? route.name);
        const focused = state.index === index;
        const icons = ICONS[route.name] ?? ICONS.index;
        const badge = route.name === "history" ? completionHistory.length : 0;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={onPress}
            style={styles.item}
            android_ripple={{ color: md.onSurface, borderless: true }}
          >
            <View
              style={[
                styles.pill,
                { backgroundColor: focused ? md.secondaryContainer : "transparent" },
              ]}
            >
              <Ionicons
                name={focused ? icons.activeIcon : icons.icon}
                size={22}
                color={focused ? md.onSecondaryContainer : md.onSurfaceVariant}
              />
              {badge > 0 && (
                <View style={[styles.badge, { backgroundColor: md.error }]}>
                  <Text style={[typeStyle("labelSmall"), { color: md.onError }]}>
                    {badge > 99 ? "99+" : badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              // The design bumps the active label to 700. Weight is carried by
              // the font family, never by fontWeight.
              style={[
                typeStyle(focused ? "labelLarge" : "labelMedium"),
                {
                  fontFamily: focused ? "Inter_700Bold" : "Inter_500Medium",
                  fontSize: 12,
                  lineHeight: 16,
                  color: focused ? md.onSurface : md.onSurfaceVariant,
                },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    paddingTop: 12,
    flexShrink: 0,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  pill: {
    width: 64,
    height: 32,
    borderRadius: shape.full,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    left: "54%",
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
