import { Tabs } from 'expo-router/tabs';

import { GlassTabBar } from '@/components/nav/GlassTabBar';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.midnight }, animation: 'fade' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="clients" />
      <Tabs.Screen name="money" />
    </Tabs>
  );
}
