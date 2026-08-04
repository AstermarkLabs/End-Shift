/* Native (iOS / Android) passkey integration via `react-native-passkeys`.
 * This module is dynamically imported only when running on a native platform,
 * so the web bundle never pulls in any native modules.  The library ships no
 * Expo config plugin (autolinked purely via its expo-module.config.json) but
 * still requires a custom Expo dev build — it cannot work in Expo Go because
 * passkey APIs are platform-native.  When a passkey API call fails because the
 * underlying module isn't available, we surface a clear, actionable error.
 *                                                                          */

async function loadLib(): Promise<Record<string, unknown>> {
  try {
    const module = (await import("react-native-passkeys")) as unknown as Record<
      string,
      unknown
    >;
    const inner = module["default"];
    const flat =
      inner && typeof inner === "object" ? (inner as Record<string, unknown>) : undefined;
    return { ...flat, ...module };
  } catch (err) {
    throw new Error(
      "Passkeys aren't available in this build. " +
        "They require a custom Expo dev build with native passkey module " +
        "support compiled in (passkeys cannot run in Expo Go).",
    );
  }
}

function getFn(lib: Record<string, unknown>, name: string): (...args: unknown[]) => unknown {
  const fn = lib[name];
  if (typeof fn !== "function") {
    throw new Error(
      `Passkeys aren't available in this build. Native module loaded but "${name}" ` +
        "is missing — likely a stale dev client built before react-native-passkeys " +
        "was added. Rebuild with `expo prebuild --clean && expo run:android`.",
    );
  }
  return fn as (...args: unknown[]) => unknown;
}

export async function nativeRegister(opts: unknown): Promise<unknown> {
  const lib = await loadLib();
  const result = await getFn(lib, "create")(opts);
  if (!result) throw new Error("Passkey registration was cancelled");
  return result;
}

export async function nativeAuthenticate(opts: unknown): Promise<unknown> {
  const lib = await loadLib();
  const result = await getFn(lib, "get")(opts);
  if (!result) throw new Error("Passkey authentication was cancelled");
  return result;
}

export async function isPasskeySupported(): Promise<boolean> {
  try {
    const lib = await loadLib();
    return typeof lib["isSupported"] === "function"
      ? (lib["isSupported"] as () => boolean)()
      : true;
  } catch {
    return false;
  }
}
