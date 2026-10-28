import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

/** Turns the screenshot, recording and recent-apps-preview block on or off (Android `FLAG_SECURE`). */
export async function applyScreenCaptureBlock(blocked: boolean): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  if (blocked) {
    await ScreenCapture.preventScreenCaptureAsync();
  } else {
    await ScreenCapture.allowScreenCaptureAsync();
  }
}
