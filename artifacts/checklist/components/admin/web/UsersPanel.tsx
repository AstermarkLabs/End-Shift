import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  createProfile,
  deleteProfile,
  updateProfile,
  type OrgUnit,
  type Profile,
  type Role,
} from "@workspace/api-client-react";

import { OrgUnitSelector } from "@/components/admin/OrgUnitSelector";
import { describeApiError } from "@/context/AuthContext";
import shape from "@/constants/shape";
import { useMd } from "@/theme/useMd";
import { validatePassword } from "@/utils/passwordValidation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

const AVATAR_PALETTE = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
  "#6366F1", "#84CC16",
];

function avatarColor(name: string): string {
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx]!;
}

function roleBadgeColors(
  level: number,
  colors: ReturnType<typeof useMd>,
): { bg: string; text: string; border: string } {
  if (level >= 950) return { bg: colors.errorContainer, text: colors.error, border: colors.error };
  if (level >= 700) return { bg: colors.tertiaryContainer, text: colors.tertiary, border: colors.tertiary };
  if (level >= 400) return { bg: colors.successContainer, text: colors.success, border: colors.success };
  return { bg: colors.surfaceContainerHighest, text: colors.onSurfaceVariant, border: colors.outlineVariant };
}

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*+-=";
  const all = upper + lower + digits + special;
  let pwd =
    upper[Math.floor(Math.random() * upper.length)]! +
    lower[Math.floor(Math.random() * lower.length)]! +
    digits[Math.floor(Math.random() * digits.length)]! +
    special[Math.floor(Math.random() * special.length)]!;
  for (let i = 0; i < 8; i++) pwd += all[Math.floor(Math.random() * all.length)]!;
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

function isOwnerUser(p: Profile): boolean {
  return p.role.name === "Owner" || p.role.isSystem;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const colors = useMd();
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: avatarColor(name),
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {/* Literal white: the background is an arbitrary AVATAR_PALETTE hex, not a
          theme role, so no `on*` role is guaranteed to contrast with it. */}
      <Text style={{ color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 13 }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const colors = useMd();
  const { bg, text, border } = roleBadgeColors(role.level, colors);
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: text }} numberOfLines={1}>
        {role.name}
      </Text>
    </View>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  const colors = useMd();
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.success : colors.outlineVariant,
        backgroundColor: active ? colors.successContainer : colors.surfaceContainerHighest,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: active ? colors.success : colors.onSurfaceVariant }}>
        {active ? "Active" : "Inactive"}
      </Text>
    </View>
  );
}

// ─── UserEditModal ────────────────────────────────────────────────────────────

function UserEditModal({
  user,
  roles,
  orgUnits,
  currentUser,
  onClose,
  onSaved,
}: {
  user: Profile | null;
  roles: Role[];
  orgUnits: OrgUnit[];
  currentUser: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useMd();
  const isSystem = currentUser.role.isSystem;
  const callerOrgUnitId = currentUser.orgUnitId ?? null;

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState<number | null>(null);
  const [orgUnitId, setOrgUnitId] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const [resetSection, setResetSection] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUsername(user?.username ?? "");
    setDisplayName(user?.displayName ?? "");
    setPassword("");
    setResetSection(false);
    setResetPassword("");
    setShowResetPassword(false);
    setRoleId(user?.roleId ?? roles[0]?.id ?? null);
    setOrgUnitId(user?.orgUnitId ?? null);
    setActive(user?.isActive ?? true);
  }, [user, roles]);

  const assignableRoles = roles.filter((r) => isSystem || r.level <= currentUser.role.level);

  const onSubmit = async () => {
    setBusy(true);
    try {
      if (user) {
        const patch: Parameters<typeof updateProfile>[1] = {};
        if (username && username !== user.username) patch.username = username;
        if (displayName && displayName !== user.displayName) patch.displayName = displayName;
        if (resetSection && resetPassword) {
          patch.password = resetPassword;
          patch.mustChangePassword = true;
        }
        if (roleId != null && roleId !== user.roleId) patch.roleId = roleId;
        if (orgUnitId !== (user.orgUnitId ?? null)) patch.orgUnitId = orgUnitId;
        if (active !== user.isActive) patch.isActive = active;
        if (Object.keys(patch).length > 0) {
          await updateProfile(user.id, patch);
          if (resetSection && resetPassword) {
            Alert.alert(
              "Password reset",
              `${user.displayName} must choose a new password on next sign-in.\n\nTemp password:\n${resetPassword}`,
            );
          }
        }
      } else {
        if (!username || !displayName || !password || roleId == null) {
          Alert.alert("Required", "Username, name, password, and role are required.");
          setBusy(false);
          return;
        }
        if (callerOrgUnitId !== null && orgUnitId === null) {
          Alert.alert("Required", "Please assign the user to a location.");
          setBusy(false);
          return;
        }
        const pwCheck = validatePassword(password);
        if (!pwCheck.valid) {
          Alert.alert("Weak password", pwCheck.errors.join("\n"));
          setBusy(false);
          return;
        }
        await createProfile({ username, displayName, password, roleId, orgUnitId });
      }
      onSaved();
    } catch (e) {
      Alert.alert("Failed", describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!user) return;
    Alert.alert("Delete user", `Delete ${user.displayName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteProfile(user.id);
            onSaved();
          } catch (e) {
            Alert.alert("Failed", describeApiError(e));
          }
        },
      },
    ]);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={[m.dialog, { backgroundColor: colors.surfaceContainerLow, shadowColor: "#000" }]}>
          {/* Header */}
          <View style={m.dialogHeader}>
            <Text style={[m.dialogTitle, { color: colors.onSurface }]}>
              {user ? "Edit user" : "New user"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 20, lineHeight: 24 }}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
            {/* Fields */}
            <FormField label="Display name" value={displayName} onChangeText={setDisplayName} editable={!busy} />
            <FormField label="Username" value={username} onChangeText={setUsername} editable={!busy} autoCapitalize="none" />

            {/* Password */}
            {user ? (
              <View style={[m.resetCard, { borderColor: resetSection ? colors.primary : colors.outlineVariant, backgroundColor: colors.surface }]}>
                <TouchableOpacity
                  style={m.resetCardHeader}
                  onPress={() => {
                    setResetSection((v) => !v);
                    if (!resetSection) {
                      const tmp = generateTempPassword();
                      setResetPassword(tmp);
                      setShowResetPassword(true);
                    } else {
                      setResetPassword("");
                    }
                  }}
                >
                  <Text style={[m.resetCardTitle, { color: resetSection ? colors.primary : colors.onSurface }]}>
                    🔑 Reset password
                  </Text>
                  <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>
                    {resetSection ? "Cancel" : "Tap to set a new password"}
                  </Text>
                </TouchableOpacity>
                {resetSection && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                    <View style={[m.tempPwRow, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}>
                      <Text selectable style={[m.tempPwText, { color: showResetPassword ? colors.onSurface : colors.onSurfaceVariant }]}>
                        {showResetPassword ? resetPassword : "••••••••••••"}
                      </Text>
                      <TouchableOpacity onPress={() => setShowResetPassword((v) => !v)}>
                        <Text style={{ fontSize: 16 }}>{showResetPassword ? "🙈" : "👁️"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { setResetPassword(generateTempPassword()); setShowResetPassword(true); }}
                        style={[m.generateBtn, { backgroundColor: colors.secondaryContainer }]}
                      >
                        <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Generate</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      value={resetPassword}
                      onChangeText={setResetPassword}
                      placeholder="Or type a custom password"
                      placeholderTextColor={colors.onSurfaceVariant}
                      secureTextEntry={!showResetPassword}
                      editable={!busy}
                      style={[m.input, { borderColor: colors.outlineVariant, color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, outlineWidth: 0 } as object]}
                    />
                    <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, fontStyle: "italic" }}>
                      Staff must change on next sign-in. 12+ chars, upper, lower, number, special.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry editable={!busy} />
            )}

            {/* Role picker */}
            <View>
              <Text style={[m.label, { color: colors.onSurface }]}>Role</Text>
              <View style={{ gap: 4 }}>
                {assignableRoles.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      m.roleRow,
                      {
                        borderColor: roleId === r.id ? colors.primary : colors.outlineVariant,
                        backgroundColor: roleId === r.id ? colors.secondaryContainer : colors.surfaceContainerLow,
                      },
                    ]}
                    onPress={() => setRoleId(r.id)}
                  >
                    <RoleBadge role={r} />
                    <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>level {r.level}</Text>
                    {roleId === r.id && (
                      <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", marginLeft: "auto" }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Org unit */}
            <OrgUnitSelector
              orgUnits={orgUnits}
              value={orgUnitId}
              onChange={setOrgUnitId}
              callerOrgUnitId={callerOrgUnitId}
            />

            {/* Active toggle (edit only) */}
            {user && (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={{ color: colors.onSurface }}>Active</Text>
                <Switch value={active} onValueChange={setActive} />
              </View>
            )}
          </ScrollView>

          {/* Footer actions */}
          <View style={m.dialogFooter}>
            {user && (
              <TouchableOpacity
                style={[m.dangerBtn, { backgroundColor: colors.error, opacity: busy ? 0.6 : 1 }]}
                onPress={onDelete}
                disabled={busy}
              >
                <Text style={{ color: colors.onError, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Delete</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[m.cancelBtn, { borderColor: colors.outlineVariant }]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={{ color: colors.onSurface, fontFamily: "Inter_500Medium", fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.saveBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
              onPress={onSubmit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={{ color: colors.onPrimary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FormField({
  label,
  ...rest
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  const colors = useMd();
  return (
    <View>
      <Text style={[m.label, { color: colors.onSurface }]}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.onSurfaceVariant}
        autoCapitalize="none"
        style={[m.input, { borderColor: colors.outlineVariant, color: colors.onSurface, backgroundColor: colors.surfaceContainerLow, outlineWidth: 0 } as object]}
      />
    </View>
  );
}

// ─── UsersPanel ───────────────────────────────────────────────────────────────

export function UsersPanel({
  profiles,
  roles,
  orgUnits,
  currentUser,
  onReload,
}: {
  profiles: Profile[];
  roles: Role[];
  orgUnits: OrgUnit[];
  currentUser: Profile;
  onReload: () => void;
}) {
  const colors = useMd();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editingUser, setEditingUser] = useState<Profile | null | "new">(null);

  const isSystem = currentUser.role.isSystem;
  const canManage = isSystem || currentUser.role.rights.includes("manage_profiles");

  const activeCount = profiles.filter((p) => p.isActive).length;

  const filtered = profiles.filter((p) => {
    if (statusFilter === "active" && !p.isActive) return false;
    if (statusFilter === "inactive" && p.isActive) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      p.displayName.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q) ||
      p.role.name.toLowerCase().includes(q) ||
      (p.orgUnit?.name ?? "").toLowerCase().includes(q)
    );
  });

  const toggleActive = async (p: Profile) => {
    try {
      await updateProfile(p.id, { isActive: !p.isActive });
      onReload();
    } catch (e) {
      Alert.alert("Failed", describeApiError(e));
    }
  };

  const handleDelete = (p: Profile) => {
    Alert.alert("Delete user", `Delete ${p.displayName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteProfile(p.id);
            onReload();
          } catch (e) {
            Alert.alert("Failed", describeApiError(e));
          }
        },
      },
    ]);
  };

  const W = { name: 220, email: 220, role: 160, org: 160, status: 110, actions: 100 };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 32, paddingBottom: 64 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <View>
          <Text style={[p.title, { color: colors.onSurface }]}>Users</Text>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 14, marginTop: 2 }}>
            {activeCount} active · {profiles.length} total
          </Text>
        </View>
        {canManage && (
          <TouchableOpacity
            style={[p.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => setEditingUser("new")}
          >
            <Text style={{ color: colors.onPrimary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              + Invite User
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <View style={[p.searchBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow }]}>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 15 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search users..."
            placeholderTextColor={colors.onSurfaceVariant}
            style={{ flex: 1, color: colors.onSurface, fontSize: 14, outlineWidth: 0 } as object}
          />
        </View>
        <View style={[p.filterGroup, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow }]}>
          {(["all", "active", "inactive"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                p.filterBtn,
                statusFilter === f && { backgroundColor: colors.secondaryContainer },
              ]}
              onPress={() => setStatusFilter(f)}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: statusFilter === f ? "Inter_600SemiBold" : "Inter_400Regular",
                  color: statusFilter === f ? colors.primary : colors.onSurface,
                  textTransform: "capitalize",
                }}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, marginLeft: "auto" as any }}>
          {filtered.length} results
        </Text>
      </View>

      {/* Table */}
      <View style={[p.table, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow }]}>
        {/* Header row */}
        <View style={[p.tableHeaderRow, { borderBottomColor: colors.outlineVariant, backgroundColor: colors.surface }]}>
          <Text style={[p.th, { width: W.name }]}>NAME</Text>
          <Text style={[p.th, { width: W.email }]}>EMAIL</Text>
          <Text style={[p.th, { width: W.role }]}>ROLE</Text>
          <Text style={[p.th, { width: W.org }]}>ORG UNIT</Text>
          <Text style={[p.th, { width: W.status }]}>STATUS</Text>
          <View style={{ width: W.actions }} />
        </View>

        {/* Body rows */}
        {filtered.map((user, i) => {
          const owner = isOwnerUser(user);
          return (
            <View
              key={user.id}
              style={[
                p.tableRow,
                i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
              ]}
            >
              {/* Name */}
              <View style={{ width: W.name, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Avatar name={user.displayName} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.onSurface, fontSize: 14 }} numberOfLines={1}>
                    {user.displayName}
                  </Text>
                  {owner && (
                    <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>Account owner</Text>
                  )}
                </View>
              </View>

              {/* Email */}
              <Text style={{ width: W.email, color: colors.onSurfaceVariant, fontSize: 14 }} numberOfLines={1}>
                {user.email ?? user.username}
              </Text>

              {/* Role */}
              <View style={{ width: W.role }}>
                <RoleBadge role={user.role} />
              </View>

              {/* Org unit */}
              <Text style={{ width: W.org, color: colors.onSurface, fontSize: 14 }} numberOfLines={1}>
                {user.orgUnit?.name ?? "—"}
              </Text>

              {/* Status */}
              <View style={{ width: W.status }}>
                <StatusBadge active={user.isActive} />
              </View>

              {/* Actions */}
              {canManage && !owner ? (
                <View style={{ width: W.actions, flexDirection: "row", gap: 6, justifyContent: "flex-end" }}>
                  <TouchableOpacity
                    style={p.iconBtn}
                    onPress={() => setEditingUser(user)}
                  >
                    <Text style={{ fontSize: 16 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={p.iconBtn} onPress={() => toggleActive(user)}>
                    <Text style={{ fontSize: 16 }}>{user.isActive ? "⏸" : "▶"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={p.iconBtn} onPress={() => handleDelete(user)}>
                    <Text style={{ fontSize: 16 }}>🗑</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ width: W.actions }} />
              )}
            </View>
          );
        })}

        {filtered.length === 0 && (
          <View style={{ padding: 48, alignItems: "center" }}>
            <Text style={{ color: colors.onSurfaceVariant }}>No users found.</Text>
          </View>
        )}
      </View>

      {/* Edit modal */}
      {editingUser !== null && (
        <UserEditModal
          user={editingUser === "new" ? null : editingUser}
          roles={roles}
          orgUnits={orgUnits}
          currentUser={currentUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => { setEditingUser(null); onReload(); }}
        />
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const p = StyleSheet.create({
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  primaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    maxWidth: 280,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterGroup: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  table: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  th: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  dialog: {
    width: 480,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
    padding: 24,
    gap: 16,
    maxHeight: "90%",
  },
  dialogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dialogTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  dialogFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  resetCard: { borderWidth: 1.5, borderRadius: 12, overflow: "hidden" },
  resetCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  resetCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  tempPwRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tempPwText: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  generateBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
