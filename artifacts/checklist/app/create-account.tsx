import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { register as apiRegister } from "@workspace/api-client-react";

import { describeApiError, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { saveStorageMode } from "@/utils/localChecklistStore";
import { PASSWORD_RULES, validatePassword } from "@/utils/passwordValidation";

export default function CreateAccountScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const router = useRouter();
  const { signIn } = useAuth();
  const isWeb = Platform.OS === "web";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    setError(null);
    if (!username.trim()) { setError("Username is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) { setError(pwCheck.errors[0]!); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setBusy(true);
    try {
      await apiRegister({
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        businessName: username.trim(),
        businessType: "single-unit",
      });
      await saveStorageMode("local");
      await signIn(username.trim().toLowerCase(), password);
      router.back();
    } catch (e) {
      setError(describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: isWeb ? 67 : insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Your local checklists will remain intact. Sign in with this account to access them.
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}>
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>USERNAME</Text>
          <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
            This is how you'll sign in. Keep it short and memorable.
          </Text>
          <TextInput
            value={username}
            onChangeText={(v) => { setUsername(v); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            style={[styles.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card }]}
            placeholder="yourname"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>EMAIL</Text>
          <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
            Used for account recovery only.
          </Text>
          <TextInput
            value={email}
            onChangeText={(v) => { setEmail(v); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!busy}
            style={[styles.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card }]}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PASSWORD</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              secureTextEntry={!showPassword}
              editable={!busy}
              style={[styles.input, styles.passwordInput, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="••••••••••••"
              placeholderTextColor={colors.mutedForeground}
            />
            <TouchableOpacity onPress={() => setShowPassword((s) => !s)} style={styles.showToggle}>
              <Text style={[styles.showToggleText, { color: colors.primary }]}>
                {showPassword ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
          </View>
          {password.length > 0 && (
            <View style={styles.rulesBox}>
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password);
                return (
                  <Text key={rule.label} style={[styles.ruleText, { color: met ? colors.primary : colors.mutedForeground }]}>
                    {met ? "✓" : "○"} {rule.label}
                  </Text>
                );
              })}
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CONFIRM PASSWORD</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); setError(null); }}
            secureTextEntry={!showPassword}
            editable={!busy}
            style={[
              styles.input,
              {
                borderColor: confirmPassword && confirmPassword !== password ? colors.destructive : colors.input,
                color: colors.foreground,
                backgroundColor: colors.card,
              },
            ]}
            placeholder="••••••••••••"
            placeholderTextColor={colors.mutedForeground}
          />

          <TouchableOpacity
            onPress={onContinue}
            disabled={busy}
            style={[styles.primaryBtn, { backgroundColor: busy ? colors.muted : colors.primary }]}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Create Account</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
            By continuing you agree to the Terms and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  backBtn: { width: 70 },
  backBtnText: { color: "#fff", fontSize: 17, fontWeight: "500" },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: "Inter_700Bold",
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
    gap: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 8,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
  },
  fieldHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  passwordInput: { flex: 1 },
  showToggle: { paddingHorizontal: 8, paddingVertical: 10 },
  showToggleText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  rulesBox: { gap: 4, paddingVertical: 4 },
  ruleText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  legalText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
});
