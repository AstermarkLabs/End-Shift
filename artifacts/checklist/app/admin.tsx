import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  createProfile,
  createRole,
  deleteProfile,
  deleteRole,
  listOrgUnits,
  listProfiles,
  listRoles,
  Right,
  updateProfile,
  updateRole,
  type OrgUnit,
  type Profile,
  type Role,
} from "@workspace/api-client-react";

import { OrgUnitTree } from "@/components/admin/OrgUnitTree";

import { describeApiError, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { validatePassword } from "@/utils/passwordValidation";

const RIGHT_VALUES = Object.values(Right);

function getSubtreeIds(orgUnits: OrgUnit[], rootId: number): Set<number> {
  const result = new Set<number>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const u of orgUnits) {
      if (u.parentId === curr) {
        result.add(u.id);
        queue.push(u.id);
      }
    }
  }
  return result;
}

function buildOrgUnitTree(orgUnits: OrgUnit[]): Array<{ unit: OrgUnit; depth: number }> {
  const out: Array<{ unit: OrgUnit; depth: number }> = [];
  const sorted = (arr: OrgUnit[]) => [...arr].sort((a, b) => a.name.localeCompare(b.name));
  for (const region of sorted(orgUnits.filter((u) => u.type === "region"))) {
    out.push({ unit: region, depth: 0 });
    for (const district of sorted(orgUnits.filter((u) => u.parentId === region.id))) {
      out.push({ unit: district, depth: 1 });
      for (const loc of sorted(orgUnits.filter((u) => u.parentId === district.id))) {
        out.push({ unit: loc, depth: 2 });
      }
    }
  }
  return out;
}

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*+-=";
  const all = upper + lower + digits + special;
  // Guarantee one character from each required class, then pad to 12 total
  let pwd = upper[Math.floor(Math.random() * upper.length)]!
    + lower[Math.floor(Math.random() * lower.length)]!
    + digits[Math.floor(Math.random() * digits.length)]!
    + special[Math.floor(Math.random() * special.length)]!;
  for (let i = 0; i < 8; i++) pwd += all[Math.floor(Math.random() * all.length)]!;
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const router = useRouter();
  const { profile } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const [profileModal, setProfileModal] = useState<{ open: boolean; editing: Profile | null }>({ open: false, editing: null });
  const [roleModal, setRoleModal] = useState<{ open: boolean; editing: Role | null }>({ open: false, editing: null });

  const reload = async () => {
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
  };

  useEffect(() => { void reload(); }, []);

  if (!profile) return null;

  const canManageProfiles = profile.role.isSystem || profile.role.rights.includes("manage_profiles");
  const canManageRoles = profile.role.isSystem || profile.role.rights.includes("manage_roles");
  const canManageOrgUnits = profile.role.isSystem || profile.role.rights.includes("manage_org_units");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 16 }}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>Admin</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Done</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <ScrollView
          scrollEnabled={scrollEnabled}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.section, { color: colors.foreground }]}>Users</Text>
            {canManageProfiles && (
              <TouchableOpacity onPress={() => setProfileModal({ open: true, editing: null })}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>+ New</Text>
              </TouchableOpacity>
            )}
          </View>
          {profiles.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setProfileModal({ open: true, editing: p })}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>{p.displayName}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                  @{p.username} · {p.role.name}{p.orgUnit ? ` · ${p.orgUnit.name}` : ""}{p.isActive ? "" : " · disabled"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={[styles.sectionHeader, { marginTop: 16 }]}>
            <Text style={[styles.section, { color: colors.foreground }]}>Roles</Text>
            {canManageRoles && (
              <TouchableOpacity onPress={() => setRoleModal({ open: true, editing: null })}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>+ New</Text>
              </TouchableOpacity>
            )}
          </View>
          {roles.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => !r.isSystem && setRoleModal({ open: true, editing: r })}
              disabled={r.isSystem}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                  {r.name} {r.isSystem ? "· system" : ""}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                  level {r.level} · {r.rights.length === 0 ? "no rights" : r.rights.join(", ")}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={[styles.sectionHeader, { marginTop: 16 }]}>
            <Text style={[styles.section, { color: colors.foreground }]}>Org Units</Text>
          </View>
          <OrgUnitTree
            orgUnits={orgUnits}
            canManage={canManageOrgUnits}
            onScrollEnable={setScrollEnabled}
          />
        </ScrollView>
      )}

      <ProfileEditModal
        state={profileModal}
        onClose={() => setProfileModal({ open: false, editing: null })}
        roles={roles}
        orgUnits={orgUnits}
        callerOrgUnitId={profile.orgUnitId ?? null}
        currentRoleLevel={profile.role.level}
        isSystem={profile.role.isSystem}
        onSaved={reload}
      />
      <RoleEditModal
        state={roleModal}
        onClose={() => setRoleModal({ open: false, editing: null })}
        currentRoleLevel={profile.role.level}
        isSystem={profile.role.isSystem}
        onSaved={reload}
      />
    </View>
  );
}

function ProfileEditModal({
  state,
  onClose,
  roles,
  orgUnits,
  callerOrgUnitId,
  currentRoleLevel,
  isSystem,
  onSaved,
}: {
  state: { open: boolean; editing: Profile | null };
  onClose: () => void;
  roles: Role[];
  orgUnits: OrgUnit[];
  callerOrgUnitId: number | null;
  currentRoleLevel: number;
  isSystem: boolean;
  onSaved: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSection, setResetSection] = useState(false);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [orgUnitId, setOrgUnitId] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state.open) return;
    setUsername(state.editing?.username ?? "");
    setDisplayName(state.editing?.displayName ?? "");
    setPassword("");
    setResetPassword("");
    setShowResetPassword(false);
    setResetSection(false);
    setRoleId(state.editing?.roleId ?? roles[0]?.id ?? null);
    setOrgUnitId(state.editing?.orgUnitId ?? null);
    setActive(state.editing?.isActive ?? true);
  }, [state.open, state.editing, roles]);

  const assignableRoles = roles.filter((r) => isSystem || r.level <= currentRoleLevel);

  const onSubmit = async () => {
    setBusy(true);
    try {
      if (state.editing) {
        const orig = state.editing;
        const patch: Parameters<typeof updateProfile>[1] = {};
        if (username && username !== orig.username) patch.username = username;
        if (displayName && displayName !== orig.displayName) patch.displayName = displayName;
        if (resetSection && resetPassword) {
          patch.password = resetPassword;
          patch.mustChangePassword = true;
        }
        if (roleId != null && roleId !== orig.roleId) patch.roleId = roleId;
        const origOrgUnitId = orig.orgUnitId ?? null;
        if (orgUnitId !== origOrgUnitId) patch.orgUnitId = orgUnitId;
        if (active !== orig.isActive) patch.isActive = active;
        if (Object.keys(patch).length === 0) {
          onClose();
          return;
        }
        await updateProfile(orig.id, patch);
        if (resetSection && resetPassword) {
          Alert.alert(
            "Password reset",
            `${orig.displayName} must choose a new password on next sign-in.\n\nTemp password:\n${resetPassword}`,
            [{ text: "OK" }]
          );
        }
      } else {
        if (!username || !displayName || !password || roleId == null) {
          Alert.alert("Required", "Username, name, password, role required.");
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
      onClose();
    } catch (e) {
      Alert.alert("Failed", describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!state.editing) return;
    Alert.alert("Delete user", `Delete ${state.editing.displayName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteProfile(state.editing!.id);
            onSaved();
            onClose();
          } catch (e) { Alert.alert("Failed", describeApiError(e)); }
        },
      },
    ]);
  };

  return (
    <Modal visible={state.open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>{state.editing ? "Edit user" : "New user"}</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ color: colors.primary }}>Cancel</Text></TouchableOpacity>
        </View>

        <Field label="Username" value={username} onChangeText={setUsername} editable={!busy} />
        <Field label="Display name" value={displayName} onChangeText={setDisplayName} editable={!busy} />

        {/* ── Password: create vs reset ─────────────────────────────── */}
        {state.editing ? (
          <View style={[styles.resetCard, { borderColor: resetSection ? colors.primary : colors.border, backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={styles.resetCardHeader}
              onPress={() => {
                setResetSection((v) => !v);
                if (!resetSection) {
                  const tmp = generateTempPassword();
                  setResetPassword(tmp);
                  setShowResetPassword(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } else {
                  setResetPassword("");
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.resetCardTitle, { color: resetSection ? colors.primary : colors.foreground }]}>
                🔑 Reset password
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {resetSection ? "Cancel" : "Tap to set a new password"}
              </Text>
            </TouchableOpacity>

            {resetSection && (
              <View style={styles.resetCardBody}>
                <View style={[styles.tempPwRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text
                    selectable
                    style={[styles.tempPwText, { color: showResetPassword ? colors.foreground : colors.muted, letterSpacing: showResetPassword ? 2 : 0 }]}
                  >
                    {showResetPassword ? resetPassword : "••••••••••"}
                  </Text>
                  <TouchableOpacity onPress={() => setShowResetPassword((v) => !v)} style={styles.tempPwEye}>
                    <Text style={{ fontSize: 18 }}>{showResetPassword ? "🙈" : "👁️"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const tmp = generateTempPassword();
                      setResetPassword(tmp);
                      setShowResetPassword(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[styles.generateBtn, { backgroundColor: colors.secondary }]}
                  >
                    <Text style={[styles.generateBtnText, { color: colors.primary }]}>Generate</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={resetPassword}
                  onChangeText={setResetPassword}
                  placeholder="Or type a custom password"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showResetPassword}
                  editable={!busy}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                />
                <Text style={[styles.resetHint, { color: colors.mutedForeground }]}>
                  Staff will be required to change this on next sign-in. Custom passwords must be 12+ characters with uppercase, lowercase, number, and special character.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry editable={!busy} />
        )}

        <Text style={[styles.label, { color: colors.foreground }]}>Role</Text>
        <View style={{ gap: 6 }}>
          {assignableRoles.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.row, { backgroundColor: roleId === r.id ? colors.secondary : colors.card, borderColor: colors.border }]}
              onPress={() => setRoleId(r.id)}
            >
              <Text style={{ color: colors.foreground }}>{r.name} · level {r.level}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Org Unit picker ───────────────────────────────────────────── */}
        {(() => {
          const subtreeSet = callerOrgUnitId !== null ? getSubtreeIds(orgUnits, callerOrgUnitId) : null;
          const visibleUnits = buildOrgUnitTree(
            subtreeSet !== null ? orgUnits.filter((u) => subtreeSet.has(u.id)) : orgUnits,
          );
          if (visibleUnits.length === 0 && callerOrgUnitId !== null) return null;
          return (
            <>
              <Text style={[styles.label, { color: colors.foreground }]}>Location</Text>
              <View style={{ gap: 6 }}>
                {callerOrgUnitId === null && (
                  <TouchableOpacity
                    style={[styles.row, { backgroundColor: orgUnitId === null ? colors.secondary : colors.card, borderColor: colors.border }]}
                    onPress={() => setOrgUnitId(null)}
                  >
                    <Text style={{ color: colors.foreground }}>None (Tenant-wide)</Text>
                  </TouchableOpacity>
                )}
                {visibleUnits.map(({ unit, depth }) => (
                  <TouchableOpacity
                    key={unit.id}
                    style={[
                      styles.row,
                      {
                        backgroundColor: orgUnitId === unit.id ? colors.secondary : colors.card,
                        borderColor: colors.border,
                        marginLeft: depth * 14,
                        flexDirection: "row",
                        alignItems: "center",
                      },
                    ]}
                    onPress={() => setOrgUnitId(unit.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground }}>{unit.name}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, textTransform: "capitalize" }}>{unit.type}</Text>
                    </View>
                    {orgUnitId === unit.id && (
                      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          );
        })()}

        {state.editing && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={{ color: colors.foreground }}>Active</Text>
            <Switch value={active} onValueChange={setActive} />
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>Save</Text>
          )}
        </TouchableOpacity>

        {state.editing && (
          <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: colors.destructive }]} onPress={onDelete}>
            <Text style={{ color: colors.destructiveForeground, fontWeight: "600" }}>Delete user</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Modal>
  );
}

function RoleEditModal({
  state,
  onClose,
  currentRoleLevel,
  isSystem,
  onSaved,
}: {
  state: { open: boolean; editing: Role | null };
  onClose: () => void;
  currentRoleLevel: number;
  isSystem: boolean;
  onSaved: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [level, setLevel] = useState("0");
  const [rights, setRights] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state.open) return;
    setName(state.editing?.name ?? "");
    setLevel(String(state.editing?.level ?? 0));
    setRights(state.editing?.rights ?? []);
  }, [state.open, state.editing]);

  const toggleRight = (r: string) => {
    setRights((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const onSubmit = async () => {
    const lvl = Number(level);
    if (!name || !Number.isFinite(lvl)) {
      Alert.alert("Required", "Name and numeric level required.");
      return;
    }
    if (!isSystem && lvl >= currentRoleLevel) {
      Alert.alert("Not allowed", "Level must be below your own role's level.");
      return;
    }
    setBusy(true);
    try {
      if (state.editing) {
        await updateRole(state.editing.id, { name, level: lvl, rights: rights as never });
      } else {
        await createRole({ name, level: lvl, rights: rights as never });
      }
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Failed", describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!state.editing) return;
    Alert.alert("Delete role", `Delete ${state.editing.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteRole(state.editing!.id);
            onSaved();
            onClose();
          } catch (e) { Alert.alert("Failed", describeApiError(e)); }
        },
      },
    ]);
  };

  return (
    <Modal visible={state.open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>{state.editing ? "Edit role" : "New role"}</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ color: colors.primary }}>Cancel</Text></TouchableOpacity>
        </View>
        <Field label="Name" value={name} onChangeText={setName} editable={!busy} />
        <Field label="Level (lower = less power)" value={level} onChangeText={setLevel} keyboardType="numeric" editable={!busy} />
        <Text style={[styles.label, { color: colors.foreground }]}>Rights</Text>
        {RIGHT_VALUES.map((r) => (
          <View key={r} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
            <Text style={{ color: colors.foreground }}>{r}</Text>
            <Switch value={rights.includes(r)} onValueChange={() => toggleRight(r)} />
          </View>
        ))}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>Save</Text>
          )}
        </TouchableOpacity>
        {state.editing && (
          <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: colors.destructive }]} onPress={onDelete}>
            <Text style={{ color: colors.destructiveForeground, fontWeight: "600" }}>Delete role</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Modal>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const colors = useColors();
  const { label, ...rest } = props;
  return (
    <View>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        style={[styles.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  section: { fontSize: 18, fontWeight: "600" },
  row: { borderWidth: 1, borderRadius: 10, padding: 12 },
  label: { fontSize: 13, fontWeight: "500", marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  primaryBtn: { height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 12 },
  dangerBtn: { height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 12 },

  // Reset password card
  resetCard: { borderWidth: 1.5, borderRadius: 12, overflow: "hidden", marginTop: 8 },
  resetCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  resetCardTitle: { fontSize: 15, fontWeight: "600" },
  resetCardBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },

  tempPwRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tempPwText: { flex: 1, fontSize: 16, fontWeight: "600", fontFamily: "monospace" },
  tempPwEye: { padding: 2 },
  generateBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  generateBtnText: { fontSize: 13, fontWeight: "600" },

  resetHint: { fontSize: 12, fontStyle: "italic" },
});
