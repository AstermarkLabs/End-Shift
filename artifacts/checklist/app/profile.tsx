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
import { useColors } from "@/hooks/useColors";
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
  const colors = useColors();
  const router = useRouter();
  const { profile, setProfile, signOut } = useAuth();
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
          try {
            await deleteProfilePasskey(profile.id, cred.credentialId);
            await loadPasskeys();
          } catch (e) {
            Alert.alert("Delete failed", describeApiError(e));
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
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
          {!isEditing && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => onStartEdit(field, value)}
              disabled={busy}
            >
              <Text style={[styles.editButtonText, { color: colors.mutedForeground }]}>✏ Edit</Text>
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
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.fieldInput,
                { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.background },
              ]}
            />
            <View style={styles.fieldEditActions}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
                onPress={onSaveField}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={onCancelEdit}
                disabled={busy}
              >
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text
            style={[
              styles.fieldValue,
              { color: value ? colors.foreground : colors.mutedForeground },
            ]}
          >
            {value || (field === "email" ? "No email set" : "—")}
          </Text>
        )}
      </View>
    );
  };

  const renderPasswordForm = () => (
    <View style={[styles.expandedContent, { borderTopColor: colors.border }]}>
      <TextInput
        placeholder="Current password"
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
        editable={!busy}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.fieldInput,
          { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.background },
        ]}
      />
      <TextInput
        placeholder="New password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
        editable={!busy}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.fieldInput,
          { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.background, marginTop: 8 },
        ]}
      />
      {newPassword.length > 0 && (
        <View style={styles.rulesBox}>
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(newPassword);
            return (
              <Text key={rule.label} style={[styles.ruleText, { color: met ? colors.primary : colors.mutedForeground }]}>
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
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.fieldInput,
          {
            borderColor:
              confirmPassword && confirmPassword !== newPassword ? colors.destructive : colors.input,
            color: colors.foreground,
            backgroundColor: colors.background,
            marginTop: 8,
          },
        ]}
      />
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1, marginTop: 12 }]}
        onPress={onChangePassword}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.primaryForeground} size="small" />
        ) : (
          <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Update password</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderPasskeySection = () => (
    <View style={[styles.expandedContent, { borderTopColor: colors.border }]}>
      {passkeys.length === 0 && (
        <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>No passkeys registered.</Text>
      )}
      {passkeys.map((p) => (
        <View
          key={p.id}
          style={[styles.passkeyRow, { borderBottomColor: colors.border }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: "500" }} numberOfLines={1}>
              {p.label || "Passkey"}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              Added {new Date(p.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onDeletePasskey(p)}>
            <Text style={{ color: colors.destructive, fontWeight: "600" }}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={[styles.cancelBtn, { borderColor: colors.border, marginTop: 8 }]}
        onPress={onRegisterPasskey}
        disabled={busy}
      >
        <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
          {busy ? "Registering…" : "Register this device"}
        </Text>
      </TouchableOpacity>
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
      <View style={[styles.securityIconWrap, { backgroundColor: colors.muted }]}>
        <Text style={styles.securityIconText}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.securityTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.securitySubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>
      {badge !== null && (
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.badgeText, { color: colors.foreground }]}>{badge}</Text>
        </View>
      )}
      <Text style={[styles.chevron, { color: colors.mutedForeground }]}>
        {expandSection === key ? "∧" : "›"}
      </Text>
    </TouchableOpacity>
  );

  const avatarNode = (large?: boolean) => (
    <View
      style={[
        styles.avatarCircle,
        { backgroundColor: colors.primary },
        large && styles.avatarCircleLarge,
      ]}
    >
      <Text style={[styles.avatarText, large && styles.avatarTextLarge]}>
        {getInitials(profile.displayName)}
      </Text>
    </View>
  );

  const accountSection = (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {renderFieldRow("DISPLAY NAME", "displayName", profile.displayName)}
      <View style={[styles.fieldDivider, { backgroundColor: colors.border }]} />
      {renderFieldRow("USERNAME", "username", profile.username)}
      <View style={[styles.fieldDivider, { backgroundColor: colors.border }]} />
      {renderFieldRow("EMAIL", "email", profile.email ?? "", "email-address")}
    </View>
  );

  const securitySection = (
    <>
      {profile.mustChangePassword && (
        <View style={[styles.mustChangeBanner, { backgroundColor: colors.secondary }]}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>
            You must change your password before continuing.
          </Text>
        </View>
      )}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {renderSecurityRow("password", "🔒", "Change Password", "Update your sign-in password", null)}
        {expandSection === "password" && renderPasswordForm()}
        <View style={[styles.fieldDivider, { backgroundColor: colors.border }]} />
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
      { icon: "🕐", label: "History", onPress: () => router.push("/history") },
      { icon: "⚙️", label: "Settings", onPress: () => router.push("/settings") },
    ];

    return (
      <View style={[styles.webRoot, { backgroundColor: colors.background }]}>
        {/* Sidebar */}
        <View style={[styles.sidebar, { backgroundColor: colors.card, borderRightColor: colors.border }]}>
          <ScrollView contentContainerStyle={styles.sidebarInner}>
            <View style={styles.sidebarIdentity}>
              {avatarNode(true)}
              <Text style={[styles.heroName, { color: colors.foreground }]}>{profile.displayName}</Text>
              <Text style={[styles.heroUsername, { color: colors.mutedForeground }]}>
                @{profile.username}
              </Text>
              <View style={[styles.pill, { backgroundColor: colors.muted }]}>
                <Text style={[styles.pillText, { color: colors.foreground }]}>{profile.role.name}</Text>
              </View>
              {profile.orgUnit && (
                <View style={[styles.pill, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.pillText, { color: colors.foreground }]}>
                    {profile.orgUnit.name}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.sidebarNav}>
              {sidebarNavItems.map(({ icon, label, onPress }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.navLink, { borderRadius: colors.radius }]}
                  onPress={onPress}
                >
                  <Text style={styles.navLinkIcon}>{icon}</Text>
                  <Text style={[styles.navLinkLabel, { color: colors.foreground }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity
            style={[styles.sidebarSignOut, { borderTopColor: colors.border }]}
            onPress={onSignOut}
          >
            <Text style={styles.navLinkIcon}>🚪</Text>
            <Text style={[styles.navLinkLabel, { color: colors.destructive }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Main Panel */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.webContent}>
          <View style={styles.webContentHeader}>
            <Text style={[styles.webTitle, { color: colors.foreground }]}>Profile</Text>
            {editField && (
              <TouchableOpacity
                style={[styles.saveChangesBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
                onPress={onSaveField}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>
                    Save changes
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
          {accountSection}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SECURITY</Text>
          {securitySection}
        </ScrollView>
      </View>
    );
  }

  // ── Mobile Layout ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header bar */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerSide}>
          <Text style={styles.headerBackText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          {editField ? (
            <TouchableOpacity onPress={onSaveField} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.headerActionText}>Save</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
        {/* Identity Hero */}
        <View style={styles.hero}>
          {avatarNode()}
          <Text style={[styles.heroName, { color: colors.foreground }]}>{profile.displayName}</Text>
          <Text style={[styles.heroUsername, { color: colors.mutedForeground }]}>
            @{profile.username}
          </Text>
          <Text style={[styles.heroRole, { color: colors.mutedForeground }]}>
            {profile.role.name}
          </Text>
          {profile.orgUnit && (
            <Text style={[styles.heroLocation, { color: colors.mutedForeground }]}>
              {profile.orgUnit.name}
            </Text>
          )}
        </View>

        {/* ACCOUNT */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
        {accountSection}

        {/* SECURITY */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SECURITY</Text>
        {securitySection}

        {/* SESSION */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SESSION</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.securityRow} onPress={onSignOut}>
            <View style={[styles.securityIconWrap, { backgroundColor: colors.muted }]}>
              <Text style={styles.securityIconText}>🚪</Text>
            </View>
            <Text style={[styles.securityTitle, { color: colors.destructive }]}>Sign Out</Text>
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
  headerBackText: { color: "#fff", fontSize: 16 },
  headerTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 17, fontWeight: "600" },
  headerActionText: { color: "#fff", fontSize: 16, fontWeight: "600" },

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
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "700" },
  avatarTextLarge: { fontSize: 30 },
  heroName: { fontSize: 22, fontWeight: "700" },
  heroUsername: { fontSize: 15 },
  heroRole: { fontSize: 14, marginTop: 2 },
  heroLocation: { fontSize: 14 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 6,
    marginLeft: 4,
  },

  // Cards
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },

  // Field rows (inside card)
  fieldRow: { paddingHorizontal: 16, paddingVertical: 12 },
  fieldDivider: { height: StyleSheet.hairlineWidth },
  fieldHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  fieldValue: { fontSize: 16, fontWeight: "500", marginTop: 3 },
  editButton: { paddingVertical: 2, paddingLeft: 8 },
  editButtonText: { fontSize: 13 },
  fieldEditArea: { marginTop: 8, gap: 8 },
  fieldInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  fieldEditActions: { flexDirection: "row", gap: 8 },
  saveBtn: { flex: 1, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cancelBtn: { flex: 1, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  actionBtnText: { fontSize: 14, fontWeight: "600" },

  // Security rows (inside card)
  securityRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  securityIconWrap: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  securityIconText: { fontSize: 18 },
  securityTitle: { fontSize: 15, fontWeight: "500" },
  securitySubtitle: { fontSize: 13, marginTop: 1 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { fontSize: 12, fontWeight: "600" },
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

  mustChangeBanner: { borderRadius: 10, padding: 12, marginBottom: 8 },

  // Web sidebar
  sidebar: { width: 280, borderRightWidth: 1 },
  sidebarInner: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 16 },
  sidebarIdentity: { alignItems: "center", gap: 4, paddingBottom: 28 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 2 },
  pillText: { fontSize: 13 },
  sidebarNav: { gap: 2 },
  navLink: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  navLinkIcon: { fontSize: 16 },
  navLinkLabel: { fontSize: 15, fontWeight: "500" },
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
  webTitle: { fontSize: 26, fontWeight: "700" },
  saveChangesBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
});
