import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
  ThemeProvider as NavThemeProvider,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useMemo } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth, useAuthRedirect } from "@/context/AuthContext";
import { ChecklistProvider } from "@/context/ChecklistContext";
import { OnboardingProvider } from "@/context/OnboardingContext";
import { useAppThemeConfig } from "@/theme/paperTheme";

// Resolves the MD3 Paper theme (color scheme + per-tenant brand color) and
// provides it via PaperProvider. Must render inside ChecklistProvider, since
// the brand-color seed comes from ChecklistContext's appConfig.
function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppThemeConfig();

  // Navigation chrome (screen backgrounds, card transitions) reads React
  // Navigation's own theme, not Paper's — derive it from the same M3 roles so
  // the two never disagree during a push/modal transition.
  const navTheme = useMemo(() => {
    const base = theme.dark ? NavDarkTheme : NavDefaultTheme;
    return {
      ...base,
      dark: theme.dark,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.extendedColors.surfaceContainer,
        text: theme.colors.onSurface,
        border: theme.colors.outlineVariant,
        notification: theme.colors.error,
      },
    };
  }, [theme]);

  return (
    <PaperProvider theme={theme}>
      <NavThemeProvider value={navTheme}>
        {/* No Portal.Host here — PaperProvider already mounts one above this
            point. A nested host would live inside BottomSheetModalProvider and
            stack Paper dialogs *below* an open bottom sheet. */}
        <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
      </NavThemeProvider>
    </PaperProvider>
  );
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { ready } = useAuth();
  useAuthRedirect();
  if (!ready) return null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile"
        options={{ headerShown: false, presentation: Platform.OS === "web" ? undefined : "modal" }}
      />
      <Stack.Screen name="admin" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen
        name="checklist-settings"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="import-checklist"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="create-account"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="export-settings"
        options={{ headerShown: false, presentation: "modal" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <AuthProvider>
                <ChecklistProvider>
                  <AppThemeProvider>
                    <OnboardingProvider>
                      <RootLayoutNav />
                    </OnboardingProvider>
                  </AppThemeProvider>
                </ChecklistProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
