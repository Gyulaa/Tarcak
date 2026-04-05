// @ts-nocheck
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AssetTypesScreen from '../screens/AssetTypesScreen';
import HistoryScreen from '../screens/HistoryScreen';
import HomeScreen from '../screens/HomeScreen';
import PocketDetailScreen from '../screens/PocketDetailScreen';
import PocketsScreen from '../screens/PocketsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TransactionEditorScreen from '../screens/TransactionEditorScreen';
import { font } from '../theme/fonts';
import { LockVaultContext } from './LockVaultContext';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function MainNavigator({ onLockVault }: { onLockVault: () => Promise<void> }) {
  return (
    <LockVaultContext.Provider value={onLockVault}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerTintColor: '#ff6f32',
            headerTitleStyle: { fontFamily: font.semibold },
            headerBackTitleStyle: { fontFamily: font.regular },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Tarcak' }} />
          <Stack.Screen name="Pockets" component={PocketsScreen} options={{ title: 'Pockets' }} />
          <Stack.Screen
            name="PocketDetail"
            component={PocketDetailScreen}
            options={{ title: 'Pocket' }}
          />
          <Stack.Screen
            name="TransactionEditor"
            component={TransactionEditorScreen}
            options={{ title: 'Transaction' }}
          />
          <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          <Stack.Screen
            name="AssetTypes"
            component={AssetTypesScreen}
            options={{ title: 'Asset types' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </LockVaultContext.Provider>
  );
}
