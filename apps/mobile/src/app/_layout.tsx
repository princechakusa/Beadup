import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LaunchIntro } from '@/components/LaunchIntro';
import { AuthProvider, useAuth } from '@/lib/auth';
import { listenForNotificationTaps } from '@/lib/push';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

// The opening animation plays once per cold start (not when returning from the background).
let introPlayed = false;

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
  const { session, loading, offline, hasProfile, demoSignedIn } = useAuth();
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
  const [introDone, setIntroDone] = useState(introPlayed);
  const [introShown, setIntroShown] = useState(false);

  useEffect(() => {
    // Keep the splash until fonts and the stored session are ready, so the
    // user never sees a flash of the sign-in screen while already signed in.
    // With the opening animation, also wait until its first frame (identical
    // to the launch screen) is on screen, so the hand-off is invisible.
    if (ready && (introDone || introShown)) SplashScreen.hideAsync().catch(() => {});
  }, [ready, introDone, introShown]);

  // Development builds without a backend open straight into the app preview.
  const signedIn = !!session || (offline && __DEV__ && demoSignedIn);

  useEffect(() => (ready && signedIn ? listenForNotificationTaps() : undefined), [ready, signedIn]);

  if (!ready) return null;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.midnight },
        }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !hasProfile}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && hasProfile} redirectTo={signedIn ? '/onboarding' : '/sign-in'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="quote" options={{ presentation: 'modal' }} />
          <Stack.Screen name="ai-consent" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pro" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings/index" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings/services" />
          <Stack.Screen name="settings/payment" />
          <Stack.Screen name="settings/profile" />
          <Stack.Screen name="settings/invite" />
          <Stack.Screen name="settings/availability" />
          <Stack.Screen name="settings/delete-account" />
          <Stack.Screen name="booking/[id]" />
          <Stack.Screen name="reschedule/[id]" />
          <Stack.Screen name="client/[id]" />
          <Stack.Screen name="reviews" />
          <Stack.Screen name="paid/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Screen name="auth/callback" options={{ animation: 'fade' }} />
      </Stack>
      {/* The app is already mounted underneath, so data loads while this plays. */}
      {!introDone && (
        <LaunchIntro
          onImageReady={() => setIntroShown(true)}
          onDone={() => {
            introPlayed = true;
            setIntroDone(true);
          }}
        />
      )}
    </>
  );
}

/**
 * Last line of defence: a render error anywhere shows this instead of closing
 * the app. The splash is hidden so the message is visible.
 */
export function ErrorBoundary({ retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
      <Text style={{ color: colors.paint, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>Something went wrong</Text>
      <Text style={{ color: colors.steel, fontSize: 15, textAlign: 'center' }}>Your data is safe. Try again, or close and reopen Beadup.</Text>
      <Pressable
        onPress={() => retry()}
        accessibilityRole="button"
        style={{ marginTop: 12, height: 48, paddingHorizontal: 28, borderRadius: 24, backgroundColor: colors.bead, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.beadInk, fontSize: 16, fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
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
