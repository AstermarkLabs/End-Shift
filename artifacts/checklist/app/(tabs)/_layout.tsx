import { Tabs } from "expo-router";
import React from "react";

import M3TabBar from "@/components/ui/M3TabBar";

// Tab order and labels follow the design's navigation bar
// (m3/App.jsx navItems): Close / History / Reports / Settings.
export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <M3TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Close" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="reports" options={{ title: "Reports" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
