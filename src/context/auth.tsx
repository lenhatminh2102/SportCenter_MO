import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { authApi, onUnauthorized, type ApiUser, type AuthSession } from '@/services/api';
type User = ApiUser & { name: string };
type Auth = {
  token: string | null; user: User | null; sessionMessage: string;
  register: (account: { email: string; password: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>; logout: () => void;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<{ token: string; user: User } | null>(null);
  const [sessionMessage, setSessionMessage] = useState('');
  const currentToken = useRef<string | null>(null);
  const generation = useRef(0);
  useEffect(() => onUnauthorized(token => {
    if (currentToken.current === token) {
      generation.current++; currentToken.current = null; setSession(null);
      setSessionMessage('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }), []);
  function logout() {
    generation.current++; currentToken.current = null; setSession(null); setSessionMessage('');
  }
  function startAuthentication() { generation.current++; currentToken.current = null; setSession(null); return generation.current; }
  async function finishAuthentication(result: AuthSession, version: number) {
    if (!result?.token) throw new Error('Máy chủ chưa trả về token đăng nhập.');
    const profile = await authApi.me(result.token);
    if (version !== generation.current) throw new Error('Yêu cầu đăng nhập đã bị hủy.');
    if (!profile?.id || !profile.email) throw new Error('Thông tin tài khoản từ máy chủ không hợp lệ.');
    if (profile.status !== 'ACTIVE') throw new Error('Tài khoản chưa hoạt động.');
    currentToken.current = result.token;
    setSession({ token: result.token, user: { ...profile, name: profile.email.split('@')[0] } });
    setSessionMessage('');
  }
  async function refreshUser() {
    const token = currentToken.current; if (!token) return;
    const profile = await authApi.me(token); if (currentToken.current !== token) return;
    if (profile.status !== 'ACTIVE') { logout(); throw new Error('Tài khoản chưa hoạt động.'); }
    setSession({ token, user: { ...profile, name: profile.email.split('@')[0] } });
  }
  return <Context.Provider value={{
    token: session?.token ?? null, user: session?.user ?? null, sessionMessage,
    register: async account => { await authApi.register(account.email, account.password); },
    login: async (email, password) => { const version = startAuthentication(); await finishAuthentication(await authApi.login(email, password), version); },
    refreshUser, logout,
  }}>{children}</Context.Provider>;
}
export function useAuth() { const auth = useContext(Context); if (!auth) throw new Error('AuthProvider is required'); return auth; }
