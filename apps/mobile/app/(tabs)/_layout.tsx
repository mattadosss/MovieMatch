import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.red,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border, height: 72, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Für dich',
          tabBarIcon: ({ color, size }) => <Ionicons size={size} name="sparkles" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Import',
          tabBarIcon: ({ color, size }) => <Ionicons size={size} name="cloud-upload-outline" color={color} />,
        }}
      />
      <Tabs.Screen name="history" options={{
        title: 'Verlauf',
        tabBarIcon: ({ color, size }) => <Ionicons size={size} name="time-outline" color={color} />,
      }} />
    </Tabs>
  );
}
