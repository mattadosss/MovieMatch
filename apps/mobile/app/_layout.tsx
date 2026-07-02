import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { MovieMatchProvider } from '@/context/movie-match-context';
import { AuthProvider } from '@/context/auth-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <MovieMatchProvider>
        <ThemeProvider value={DarkTheme}>
          <Stack screenOptions={{ contentStyle: { backgroundColor: '#0A0A0B' } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
            <Stack.Screen name="recommendation" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="similar" options={{ headerShown: false }} />
            <Stack.Screen name="genres" options={{ headerShown: false, presentation: 'modal' }} />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </MovieMatchProvider>
    </AuthProvider>
  );
}
