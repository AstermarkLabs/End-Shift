import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, IconButton, TextInput } from "react-native-paper";

import { Ionicons } from "@expo/vector-icons";

import { register as apiRegister } from "@workspace/api-client-react";

import { describeApiError, useAuth } from "@/context/AuthContext";
import { useChecklist } from "@/context/ChecklistContext";
import shape from "@/constants/shape";
import { typeStyle } from "@/constants/typography";
import { useMd } from "@/theme/useMd";
import { saveStorageMode } from "@/utils/localChecklistStore";
import { PASSWORD_RULES, validatePassword } from "@/utils/passwordValidation";

function toAppTitle(name: string): string {
  const n = name.trim();
  if (!n) return "My Day";
  return n.endsWith("s") ? `${n}' Day` : `${n}'s Day`;
}

export default function CreateAccountScreen() {
  const insets = useSafeAreaInsets();
  const md = useMd();
  const router = useRouter();
  const { signIn, setNoAuthMode } = useAuth();
  const { updateAppConfig } = useChecklist();
  const isWeb = Platform.OS === "web";

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    setError(null);
    if (!displayName.trim()) { setError("Your name is required."); return; }
    if (!username.trim()) { setError("Username is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) { setError(pwCheck.errors[0]!); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    const title = toAppTitle(displayName);
    setBusy(true);
    try {
      await apiRegister({
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        businessName: title,
        businessType: "single-unit",
      });
      await saveStorageMode("local");
      setNoAuthMode(false);
      await signIn(username.trim().toLowerCase(), password);
      updateAppConfig({ name: title });
      router.back();
    } catch (e) {
      setError(describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: md.surface }]}>
      <View style={[styles.header, { backgroundColor: md.primary, paddingTop: isWeb ? 67 : insets.top }]}>
        <IconButton
          icon={() => <Ionicons name="chevron-back" size={22} color={md.onPrimary} />}
          onPress={() => router.back()}
          style={styles.backBtn}
        />
        <Text style={[styles.headerTitle, typeStyle("titleLarge"), { color: md.onPrimary }]}>Create account</Text>
        <View style={styles.backBtnSpacer} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.subtitle, typeStyle("bodyMedium"), { color: md.onSurfaceVariant }]}>
            Your local checklists will remain intact. Sign in with this account to access them.
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: md.errorContainer, borderRadius: shape.sm }]}>
              <Text style={[styles.errorText, { color: md.onErrorContainer }]}>{error}</Text>
            </View>
          ) : null}

          <Text style={[styles.fieldHint, { color: md.onSurfaceVariant }]}>
            {displayName.trim()
              ? `Your app will be called "${toAppTitle(displayName)}"`
              : "Used as your app title — e.g. Alice's Day"}
          </Text>
          <TextInput
            mode="outlined"
            label="Your name"
            value={displayName}
            onChangeText={(v) => { setDisplayName(v); setError(null); }}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!busy}
            placeholder="Alice"
            style={styles.input}
          />

          <Text style={[styles.fieldHint, { color: md.onSurfaceVariant }]}>
            This is how you'll sign in. Keep it short and memorable.
          </Text>
          <TextInput
            mode="outlined"
            label="Username"
            value={username}
            onChangeText={(v) => { setUsername(v); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            placeholder="yourname"
            style={styles.input}
          />

          <Text style={[styles.fieldHint, { color: md.onSurfaceVariant }]}>
            Used for account recovery only.
          </Text>
          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            onChangeText={(v) => { setEmail(v); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!busy}
            placeholder="you@example.com"
            style={styles.input}
          />

          <TextInput
            mode="outlined"
            label="Password"
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
            secureTextEntry={!showPassword}
            editable={!busy}
            placeholder="••••••••••••"
            style={styles.input}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword((s) => !s)}
                forceTextInputFocus={false}
              />
            }
          />
          {password.length > 0 && (
            <View style={styles.rulesBox}>
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password);
                return (
                  <Text key={rule.label} style={[styles.ruleText, { color: met ? md.primary : md.onSurfaceVariant }]}>
                    {met ? "✓" : "○"} {rule.label}
                  </Text>
                );
              })}
            </View>
          )}

          <TextInput
            mode="outlined"
            label="Confirm password"
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); setError(null); }}
            secureTextEntry={!showPassword}
            editable={!busy}
            placeholder="••••••••••••"
            style={styles.input}
            error={Boolean(confirmPassword) && confirmPassword !== password}
          />

          <Button
            mode="contained"
            onPress={onContinue}
            disabled={busy}
            loading={busy}
            style={[styles.primaryBtn, { borderRadius: shape.full }]}
            contentStyle={styles.btnContent}
          >
            Create account
          </Button>

          <Text style={[styles.legalText, typeStyle("bodySmall"), { color: md.onSurfaceVariant }]}>
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
    paddingHorizontal: 4,
    paddingBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  backBtn: { margin: 0 },
  backBtnSpacer: { width: 40 },
  headerTitle: {
    ...typeStyle("titleLarge"),
    flex: 1,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginRight: 40,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
    gap: 8,
  },
  subtitle: {
    lineHeight: 20,
    marginBottom: 8,
  },
  errorBox: {
    padding: 12,
    marginBottom: 4,
  },
  errorText: typeStyle("bodyMedium"),
  fieldHint: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {},
  rulesBox: { gap: 4, paddingVertical: 4 },
  ruleText: typeStyle("bodySmall"),
  primaryBtn: {
    marginTop: 16,
  },
  btnContent: { height: 48 },
  legalText: {
    textAlign: "center",
    marginTop: 8,
  },
});
