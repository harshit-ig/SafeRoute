import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import LoadingScreen from '../src/components/LoadingScreen';

export default function Index() {
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  console.log('[Index] Render - isInitialized:', isInitialized, 'user:', user ? 'Logged in' : 'Not logged in');

  if (!isInitialized) {
    console.log('[Index] Showing loading screen...');
    return <LoadingScreen message="Starting SafeRoute..." />;
  }

  if (user) {
    console.log('[Index] Redirecting to home...');
    return <Redirect href="/(tabs)/home" />;
  }

  console.log('[Index] Redirecting to login...');
  return <Redirect href="/auth/login" />;
}
