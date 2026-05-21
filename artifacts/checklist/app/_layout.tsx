import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth, useAuthRedirect } from "@/context/AuthContext";
import { ChecklistProvider } from "@/context/ChecklistContext";
import { OnboardingProvider } from "@/context/OnboardingContext";

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
        name="settings"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="checklist-settings"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="history"
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
                  <OnboardingProvider>
                    <RootLayoutNav />
                  </OnboardingProvider>
                </ChecklistProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
