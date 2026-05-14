import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getMe, listProfilePasskeys } from "@workspace/api-client-react";

import { describeApiError, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function showAlert(title: string, message: string) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message);
  }
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const router = useRouter();
  const { signIn, signInWithPasskey } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maybePromptForPasskey = async () => {
    try {
      const me = await getMe();
      if (me.mustChangePassword) return;
      const list = await listProfilePasskeys(me.id);
      if (list.length > 0) return;
      Alert.alert(
        "Set up a passkey?",
        "You can sign in faster next time using a passkey on this device.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Set up", onPress: () => router.push("/profile") },
        ],
      );
    } catch {
      // Ignore — prompt is purely an enhancement.
    }
  };

  const onSubmit = async () => {
    setError(null);
    if (!username || !password) {
      setError("Username and password are required.");
      showAlert("Sign in", "Username and password are required.");
      return;
    }
    setBusy(true);
    try {
      await signIn(username.trim(), password);
      await maybePromptForPasskey();
    } catch (e) {
      const msg = describeApiError(e);
      setError(msg);
      showAlert("Sign in failed", msg);
    } finally {
      setBusy(false);
    }
  };

  const onPasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithPasskey(username.trim() || undefined);
    } catch (e) {
      const msg = describeApiError(e);
      setError(msg);
      showAlert("Passkey sign in failed", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 32 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.foreground }]}>End Shift</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to continue</Text>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive }]}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        ) : null}

        <Text style={[styles.label, { color: colors.foreground }]}>Username</Text>
        <TextInput
          value={username}
          onChangeText={(v) => { setUsername(v); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          style={[styles.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card }]}
          placeholder="admin"
          placeholderTextColor={colors.mutedForeground}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={(v) => { setPassword(v); setError(null); }}
          secureTextEntry
          editable={!busy}
          style={[styles.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card }]}
          placeholder="••••••••"
          placeholderTextColor={colors.mutedForeground}
        />

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Sign in</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={onPasskey}
          disabled={busy}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Use a passkey</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>OR</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <TouchableOpacity
          style={[styles.createBtn, { borderColor: colors.primary }]}
          onPress={() => router.push("/onboarding")}
          disabled={busy}
        >
          <Text style={[styles.createBtnText, { color: colors.primary }]}>Create an account</Text>
        </TouchableOpacity>

        <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
          By continuing you agree to the Terms and Privacy Policy.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingHorizontal: 24, gap: 8, maxWidth: 480, width: "100%", alignSelf: "center" },
  title: { fontSize: 32, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 16, marginBottom: 24 },
  errorBox: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 4 },
  errorText: { fontSize: 14, fontWeight: "500" },
  label: { fontSize: 14, fontWeight: "500", marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  primaryBtn: { marginTop: 24, height: 50, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 16, fontWeight: "600" },
  secondaryBtn: { marginTop: 12, height: 50, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  secondaryBtnText: { fontSize: 16, fontWeight: "500" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 24, marginBottom: 4 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  createBtn: { height: 50, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5, marginTop: 8 },
  createBtnText: { fontSize: 16, fontWeight: "600" },
  legalText: { fontSize: 12, textAlign: "center", marginTop: 16 },
});
