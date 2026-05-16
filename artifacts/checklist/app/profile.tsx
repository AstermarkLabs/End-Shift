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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const router = useRouter();
  const { profile, setProfile, signOut } = useAuth();

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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Display name</Text>
        <Text style={[styles.value, { color: colors.foreground }]}>{profile.displayName}</Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Username</Text>
        <Text style={[styles.value, { color: colors.foreground }]}>{profile.username}</Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Role</Text>
        <Text style={[styles.value, { color: colors.foreground }]}>{profile.role.name}</Text>
      </View>

      {profile.mustChangePassword && (
        <View style={[styles.banner, { backgroundColor: colors.secondary }]}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>
            You must change your password before continuing.
          </Text>
        </View>
      )}

      <Text style={[styles.section, { color: colors.foreground }]}>Change password</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          placeholder="Current password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
          editable={!busy}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.input, color: colors.foreground }]}
        />
        <TextInput
          placeholder="New password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          editable={!busy}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.input, color: colors.foreground }]}
        />
        {newPassword.length > 0 && (
          <View style={styles.rulesBox}>
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(newPassword);
              return (
                <Text
                  key={rule.label}
                  style={[styles.ruleText, { color: met ? colors.primary : colors.mutedForeground }]}
                >
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
          style={[styles.input, { borderColor: confirmPassword && confirmPassword !== newPassword ? colors.destructive : colors.input, color: colors.foreground }]}
        />
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
          onPress={onChangePassword}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Update password</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>Passkeys</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {passkeys.length === 0 && (
          <Text style={{ color: colors.mutedForeground }}>No passkeys registered.</Text>
        )}
        {passkeys.map((p) => (
          <View key={p.id} style={styles.passkeyRow}>
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
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={onRegisterPasskey}
          disabled={busy}
        >
          <Text style={{ color: colors.foreground, fontWeight: "500" }}>Register this device</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.dangerBtn, { backgroundColor: colors.destructive }]}
        onPress={async () => {
          await signOut();
          router.replace("/login");
        }}
      >
        <Text style={{ color: colors.destructiveForeground, fontWeight: "600" }}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title: { fontSize: 28, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 },
  label: { fontSize: 12, marginTop: 4 },
  value: { fontSize: 16, fontWeight: "500" },
  banner: { borderRadius: 10, padding: 12, marginTop: 4 },
  section: { fontSize: 18, fontWeight: "600", marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  rulesBox: { gap: 3, marginTop: 2, marginBottom: 2 },
  ruleText: { fontSize: 12 },
  primaryBtn: { height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryBtnText: { fontSize: 16, fontWeight: "600" },
  secondaryBtn: { height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, marginTop: 8 },
  dangerBtn: { marginTop: 24, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  passkeyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
});
