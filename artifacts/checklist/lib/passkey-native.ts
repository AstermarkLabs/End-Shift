// Native (iOS / Android) passkey integration via `react-native-passkeys`.
//
// This module is dynamically imported only when running on a native platform,
// so the web bundle never pulls in any native modules.  The library itself
// requires a custom Expo dev build (it cannot work in Expo Go because passkey
// APIs are platform-native).  When a passkey API call fails because the
// underlying module isn't available, we surface a clear, actionable error.

async function loadLib() {
  try {
    return await import("react-native-passkeys");
  } catch (err) {
    throw new Error(
      "Passkeys aren't available in this build. " +
        "They require a custom Expo dev build with the react-native-passkeys " +
        "config plugin (passkeys cannot run in Expo Go).",
    );
  }
}

export async function nativeRegister(opts: unknown): Promise<unknown> {
  const lib = await loadLib();
  const result = await lib.create(opts as Parameters<typeof lib.create>[0]);
  if (!result) throw new Error("Passkey registration was cancelled");
  return result;
}

export async function nativeAuthenticate(opts: unknown): Promise<unknown> {
  const lib = await loadLib();
  const result = await lib.get(opts as Parameters<typeof lib.get>[0]);
  if (!result) throw new Error("Passkey authentication was cancelled");
  return result;
}

export async function isPasskeySupported(): Promise<boolean> {
  try {
    const lib = await loadLib();
    return typeof lib.isSupported === "function" ? lib.isSupported() : true;
  } catch {
    return false;
  }
}
