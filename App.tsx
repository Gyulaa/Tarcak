import {
  JetBrainsMono_400Regular,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
  useFonts,
} from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';

import AppBoot from './AppBoot';
import { applyJetBrainsMonoDefaults } from './src/theme/applyGlobalFont';

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });
  const appliedDefaults = useRef(false);

  const ready = fontsLoaded || fontError;

  if (fontsLoaded && !appliedDefaults.current) {
    applyJetBrainsMonoDefaults();
    appliedDefaults.current = true;
  }

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (fontError) {
      console.warn('[Tarcak] Font load failed, using system fonts.', fontError);
    }
    void SplashScreen.hideAsync();
  }, [ready, fontError]);

  if (!ready) {
    return null;
  }

  return <AppBoot />;
}
