import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { LanguageProvider } from '../src/context/LanguageContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </LanguageProvider>
  );
}
