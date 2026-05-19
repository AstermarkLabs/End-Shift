import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useRouter, useSegments } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { STORAGE_MODE_KEY } from "@/utils/localChecklistStore";
import {
  setAuthTokenGetter,
  setAuthRefreshHandler,
  setBaseUrl,
  ApiError,
  type Profile,
  login as apiLogin,
  logout as apiLogout,
  refresh as apiRefresh,
  getMe as apiGetMe,
  passkeyAuthOptions,
  passkeyAuthVerify,
} from "@workspace/api-client-react";

// ─── Storage ──────────────────────────────────────────────────────────────────
const ACCESS_KEY = "auth_access_token";
const REFRESH_KEY = "auth_refresh_token";
const PROFILE_KEY = "auth_profile";

// On web, the short-lived access token is kept in memory only (never written to
// any browser storage) so it cannot be read by same-origin scripts.  The
// refresh token and profile are stored in sessionStorage; sessionStorage is
// scoped to the browser tab and is not shared across sessions or windows.
async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    if (key === ACCESS_KEY) return null;
    try {
      return globalThis.sessionStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}
async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (key === ACCESS_KEY) return;
    try {
      globalThis.sessionStorage?.setItem(key, value);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
async function storageDel(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (key === ACCESS_KEY) return;
    try {
      globalThis.sessionStorage?.removeItem(key);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

// ─── API base URL setup ───────────────────────────────────────────────────────
function configureApiBaseUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    // Use the explicit domain on all platforms (native and EAS-hosted web).
    // On web without a domain configured, fall back to relative URLs so the
    // dev Metro server and Replit-hosted web build work without extra config.
    setBaseUrl(`https://${domain}`);
    return;
  }
  setBaseUrl(null);
}

// ─── Context type ─────────────────────────────────────────────────────────────
interface AuthContextValue {
  ready: boolean;
  profile: Profile | null;
  noAuthMode: boolean;
  setNoAuthMode: (v: boolean) => void;
  signIn: (username: string, password: string) => Promise<void>;
  signInWithPasskey: (username?: string) => Promise<void>;
  signOut: () => Promise<void>;
  setProfile: (p: Profile) => void;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [noAuthMode, setNoAuthMode] = useState(false);
  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);
  const refreshingRef = useRef<Promise<string | null> | null>(null);

  configureApiBaseUrl();

  const persistTokens = useCallback(
    async (access: string | null, refresh: string | null, p: Profile | null) => {
      accessRef.current = access;
      refreshRef.current = refresh;
      if (access) await storageSet(ACCESS_KEY, access);
      else await storageDel(ACCESS_KEY);
      if (refresh) await storageSet(REFRESH_KEY, refresh);
      else await storageDel(REFRESH_KEY);
      if (p) await storageSet(PROFILE_KEY, JSON.stringify(p));
      else await storageDel(PROFILE_KEY);
      setProfileState(p);
    },
    [],
  );

  const tryRefresh = useCallback(async (): Promise<string | null> => {
    if (refreshingRef.current) return refreshingRef.current;
    const refreshToken = refreshRef.current;
    if (!refreshToken) return null;
    refreshingRef.current = (async () => {
      try {
        const result = await apiRefresh({ refreshToken });
        accessRef.current = result.accessToken;
        refreshRef.current = result.refreshToken;
        await storageSet(ACCESS_KEY, result.accessToken);
        await storageSet(REFRESH_KEY, result.refreshToken);
        await storageSet(PROFILE_KEY, JSON.stringify(result.profile));
        setProfileState(result.profile);
        return result.accessToken;
      } catch {
        await persistTokens(null, null, null);
        return null;
      } finally {
        refreshingRef.current = null;
      }
    })();
    return refreshingRef.current;
  }, [persistTokens]);

  // Configure global token getter and refresh handler once.  The refresh
  // handler is invoked by the API client transparently on any 401 response.
  useEffect(() => {
    setAuthTokenGetter(async () => accessRef.current);
    setAuthRefreshHandler(async () => tryRefresh());
    return () => {
      setAuthTokenGetter(null);
      setAuthRefreshHandler(null);
    };
  }, [tryRefresh]);

  // Hydrate from storage on mount, then validate the session against the
  // server before marking ready so a stale/invalid token does not allow
  // protected routes to render.  customFetch will transparently attempt a
  // refresh on 401 (using the registered handler), so a single getMe() call
  // covers both "access still valid" and "access expired but refresh works".
  useEffect(() => {
    (async () => {
      try {
        const [a, r, p, modeRaw] = await Promise.all([
          storageGet(ACCESS_KEY),
          storageGet(REFRESH_KEY),
          storageGet(PROFILE_KEY),
          AsyncStorage.getItem(STORAGE_MODE_KEY),
        ]);
        setNoAuthMode(modeRaw === "local-no-auth");
        accessRef.current = a;
        refreshRef.current = r;
        if (p) {
          try {
            setProfileState(JSON.parse(p) as Profile);
          } catch {}
        }
        // Only attempt validation if we actually have any credential to check.
        if (a || r) {
          try {
            const me = await apiGetMe();
            setProfileState(me);
            await storageSet(PROFILE_KEY, JSON.stringify(me));
          } catch {
            // Both the access token and the refresh attempt (auto-triggered
            // by customFetch on 401) failed — clear all state so the user is
            // redirected to /login.
            await persistTokens(null, null, null);
          }
        }
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const result = await apiLogin({ username, password });
      await persistTokens(result.accessToken, result.refreshToken, result.profile);
    },
    [persistTokens],
  );

  const signInWithPasskey = useCallback(
    async (username?: string) => {
      const opts = await passkeyAuthOptions(username ? { username } : {});
      let assertion: unknown;
      if (Platform.OS === "web") {
        const browser = await import("@simplewebauthn/browser");
        assertion = await browser.startAuthentication({
          optionsJSON: opts as unknown as Parameters<
            typeof browser.startAuthentication
          >[0]["optionsJSON"],
        });
      } else {
        const native = await import("../lib/passkey-native");
        assertion = await native.nativeAuthenticate(opts);
      }
      const result = await passkeyAuthVerify({
        response: assertion as Record<string, unknown>,
        ...(username ? { username } : {}),
      });
      await persistTokens(result.accessToken, result.refreshToken, result.profile);
    },
    [persistTokens],
  );

  const signOut = useCallback(async () => {
    const refreshToken = refreshRef.current;
    // Best-effort server-side revocation: pass the current refresh token so
    // the server can invalidate it immediately. Even if this call fails the
    // local tokens are still cleared, ending the client session.
    try {
      await apiLogout(refreshToken ? { refreshToken } : undefined);
    } catch {
      // Ignore network errors — local sign-out proceeds regardless.
    }
    await persistTokens(null, null, null);
  }, [persistTokens]);

  const setProfile = useCallback(
    (p: Profile) => {
      setProfileState(p);
      void storageSet(PROFILE_KEY, JSON.stringify(p));
    },
    [],
  );

  const getAccessToken = useCallback(async () => {
    if (accessRef.current) return accessRef.current;
    return tryRefresh();
  }, [tryRefresh]);

  // Wrap the auth token getter to attempt refresh on 401 transparently by
  // re-installing it whenever access/refresh changes via persistTokens.
  // Components doing fetches that get a 401 should call tryRefresh themselves
  // or rely on react-query retry; for our purposes the standard token getter
  // is sufficient because refresh is also called on app start.

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      profile,
      noAuthMode,
      setNoAuthMode,
      signIn,
      signInWithPasskey,
      signOut,
      setProfile,
      getAccessToken,
    }),
    [ready, profile, noAuthMode, signIn, signInWithPasskey, signOut, setProfile, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function describeApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: string } | null;
    return data?.error ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

// ─── Route guard hook ─────────────────────────────────────────────────────────
export function useAuthRedirect() {
  const { ready, profile, noAuthMode } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuthScreen = segments[0] === "login";
    const inOnboardingScreen = segments[0] === "onboarding";
    const inProfileScreen = segments[0] === "profile";
    const inPublicScreen = inAuthScreen || inOnboardingScreen;
    if (!profile && !inPublicScreen && !noAuthMode) {
      router.replace("/login");
      return;
    }
    if (profile && inAuthScreen) {
      router.replace("/");
      return;
    }
    // Force users with a pending password change onto the profile screen
    // until they actually rotate their password.  The server also enforces
    // this with `blockIfMustChangePassword`, but redirecting here gives a
    // clean UX rather than a wall of 403s.
    if (profile?.mustChangePassword && !inProfileScreen && !inPublicScreen) {
      router.replace("/profile");
    }
  }, [ready, profile, segments, router, noAuthMode]);
}
