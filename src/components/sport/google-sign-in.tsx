import { useRef, useState } from 'react';
import { NativeModules, Text, TurboModuleRegistry, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/auth';
import { Button } from './ui';
import { ui } from './styles';

// Native Google sign-in (@react-native-google-signin/google-signin). It needs a development build;
// in Expo Go the native module is missing, so the button explains that instead of crashing.
type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let googleModule: GoogleModule | null | undefined;
function loadGoogle(): GoogleModule | null {
  if (googleModule !== undefined) return googleModule;
  // The package calls TurboModuleRegistry.getEnforcing('RNGoogleSignin') as soon as it is required,
  // which raises a red-box error in Expo Go. Check for the native module first (get() returns null),
  // and only require the package when the app binary actually contains it.
  const native = TurboModuleRegistry.get('RNGoogleSignin') ?? NativeModules.RNGoogleSignin;
  if (!native) return (googleModule = null);
  try {
    googleModule = require('@react-native-google-signin/google-signin') as GoogleModule; // eslint-disable-line @typescript-eslint/no-require-imports
  } catch {
    googleModule = null;
  }
  return googleModule;
}

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined;
let configured = false;

export function GoogleSignIn({ disabled = false, onBusyChange }: { disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { loginGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const google = loadGoogle();

  async function signIn() {
    if (pending.current || disabled || !google) return;
    pending.current = true; setBusy(true); onBusyChange?.(true); setError('');
    try {
      const { GoogleSignin, isSuccessResponse } = google;
      if (!configured) { GoogleSignin.configure({ webClientId, iosClientId }); configured = true; }
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // the user closed the Google sheet
      const idToken = response.data.idToken;
      if (!idToken) throw new Error('Google chưa trả về ID token. Kiểm tra cấu hình Web client ID.');
      const status = await loginGoogle(idToken);
      router.replace(status === 'otp' ? '/verify-otp' : '/dashboard');
    } catch (e) {
      setError((e as Error).message || 'Đăng nhập Google thất bại.');
    } finally {
      pending.current = false; setBusy(false); onBusyChange?.(false);
    }
  }

  if (!webClientId) return <Text style={ui.body}>Đăng nhập Google đang chờ cấu hình (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).</Text>;
  return <View style={{ gap: 8 }}>
    <Button secondary title={busy ? 'Đang kết nối Google…' : 'G  ·  Tiếp tục với Google'} disabled={disabled || busy || !google} onPress={() => void signIn()} />
    {!google && <Text style={[ui.body, { fontSize: 13 }]}>Đăng nhập Google cần bản build riêng của ứng dụng (không chạy trong Expo Go).</Text>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </View>;
}
