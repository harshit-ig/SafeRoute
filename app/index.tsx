import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import LoadingScreen from '../src/components/LoadingScreen';

export default function Index() {
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  if (!isInitialized) {
    return <LoadingScreen message="Starting SafeRoute..." />;
  }

  if (user) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/auth/login" />;
}
