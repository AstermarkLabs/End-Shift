import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Divider, TextInput } from "react-native-paper";

import { Ionicons } from "@expo/vector-icons";

import { getMe, listProfilePasskeys } from "@workspace/api-client-react";

import { describeApiError, useAuth } from "@/context/AuthContext";
import shape from "@/constants/shape";
import { typeStyle } from "@/constants/typography";
import { useMd } from "@/theme/useMd";

function showAlert(title: string, message: string) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message);
  }
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const md = useMd();
  const router = useRouter();
  const { signIn, signInWithPasskey, noAuthMode } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      style={[
        styles.container,
        { backgroundColor: md.surface, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 16 },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <View style={[styles.brandMark, { backgroundColor: md.primary, borderRadius: shape.lg }]}>
          <Ionicons name="shield-checkmark-outline" size={32} color={md.onPrimary} />
        </View>

        <Text style={[styles.title, typeStyle("headlineMedium"), { color: md.onSurface }]}>Welcome back</Text>
        <Text style={[styles.subtitle, typeStyle("bodyLarge"), { color: md.onSurfaceVariant }]}>
          Sign in to continue
        </Text>

        {error ? (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: md.errorContainer, borderRadius: shape.sm },
            ]}
          >
            <Text style={[styles.errorText, { color: md.onErrorContainer }]}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          mode="outlined"
          label="Username"
          value={username}
          onChangeText={(v) => { setUsername(v); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          placeholder="admin"
          style={styles.input}
        />

        <TextInput
          mode="outlined"
          label="Password"
          value={password}
          onChangeText={(v) => { setPassword(v); setError(null); }}
          secureTextEntry={!showPassword}
          editable={!busy}
          placeholder="••••••••"
          style={styles.input}
          right={
            <TextInput.Icon
              icon={showPassword ? "eye-off" : "eye"}
              onPress={() => setShowPassword((s) => !s)}
              forceTextInputFocus={false}
            />
          }
        />

        <Button
          mode="contained"
          onPress={onSubmit}
          disabled={busy}
          loading={busy}
          style={[styles.primaryBtn, { borderRadius: shape.full }]}
          contentStyle={styles.btnContent}
        >
          Sign in
        </Button>

        <Button
          mode="contained-tonal"
          onPress={onPasskey}
          disabled={busy}
          style={[styles.secondaryBtn, { borderRadius: shape.full }]}
          contentStyle={styles.btnContent}
        >
          Use a passkey
        </Button>

        <View style={styles.divider}>
          <Divider style={[styles.dividerLine, { backgroundColor: md.outlineVariant }]} />
          <Text style={[styles.dividerText, { color: md.onSurfaceVariant }]}>OR</Text>
          <Divider style={[styles.dividerLine, { backgroundColor: md.outlineVariant }]} />
        </View>

        <Button
          mode="outlined"
          onPress={() => router.push("/onboarding")}
          disabled={busy}
          style={[styles.createBtn, { borderRadius: shape.full }]}
          contentStyle={styles.btnContent}
        >
          Create an account
        </Button>

        {noAuthMode && (
          <Button
            mode="text"
            onPress={() => router.replace("/")}
            disabled={busy}
            style={styles.backToPersonalBtn}
          >
            Back to personal account
          </Button>
        )}

        <Text style={[styles.legalText, typeStyle("bodySmall"), { color: md.onSurfaceVariant }]}>
          By continuing you agree to the Terms and Privacy Policy.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingHorizontal: 24, gap: 8, maxWidth: 480, width: "100%", alignSelf: "center" },
  brandMark: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: { textAlign: "center", marginBottom: 4 },
  subtitle: { textAlign: "center", marginBottom: 24 },
  errorBox: { padding: 12, marginBottom: 4 },
  errorText: { ...typeStyle("bodyMedium"), fontFamily: "Inter_500Medium" },
  input: { marginTop: 12 },
  primaryBtn: { marginTop: 24 },
  secondaryBtn: { marginTop: 12 },
  btnContent: { height: 48 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 24, marginBottom: 8 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { ...typeStyle("labelMedium"), letterSpacing: 0.5 },
  createBtn: { marginTop: 0 },
  backToPersonalBtn: { marginTop: 4 },
  legalText: { textAlign: "center", marginTop: 16 },
});
