import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/auth';
import { ui } from './styles';

// Web build: Google Identity Services button, same as the web app.
type GoogleId = {
  accounts: { id: {
    initialize: (options: { client_id: string; callback: (result: { credential?: string }) => void }) => void;
    renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
  } };
};
let scriptPromise: Promise<GoogleId> | null = null;
function loadGoogle() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      const google = (window as unknown as { google?: GoogleId }).google;
      if (google?.accounts?.id) resolve(google);
      else { scriptPromise = null; reject(new Error('Không tải được Google Sign-In.')); }
    };
    script.onerror = () => { script.remove(); scriptPromise = null; reject(new Error('Không tải được Google Sign-In. Kiểm tra mạng rồi tải lại trang.')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

export function GoogleSignIn({ disabled = false, onBusyChange }: { disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { loginGoogle } = useAuth();
  const host = useRef<unknown>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Google keeps the first callback it was given, so route it through a ref.
  const handler = useRef<(result: { credential?: string }) => void>(() => {});
  useEffect(() => {
    handler.current = async result => {
      if (disabled || pending.current) return;
      if (!result?.credential) { setError('Google chưa trả về ID token.'); return; }
      pending.current = true; setBusy(true); onBusyChange?.(true); setError('');
      try {
        const status = await loginGoogle(result.credential);
        router.replace(status === 'otp' ? '/verify-otp' : '/dashboard');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        pending.current = false; setBusy(false); onBusyChange?.(false);
      }
    };
  }, [disabled, loginGoogle, onBusyChange]);

  useEffect(() => {
    if (!webClientId) return undefined;
    let active = true;
    loadGoogle()
      .then(google => {
        const element = host.current as unknown as HTMLElement | null;
        if (!active || !element) return;
        google.accounts.id.initialize({ client_id: webClientId, callback: result => handler.current(result) });
        google.accounts.id.renderButton(element, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: Math.min(400, element.clientWidth || 320), locale: 'vi' });
      })
      .catch(e => { if (active) setError((e as Error).message); });
    return () => { active = false; };
  }, []);

  if (!webClientId) return <Text style={ui.body}>Đăng nhập Google đang chờ cấu hình (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).</Text>;
  return <View style={{ gap: 8, opacity: disabled || busy ? 0.5 : 1 }} pointerEvents={disabled || busy ? 'none' : 'auto'}>
    <View ref={host as never} style={{ minHeight: 44 }} />
    {busy && <Text style={ui.body}>Đang kết nối Google…</Text>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </View>;
}
