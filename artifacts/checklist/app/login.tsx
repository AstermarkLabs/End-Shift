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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const router = useRouter();
  const { signIn, signInWithPasskey } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const maybePromptForPasskey = async () => {
    // After a successful password sign-in, offer to set up a passkey on this
    // device when the user has none yet.  This is best-effort: if the lookup
    // fails (network, etc.) we just skip the prompt rather than block sign-in.
    try {
      const me = await getMe();
      if (me.mustChangePassword) return; // they'll be routed to /profile anyway
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
    if (!username || !password) {
      Alert.alert("Sign in", "Username and password are required.");
      return;
    }
    setBusy(true);
    try {
      await signIn(username.trim(), password);
      await maybePromptForPasskey();
    } catch (e) {
      Alert.alert("Sign in failed", describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onPasskey = async () => {
    setBusy(true);
    try {
      await signInWithPasskey(username.trim() || undefined);
    } catch (e) {
      Alert.alert("Passkey sign in failed", describeApiError(e));
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

        <Text style={[styles.label, { color: colors.foreground }]}>Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
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
          onChangeText={setPassword}
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingHorizontal: 24, gap: 8, maxWidth: 480, width: "100%", alignSelf: "center" },
  title: { fontSize: 32, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 16, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "500", marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  primaryBtn: { marginTop: 24, height: 50, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 16, fontWeight: "600" },
  secondaryBtn: { marginTop: 12, height: 50, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  secondaryBtnText: { fontSize: 16, fontWeight: "500" },
});
