import { StyleSheet, Text, TextInput } from 'react-native';

import { font } from './fonts';

type WithDefaultProps = {
  defaultProps?: { allowFontScaling?: boolean; style?: object | object[] | undefined };
};

/**
 * Default body / input face. Semibold and bold use explicit `fontFamily` in StyleSheets.
 */
export function applyJetBrainsMonoDefaults(): void {
  const base = { fontFamily: font.regular };
  const T = Text as typeof Text & WithDefaultProps;
  T.defaultProps = {
    ...(T.defaultProps ?? {}),
    style: StyleSheet.flatten([base, T.defaultProps?.style]),
  };
  const TI = TextInput as typeof TextInput & WithDefaultProps;
  TI.defaultProps = {
    ...(TI.defaultProps ?? {}),
    style: StyleSheet.flatten([base, TI.defaultProps?.style]),
  };
}
