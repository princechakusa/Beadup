import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/lib/auth';
import { listenForNotificationTaps } from '@/lib/push';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.midnight,
    card: colors.gunmetal,
    text: colors.paint,
    border: colors.line,
    primary: colors.bead,
  },
};

function RootNavigator() {
  const { session, loading, offline, hasProfile } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const ready = (fontsLoaded || !!fontError) && !loading;

  useEffect(() => {
    // Keep the splash until fonts and the stored session are ready, so the
    // user never sees a flash of the sign-in screen while already signed in.
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Development builds without a backend open straight into the app preview.
  const signedIn = !!session || (offline && __DEV__);

  useEffect(() => (ready && signedIn ? listenForNotificationTaps() : undefined), [ready, signedIn]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.midnight } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasProfile}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && hasProfile} redirectTo={signedIn ? '/onboarding' : '/sign-in'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="quote" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings/index" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings/services" />
        <Stack.Screen name="settings/availability" />
        <Stack.Screen name="settings/delete-account" />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="client/[id]" />
        <Stack.Screen name="paid/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" options={{ animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.midnight }}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
