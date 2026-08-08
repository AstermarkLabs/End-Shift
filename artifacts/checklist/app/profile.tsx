import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  deleteProfilePasskey,
  listProfilePasskeys,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  updateMe,
  type PasskeyCredential,
} from "@workspace/api-client-react";

import { describeApiError, useAuth } from "@/context/AuthContext";
import shape from "@/constants/shape";
import { useMd } from "@/theme/useMd";
import { PASSWORD_RULES, validatePassword } from "@/utils/passwordValidation";

type EditField = "displayName" | "username" | "email" | null;
type ExpandSection = "password" | "passkeys" | null;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? "").toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const md = useMd();
  const router = useRouter();
  const { profile, setProfile, signOut, signInWithPasskey } = useAuth();
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === "web" && width >= 640;

  const [editField, setEditField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [expandSection, setExpandSection] = useState<ExpandSection>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);

  const loadPasskeys = async () => {
    if (!profile) return;
    try {
      const list = await listProfilePasskeys(profile.id);
      setPasskeys(list);
    } catch {}
  };

  useEffect(() => {
    void loadPasskeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (!profile) return null;

  const onStartEdit = (field: EditField, value: string) => {
    setEditField(field);
    setEditValue(value);
    setExpandSection(null);
  };

  const onCancelEdit = () => {
    setEditField(null);
    setEditValue("");
  };

  const onSaveField = async () => {
    if (!editField) return;
    const trimmed = editValue.trim();
    if (editField === "email" && trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert("Email", "Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, string | null> = {
        [editField]: editField === "email" ? (trimmed || null) : trimmed,
      };
      const updated = await updateMe(payload);
      setProfile(updated);
      setEditField(null);
      setEditValue("");
    } catch (e) {
      Alert.alert("Update failed", describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onChangePassword = async () => {
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      Alert.alert("Password", pwCheck.errors[0]!);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Password", "Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const updated = await updateMe({ currentPassword, newPassword });
      setProfile(updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setExpandSection(null);
      Alert.alert("Password", "Updated successfully.");
    } catch (e) {
      Alert.alert("Update failed", describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onRegisterPasskey = async () => {
    setBusy(true);
    try {
      const opts = await passkeyRegisterOptions();
      let attestation: unknown;
      let label: string;
      if (Platform.OS === "web") {
        const browser = await import("@simplewebauthn/browser");
        attestation = await browser.startRegistration({
          optionsJSON: opts as unknown as Parameters<
            typeof browser.startRegistration
          >[0]["optionsJSON"],
        });
        label = navigator?.userAgent?.slice(0, 80) ?? "Web passkey";
      } else {
        const native = await import("../lib/passkey-native");
        attestation = await native.nativeRegister(opts);
        label = `${Platform.OS} passkey`;
      }
      await passkeyRegisterVerify({
        response: attestation as Record<string, unknown>,
        label,
      });
      await loadPasskeys();
      Alert.alert("Passkey", "Registered successfully.");
    } catch (e) {
      Alert.alert("Passkey registration failed", describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onDeletePasskey = (cred: PasskeyCredential) => {
    Alert.alert("Delete passkey", "Remove this passkey?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            // Require fresh passkey proof-of-possession before allowing
            // removal — prevents a hijacked/left-open session from silently
            // stripping a user's second factor.
            await signInWithPasskey(profile.username);
          } catch (e) {
            setBusy(false);
            Alert.alert("Verification failed", describeApiError(e));
            return;
          }
          try {
            await deleteProfilePasskey(profile.id, cred.credentialId);
            await loadPasskeys();
          } catch (e) {
            Alert.alert("Delete failed", describeApiError(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const onSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const renderFieldRow = (
    label: string,
    field: "displayName" | "username" | "email",
    value: string,
    keyboardType: "default" | "email-address" = "default",
  ) => {
    const isEditing = editField === field;
    return (
      <View key={field} style={styles.fieldRow}>
        <View style={styles.fieldHeader}>
          <Text style={[styles.fieldLabel, { color: md.onSurfaceVariant }]}>{label}</Text>
          {!isEditing && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => onStartEdit(field, value)}
              disabled={busy}
            >
              <Text style={[styles.editButtonText, { color: md.primary }]}>✏ Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        {isEditing ? (
          <View style={styles.fieldEditArea}>
            <TextInput
              value={editValue}
              onChangeText={setEditValue}
              keyboardType={keyboardType}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!busy}
              placeholderTextColor={md.onSurfaceVariant}
              style={[
                styles.fieldInput,
                { borderRadius: shape.sm, borderColor: md.outline, color: md.onSurface, backgroundColor: md.surface },
              ]}
            />
            <View style={styles.fieldEditActions}>
              <TouchableOpacity
                style={[styles.saveBtn, { borderRadius: shape.sm, backgroundColor: md.primary, opacity: busy ? 0.6 : 1 }]}
                onPress={onSaveField}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={md.onPrimary} size="small" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: md.onPrimary }]}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderRadius: shape.sm, borderColor: md.outlineVariant }]}
                onPress={onCancelEdit}
                disabled={busy}
              >
                <Text style={[styles.actionBtnText, { color: md.onSurface }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={[styles.fieldValue, { color: value ? md.onSurface : md.onSurfaceVariant }]}>
            {value || (field === "email" ? "No email set" : "—")}
          </Text>
        )}
      </View>
    );
  };

  const renderPasswordForm = () => (
    <View style={[styles.expandedContent, { borderTopColor: md.outlineVariant }]}>
      <TextInput
        placeholder="Current password"
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
        editable={!busy}
        placeholderTextColor={md.onSurfaceVariant}
        style={[
          styles.fieldInput,
          { borderRadius: shape.sm, borderColor: md.outline, color: md.onSurface, backgroundColor: md.surface },
        ]}
      />
      <TextInput
        placeholder="New password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
        editable={!busy}
        placeholderTextColor={md.onSurfaceVariant}
        style={[
          styles.fieldInput,
          { borderRadius: shape.sm, borderColor: md.outline, color: md.onSurface, backgroundColor: md.surface, marginTop: 8 },
        ]}
      />
      {newPassword.length > 0 && (
        <View style={styles.rulesBox}>
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(newPassword);
            return (
              <Text key={rule.label} style={[styles.ruleText, { color: met ? md.primary : md.onSurfaceVariant }]}>
                {met ? "✓" : "○"} {rule.label}
              </Text>
            );
          })}
        </View>
      )}
      <TextInput
        placeholder="Confirm new password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!busy}
        placeholderTextColor={md.onSurfaceVariant}
        style={[
          styles.fieldInput,
          {
            borderRadius: shape.sm,
            borderColor: confirmPassword && confirmPassword !== newPassword ? md.error : md.outline,
            color: md.onSurface,
            backgroundColor: md.surface,
            marginTop: 8,
          },
        ]}
      />
      <TouchableOpacity
        style={[styles.saveBtn, { borderRadius: shape.sm, backgroundColor: md.primary, opacity: busy ? 0.6 : 1, marginTop: 12 }]}
        onPress={onChangePassword}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={md.onPrimary} size="small" />
        ) : (
          <Text style={[styles.actionBtnText, { color: md.onPrimary }]}>Update password</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderPasskeySection = () => (
    <View style={[styles.expandedContent, { borderTopColor: md.outlineVariant }]}>
      {passkeys.length === 0 && (
        <Text style={{ color: md.onSurfaceVariant, marginBottom: 8 }}>No passkeys registered.</Text>
      )}
      {passkeys.map((p) => (
        <View key={p.id} style={[styles.passkeyRow, { borderBottomColor: md.outlineVariant }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: md.onSurface, fontFamily: "Inter_500Medium" }} numberOfLines={1}>
              {p.label || "Passkey"}
            </Text>
            <Text style={{ color: md.onSurfaceVariant, fontSize: 12 }}>
              Added {new Date(p.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onDeletePasskey(p)} disabled={busy}>
            <Text style={{ color: md.error, fontFamily: "Inter_600SemiBold" }}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}
      {passkeys.length === 0 && (
        <TouchableOpacity
          style={[styles.cancelBtn, { borderRadius: shape.sm, borderColor: md.outlineVariant, marginTop: 8 }]}
          onPress={onRegisterPasskey}
          disabled={busy}
        >
          <Text style={[styles.actionBtnText, { color: md.onSurface }]}>
            {busy ? "Registering…" : "Register this device"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSecurityRow = (
    key: ExpandSection,
    icon: string,
    title: string,
    subtitle: string,
    badge: string | null,
  ) => (
    <TouchableOpacity
      style={styles.securityRow}
      onPress={() => {
        setExpandSection((s) => (s === key ? null : key));
        setEditField(null);
      }}
      disabled={busy}
    >
      <View style={[styles.securityIconWrap, { borderRadius: shape.sm, backgroundColor: md.surfaceContainerHighest }]}>
        <Text style={styles.securityIconText}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.securityTitle, { color: md.onSurface }]}>{title}</Text>
        <Text style={[styles.securitySubtitle, { color: md.onSurfaceVariant }]}>{subtitle}</Text>
      </View>
      {badge !== null && (
        <View style={[styles.badge, { backgroundColor: md.secondaryContainer }]}>
          <Text style={[styles.badgeText, { color: md.onSecondaryContainer }]}>{badge}</Text>
        </View>
      )}
      <Text style={[styles.chevron, { color: md.onSurfaceVariant }]}>{expandSection === key ? "∧" : "›"}</Text>
    </TouchableOpacity>
  );

  const avatarNode = (large?: boolean) => (
    <View style={[styles.avatarCircle, { backgroundColor: md.primary }, large && styles.avatarCircleLarge]}>
      <Text style={[styles.avatarText, { color: md.onPrimary }, large && styles.avatarTextLarge]}>
        {getInitials(profile.displayName)}
      </Text>
    </View>
  );

  const accountSection = (
    <View style={[styles.card, { borderRadius: shape.md, borderColor: md.outlineVariant, backgroundColor: md.surface }]}>
      {renderFieldRow("DISPLAY NAME", "displayName", profile.displayName)}
      <View style={[styles.fieldDivider, { backgroundColor: md.outlineVariant }]} />
      {renderFieldRow("USERNAME", "username", profile.username)}
      <View style={[styles.fieldDivider, { backgroundColor: md.outlineVariant }]} />
      {renderFieldRow("EMAIL", "email", profile.email ?? "", "email-address")}
    </View>
  );

  const securitySection = (
    <>
      {profile.mustChangePassword && (
        <View style={[styles.mustChangeBanner, { borderRadius: shape.sm, backgroundColor: md.primaryContainer }]}>
          <Text style={{ color: md.onPrimaryContainer, fontFamily: "Inter_600SemiBold" }}>
            You must change your password before continuing.
          </Text>
        </View>
      )}
      <View style={[styles.card, { borderRadius: shape.md, borderColor: md.outlineVariant, backgroundColor: md.surface }]}>
        {renderSecurityRow("password", "🔒", "Change Password", "Update your sign-in password", null)}
        {expandSection === "password" && renderPasswordForm()}
        <View style={[styles.fieldDivider, { backgroundColor: md.outlineVariant }]} />
        {renderSecurityRow(
          "passkeys",
          "🔑",
          "Passkeys",
          `${passkeys.length} registered`,
          passkeys.length > 0 ? String(passkeys.length) : null,
        )}
        {expandSection === "passkeys" && renderPasskeySection()}
      </View>
    </>
  );

  // ── Web Desktop ──────────────────────────────────────────────────────────────
  if (isWebDesktop) {
    const sidebarNavItems = [
      { icon: "👤", label: "Profile", onPress: () => setExpandSection(null) },
      { icon: "🔒", label: "Security", onPress: () => setExpandSection("password" as const) },
      { icon: "🕐", label: "History", onPress: () => router.navigate("/history") },
      { icon: "⚙️", label: "Settings", onPress: () => router.navigate("/settings") },
    ];

    return (
      <View style={[styles.webRoot, { backgroundColor: md.surface }]}>
        {/* Sidebar */}
        <View style={[styles.sidebar, { backgroundColor: md.surfaceContainerLow, borderRightColor: md.outlineVariant }]}>
          <ScrollView contentContainerStyle={styles.sidebarInner}>
            <View style={styles.sidebarIdentity}>
              {avatarNode(true)}
              <Text style={[styles.heroName, { color: md.onSurface }]}>{profile.displayName}</Text>
              <Text style={[styles.heroUsername, { color: md.onSurfaceVariant }]}>@{profile.username}</Text>
              <View style={[styles.pill, { borderRadius: shape.full, backgroundColor: md.surfaceContainerHighest }]}>
                <Text style={[styles.pillText, { color: md.onSurface }]}>{profile.role.name}</Text>
              </View>
              {profile.orgUnit && (
                <View style={[styles.pill, { borderRadius: shape.full, backgroundColor: md.surfaceContainerHighest }]}>
                  <Text style={[styles.pillText, { color: md.onSurface }]}>{profile.orgUnit.name}</Text>
                </View>
              )}
            </View>
            <View style={styles.sidebarNav}>
              {sidebarNavItems.map(({ icon, label, onPress }) => (
                <TouchableOpacity key={label} style={[styles.navLink, { borderRadius: shape.md }]} onPress={onPress}>
                  <Text style={styles.navLinkIcon}>{icon}</Text>
                  <Text style={[styles.navLinkLabel, { color: md.onSurface }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity style={[styles.sidebarSignOut, { borderTopColor: md.outlineVariant }]} onPress={onSignOut}>
            <Text style={styles.navLinkIcon}>🚪</Text>
            <Text style={[styles.navLinkLabel, { color: md.error }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Main Panel */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.webContent}>
          <View style={styles.webContentHeader}>
            <Text style={[styles.webTitle, { color: md.onSurface }]}>Profile</Text>
            {editField && (
              <TouchableOpacity
                style={[styles.saveChangesBtn, { borderRadius: shape.sm, backgroundColor: md.primary, opacity: busy ? 0.6 : 1 }]}
                onPress={onSaveField}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={md.onPrimary} size="small" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: md.onPrimary }]}>Save changes</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.sectionLabel, { color: md.primary }]}>ACCOUNT</Text>
          {accountSection}
          <Text style={[styles.sectionLabel, { color: md.primary }]}>SECURITY</Text>
          {securitySection}
        </ScrollView>
      </View>
    );
  }

  // ── Mobile Layout ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: md.surface }]}>
      {/* Header bar */}
      <View style={[styles.header, { backgroundColor: md.surfaceContainerLow, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerSide}>
          <Text style={[styles.headerBackText, { color: md.onSurface }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: md.onSurface }]}>Profile</Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          {editField ? (
            <TouchableOpacity onPress={onSaveField} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={md.onSurface} size="small" />
              ) : (
                <Text style={[styles.headerActionText, { color: md.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
        {/* Identity Hero */}
        <View style={styles.hero}>
          {avatarNode()}
          <Text style={[styles.heroName, { color: md.onSurface }]}>{profile.displayName}</Text>
          <Text style={[styles.heroUsername, { color: md.onSurfaceVariant }]}>@{profile.username}</Text>
          <Text style={[styles.heroRole, { color: md.onSurfaceVariant }]}>{profile.role.name}</Text>
          {profile.orgUnit && <Text style={[styles.heroLocation, { color: md.onSurfaceVariant }]}>{profile.orgUnit.name}</Text>}
        </View>

        {/* ACCOUNT */}
        <Text style={[styles.sectionLabel, { color: md.primary }]}>ACCOUNT</Text>
        {accountSection}

        {/* SECURITY */}
        <Text style={[styles.sectionLabel, { color: md.primary }]}>SECURITY</Text>
        {securitySection}

        {/* SESSION */}
        <Text style={[styles.sectionLabel, { color: md.primary }]}>SESSION</Text>
        <View style={[styles.card, { borderRadius: shape.md, borderColor: md.outlineVariant, backgroundColor: md.surface }]}>
          <TouchableOpacity style={styles.securityRow} onPress={onSignOut}>
            <View style={[styles.securityIconWrap, { borderRadius: shape.sm, backgroundColor: md.surfaceContainerHighest }]}>
              <Text style={styles.securityIconText}>🚪</Text>
            </View>
            <Text style={[styles.securityTitle, { color: md.error }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webRoot: { flex: 1, flexDirection: "row" },

  // Mobile header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerSide: { width: 70 },
  headerSideRight: { alignItems: "flex-end" },
  headerBackText: { fontSize: 16 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontFamily: "Inter_600SemiBold" },
  headerActionText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },

  scrollContent: { paddingHorizontal: 16, paddingTop: 24 },

  // Hero
  hero: { alignItems: "center", paddingBottom: 28, gap: 4 },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarCircleLarge: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { fontSize: 26, fontFamily: "Inter_700Bold" },
  avatarTextLarge: { fontSize: 30 },
  heroName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  heroUsername: { fontSize: 15 },
  heroRole: { fontSize: 14, marginTop: 2 },
  heroLocation: { fontSize: 14 },

  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 6,
    marginLeft: 4,
  },

  // Cards
  card: { borderWidth: 1, overflow: "hidden" },

  // Field rows (inside card)
  fieldRow: { paddingHorizontal: 16, paddingVertical: 12 },
  fieldDivider: { height: StyleSheet.hairlineWidth },
  fieldHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  fieldValue: { fontSize: 16, fontFamily: "Inter_500Medium", marginTop: 3 },
  editButton: { paddingVertical: 2, paddingLeft: 8 },
  editButtonText: { fontSize: 13 },
  fieldEditArea: { marginTop: 8, gap: 8 },
  fieldInput: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  fieldEditActions: { flexDirection: "row", gap: 8 },
  saveBtn: { flex: 1, height: 38, alignItems: "center", justifyContent: "center" },
  cancelBtn: { flex: 1, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Security rows (inside card)
  securityRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  securityIconWrap: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  securityIconText: { fontSize: 18 },
  securityTitle: { fontSize: 15, fontFamily: "Inter_500Medium" },
  securitySubtitle: { fontSize: 13, marginTop: 1 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  chevron: { fontSize: 18 },

  // Expanded security content
  expandedContent: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  rulesBox: { gap: 3, marginTop: 6 },
  ruleText: { fontSize: 12 },
  passkeyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  mustChangeBanner: { padding: 12, marginBottom: 8 },

  // Web sidebar
  sidebar: { width: 280, borderRightWidth: 1 },
  sidebarInner: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 16 },
  sidebarIdentity: { alignItems: "center", gap: 4, paddingBottom: 28 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  pillText: { fontSize: 13 },
  sidebarNav: { gap: 2 },
  navLink: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  navLinkIcon: { fontSize: 16 },
  navLinkLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  sidebarSignOut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderTopWidth: 1,
  },

  // Web main content
  webContent: { padding: 40 },
  webContentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  webTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  saveChangesBtn: { paddingHorizontal: 20, paddingVertical: 10 },
});
