import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../constants/colors';

function RootContent() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      if (user.role === 'RIDER') {
        router.replace('/rider');
      } else {
        router.replace('/client');
      }
    } else if (user && !inAuthGroup) {
      const inClientGroup = segments[0] === 'client';
      const inRiderGroup = segments[0] === 'rider';
      if (user.role === 'RIDER' && inClientGroup) {
        router.replace('/rider');
      } else if (user.role === 'CLIENT' && inRiderGroup) {
        router.replace('/client');
      }
    }
  }, [user, loading, segments, router, mounted]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootContent />
    </SafeAreaProvider>
  );
}
