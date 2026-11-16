import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ApiError, authApi, onUnauthorized, type ApiUser, type AuthSession, type GoogleAuthResult } from '@/services/api';

const OTP_TTL_MS = 5 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
export type PendingOtp = { email: string; expiresAt: number; resendAt: number };
type GoogleStatus = 'authenticated' | 'otp';
type User = ApiUser & { name: string };
type Auth = {
  token: string | null; user: User | null; sessionMessage: string;
  register: (account: { email: string; password: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>; logout: () => void;
  /** Google sign-in: 'otp' means the BE emailed a code; continue on /verify-otp. */
  loginGoogle: (idToken: string) => Promise<GoogleStatus>;
  pendingOtp: PendingOtp | null;
  verifyGoogleOtp: (otp: string) => Promise<void>;
  resendGoogleOtp: () => Promise<GoogleStatus>;
  cancelGoogleOtp: () => void;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<{ token: string; user: User } | null>(null);
  const [sessionMessage, setSessionMessage] = useState('');
  const currentToken = useRef<string | null>(null);
  const generation = useRef(0);
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(null);
  // pendingOtp + the tokens needed to finish or resend; never rendered.
  const challenge = useRef<(PendingOtp & { idToken: string; challengeToken: string }) | null>(null);
  const otpBusy = useRef(false);
  function clearChallenge() { challenge.current = null; setPendingOtp(null); }
  useEffect(() => onUnauthorized(token => {
    if (currentToken.current === token) {
      generation.current++; currentToken.current = null; setSession(null);
      setSessionMessage('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }), []);
  function logout() {
    generation.current++; currentToken.current = null; setSession(null); setSessionMessage(''); clearChallenge();
  }
  async function acceptGoogleResult(result: GoogleAuthResult, idToken: string, version: number, startedAt: number): Promise<GoogleStatus> {
    if (version !== generation.current) throw new Error('Yêu cầu đăng nhập đã bị hủy.');
    if (!result.requiresOTP) { await finishAuthentication(result, version); clearChallenge(); return 'authenticated'; }
    const next = { email: result.email, expiresAt: startedAt + OTP_TTL_MS, resendAt: Date.now() + RESEND_COOLDOWN_MS };
    challenge.current = { ...next, idToken, challengeToken: result.challengeToken };
    setPendingOtp(next);
    return 'otp';
  }
  async function loginGoogle(idToken: string) {
    const version = startAuthentication();
    const startedAt = Date.now();
    return acceptGoogleResult(await authApi.google(idToken), idToken, version, startedAt);
  }
  async function verifyGoogleOtp(otp: string) {
    if (otpBusy.current) throw new Error('Yêu cầu đang được xử lý.');
    if (!/^\d{6}$/.test(otp)) throw new Error('Nhập đủ 6 chữ số trong email.');
    const pending = challenge.current;
    if (!pending) throw new Error('Phiên xác minh không còn. Vui lòng đăng nhập Google lại.');
    if (Date.now() >= pending.expiresAt) throw new Error('Mã đã hết hạn. Vui lòng gửi lại mã.');
    const version = generation.current;
    otpBusy.current = true;
    try { await finishAuthentication(await authApi.verifyGoogleOtp(pending.challengeToken, otp), version); clearChallenge(); }
    finally { otpBusy.current = false; }
  }
  async function resendGoogleOtp() {
    if (otpBusy.current) throw new Error('Yêu cầu đang được xử lý.');
    const pending = challenge.current;
    if (!pending) throw new Error('Vui lòng đăng nhập Google lại.');
    if (Date.now() < pending.resendAt) throw new Error('Vui lòng đợi trước khi gửi lại mã.');
    const version = generation.current;
    const startedAt = Date.now();
    otpBusy.current = true;
    try {
      return await acceptGoogleResult(await authApi.google(pending.idToken), pending.idToken, version, startedAt);
    } catch (error) {
      // BE rate-limited the resend: restart the cooldown.
      if (error instanceof ApiError && error.status === 429 && challenge.current === pending && version === generation.current) {
        const next = { ...pending, resendAt: Date.now() + RESEND_COOLDOWN_MS };
        challenge.current = next;
        setPendingOtp({ email: next.email, expiresAt: next.expiresAt, resendAt: next.resendAt });
      }
      throw error;
    } finally { otpBusy.current = false; }
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
    loginGoogle, pendingOtp, verifyGoogleOtp, resendGoogleOtp,
    cancelGoogleOtp: () => { generation.current++; clearChallenge(); },
  }}>{children}</Context.Provider>;
}
export function useAuth() { const auth = useContext(Context); if (!auth) throw new Error('AuthProvider is required'); return auth; }
