import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  updateRole,
  type Profile,
  type Right,
  type Role,
} from "@workspace/api-client-react";

import { describeApiError } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

// ─── Rights metadata ──────────────────────────────────────────────────────────

const RIGHT_META: Record<
  Right,
  { label: string; description: string; group: string; icon: string }
> = {
  manage_profiles: {
    label: "Manage Profiles",
    description: "Edit user profiles and account details",
    group: "USERS",
    icon: "👤",
  },
  assign_roles: {
    label: "Assign Roles",
    description: "Assign roles to users within their scope",
    group: "USERS",
    icon: "🏷",
  },
  manage_roles: {
    label: "Manage Roles",
    description: "Create, edit, and delete roles",
    group: "USERS",
    icon: "🔐",
  },
  manage_org_units: {
    label: "Manage Org Units",
    description: "Create, edit, and delete org units",
    group: "ORGANIZATION",
    icon: "🗂",
  },
  create_checklists: {
    label: "Create Checklists",
    description: "Add new checklists and sections",
    group: "CHECKLISTS",
    icon: "📋",
  },
  edit_checklists: {
    label: "Edit Checklists",
    description: "Rename, reorder, and edit tasks",
    group: "CHECKLISTS",
    icon: "✏️",
  },
  delete_checklists: {
    label: "Delete Checklists",
    description: "Permanently remove checklists",
    group: "CHECKLISTS",
    icon: "🗑",
  },
  manage_checklist_settings: {
    label: "Checklist Settings",
    description: "Configure per-checklist settings",
    group: "CHECKLISTS",
    icon: "⚙️",
  },
  view_reports: {
    label: "View Reports",
    description: "Access shift history and completion records",
    group: "REPORTING",
    icon: "🕐",
  },
};

const RIGHT_ORDER: Right[] = [
  "manage_profiles",
  "assign_roles",
  "manage_roles",
  "manage_org_units",
  "create_checklists",
  "edit_checklists",
  "delete_checklists",
  "manage_checklist_settings",
  "view_reports",
];

const GROUP_ORDER = ["USERS", "ORGANIZATION", "CHECKLISTS", "REPORTING"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleBadgeColors(level: number): { bg: string; text: string; border: string } {
  if (level >= 950) return { bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5" };
  if (level >= 700) return { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" };
  if (level >= 400) return { bg: "#F0FDF4", text: "#15803D", border: "#86EFAC" };
  return { bg: "#F8FAFC", text: "#64748B", border: "#CBD5E1" };
}

function isLocked(role: Role): boolean {
  return role.isSystem || role.name === "Owner";
}

// ─── Checkbox cell ────────────────────────────────────────────────────────────

function CheckCell({
  checked,
  locked,
  saving,
  onToggle,
}: {
  checked: boolean;
  locked: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  if (saving) {
    return (
      <View style={c.cell}>
        <ActivityIndicator size="small" color="#DC2626" />
      </View>
    );
  }

  if (locked) {
    return (
      <View style={c.cell}>
        <View style={[c.checkbox, checked ? c.checkboxCheckedLocked : c.checkboxUnchecked]}>
          {checked && <Text style={{ color: "#DC2626", fontSize: 11, fontWeight: "700" }}>✓</Text>}
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity style={c.cell} onPress={onToggle} activeOpacity={0.7}>
      <View style={[c.checkbox, checked ? c.checkboxChecked : c.checkboxUnchecked]}>
        {checked && <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── RolesPanel ───────────────────────────────────────────────────────────────

export function RolesPanel({
  roles,
  currentUser,
  onReload,
}: {
  roles: Role[];
  currentUser: Profile;
  onReload: () => void;
}) {
  const colors = useColors();

  // Local rights state — optimistic updates
  const [rightsMap, setRightsMap] = useState<Record<number, Right[]>>({});
  // Track which role column is saving (set of role IDs)
  const [saving, setSaving] = useState<Set<number>>(new Set());
  // Debounce timers per role
  const saveTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const map: Record<number, Right[]> = {};
    for (const r of roles) map[r.id] = [...r.rights];
    setRightsMap(map);
  }, [roles]);

  const scheduleSync = (roleId: number, newRights: Right[]) => {
    // Clear any pending save for this role
    const existing = saveTimers.current.get(roleId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      saveTimers.current.delete(roleId);
      setSaving((s) => new Set([...s, roleId]));
      try {
        await updateRole(roleId, { rights: newRights as never });
      } catch (e) {
        Alert.alert("Failed", describeApiError(e));
        // Revert
        onReload();
      } finally {
        setSaving((s) => { const next = new Set(s); next.delete(roleId); return next; });
      }
    }, 600);
    saveTimers.current.set(roleId, timer);
  };

  const toggle = (roleId: number, right: Right) => {
    setRightsMap((prev) => {
      const current = prev[roleId] ?? [];
      const next = current.includes(right)
        ? current.filter((r) => r !== right)
        : [...current, right];
      scheduleSync(roleId, next);
      return { ...prev, [roleId]: next };
    });
  };

  // Sort roles: system first, then by level desc
  const sortedRoles = [...roles].sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    return b.level - a.level;
  });

  const ROLE_COL_WIDTH = 120;
  const RIGHT_COL_WIDTH = 260;

  // Group rights
  const groups = GROUP_ORDER.map((group) => ({
    group,
    rights: RIGHT_ORDER.filter((r) => RIGHT_META[r].group === group),
  }));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 32, paddingBottom: 64 }}>
      {/* Header */}
      <View style={{ marginBottom: 24 }}>
        <Text style={[r.title, { color: colors.foreground }]}>Roles & Permissions</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 2 }}>
          Control what each role can do across the app.
        </Text>
      </View>

      {/* Matrix table */}
      <View style={[r.matrix, { borderColor: colors.border, backgroundColor: colors.card }]}>
        {/* Column headers */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Role header row */}
            <View style={[r.headerRow, { borderBottomColor: colors.border }]}>
              <View style={{ width: RIGHT_COL_WIDTH }} />
              {sortedRoles.map((role) => {
                const locked = isLocked(role);
                const { bg, text, border } = roleBadgeColors(role.level);
                return (
                  <View key={role.id} style={[r.roleHeaderCell, { width: ROLE_COL_WIDTH }]}>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: locked ? "#FCA5A5" : border,
                        backgroundColor: locked ? "#FEF2F2" : bg,
                      }}
                    >
                      <Text
                        style={{ fontSize: 12, fontWeight: "600", color: locked ? "#DC2626" : text }}
                        numberOfLines={1}
                      >
                        {role.name}
                      </Text>
                    </View>
                    {locked && (
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 3 }}>
                        🔒 locked
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Groups + rights rows */}
            {groups.map(({ group, rights }) => (
              <View key={group}>
                {/* Group label */}
                <View
                  style={[
                    r.groupRow,
                    { borderBottomColor: colors.border, backgroundColor: colors.background },
                  ]}
                >
                  <View style={{ width: RIGHT_COL_WIDTH, paddingLeft: 16 }}>
                    <Text style={[r.groupLabel, { color: colors.mutedForeground }]}>{group}</Text>
                  </View>
                  {sortedRoles.map((role) => (
                    <View key={role.id} style={{ width: ROLE_COL_WIDTH }} />
                  ))}
                </View>

                {/* Right rows */}
                {rights.map((right, i) => {
                  const meta = RIGHT_META[right];
                  const isLastInGroup = i === rights.length - 1;
                  return (
                    <View
                      key={right}
                      style={[
                        r.rightRow,
                        {
                          borderBottomColor: colors.border,
                          borderBottomWidth: isLastInGroup ? 0 : 1,
                        },
                      ]}
                    >
                      {/* Right label */}
                      <View style={{ width: RIGHT_COL_WIDTH, paddingHorizontal: 16, paddingVertical: 14 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Text style={{ fontSize: 18, width: 24 }}>{meta.icon}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: "600", color: colors.foreground, fontSize: 14 }}>
                              {meta.label}
                            </Text>
                            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 1 }}>
                              {meta.description}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Checkboxes */}
                      {sortedRoles.map((role) => {
                        const locked = isLocked(role);
                        const checked = (rightsMap[role.id] ?? []).includes(right);
                        const isSaving = saving.has(role.id);
                        return (
                          <CheckCell
                            key={role.id}
                            checked={checked}
                            locked={locked}
                            saving={isSaving && !locked}
                            onToggle={() => toggle(role.id, right)}
                          />
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Footer note */}
      <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 16 }}>
        🔒 Owner has all permissions and cannot be modified.
      </Text>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const r = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "700" },
  matrix: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  roleHeaderCell: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 2,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});

const c = StyleSheet.create({
  cell: {
    width: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  checkboxChecked: {
    backgroundColor: "#DC2626",
    borderColor: "#DC2626",
  },
  checkboxCheckedLocked: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  checkboxUnchecked: {
    backgroundColor: "transparent",
    borderColor: "#D1D5DB",
  },
});
