import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  listOrgUnits,
  listProfiles,
  listRoles,
  type OrgUnit,
  type Profile,
  type Role,
} from "@workspace/api-client-react";

import { OrgUnitsPanel } from "@/components/admin/web/OrgUnitsPanel";
import { RolesPanel } from "@/components/admin/web/RolesPanel";
import { UsersPanel } from "@/components/admin/web/UsersPanel";
import { describeApiError, useAuth } from "@/context/AuthContext";
import shape from "@/constants/shape";
import { useMd } from "@/theme/useMd";

type Tab = "users" | "roles" | "orgunits";

const TABS: { id: Tab; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "orgunits", label: "Org Units" },
];

export default function AdminWebScreen() {
  const router = useRouter();
  const md = useMd();
  const { profile: currentUser } = useAuth();

  const [tab, setTab] = useState<Tab>("users");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, ou] = await Promise.all([listProfiles(), listRoles(), listOrgUnits()]);
      setProfiles(p);
      setRoles(r);
      setOrgUnits(ou);
    } catch (e) {
      Alert.alert("Failed to load", describeApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  if (!currentUser) return null;

  const isSystem = currentUser.role.isSystem;
  const canManageOrgUnits = isSystem || currentUser.role.rights.includes("manage_org_units");

  return (
    <View style={[s.page, { backgroundColor: md.surface }]}>
      {/* Top bar */}
      <View style={[s.topBar, { backgroundColor: md.surfaceContainerLow, borderBottomColor: md.outlineVariant }]}>
        <Text style={[s.brand, { color: md.onSurfaceVariant }]}>END SHIFT ADMIN</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: md.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={s.body}>
        {/* Sidebar */}
        <View style={[s.sidebar, { backgroundColor: md.surfaceContainerLow, borderRightColor: md.outlineVariant }]}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  s.sideTab,
                  { borderLeftColor: active ? md.primary : "transparent" },
                  active && { backgroundColor: md.secondaryContainer, borderRadius: shape.xs },
                ]}
                onPress={() => setTab(t.id)}
              >
                <Text style={[s.sideTabText, { color: active ? md.onSecondaryContainer : md.onSurface, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content */}
        <View style={s.content}>
          {loading ? (
            <ActivityIndicator color={md.primary} style={{ marginTop: 64 }} />
          ) : tab === "users" ? (
            <UsersPanel
              profiles={profiles}
              roles={roles}
              orgUnits={orgUnits}
              currentUser={currentUser}
              onReload={reload}
            />
          ) : tab === "roles" ? (
            <RolesPanel
              roles={roles}
              currentUser={currentUser}
              onReload={reload}
            />
          ) : (
            <OrgUnitsPanel
              orgUnits={orgUnits}
              profiles={profiles}
              canManage={canManageOrgUnits}
              currentUser={currentUser}
              onReload={reload}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  topBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  brand: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.5, textTransform: "uppercase" },
  body: { flex: 1, flexDirection: "row" },
  sidebar: {
    width: 224,
    borderRightWidth: 1,
    paddingVertical: 16,
  },
  sideTab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderLeftWidth: 3,
  },
  sideTabText: { fontSize: 14 },
  content: { flex: 1 },
});
