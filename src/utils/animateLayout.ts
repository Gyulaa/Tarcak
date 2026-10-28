import { AccessibilityInfo, LayoutAnimation } from 'react-native';

let reduceMotion = false;

AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => {
    reduceMotion = on;
  })
  .catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
  reduceMotion = on;
});

/** Animates the next layout change (a panel opening), unless the system asks for reduced motion. */
export function animateNextLayout(): void {
  if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}
