import { Platform } from 'react-native';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000')).replace(/\/+$/, '');
export type ApiUser = { id: string; email: string; role: string; status: string };
export type AuthSession = { token: string; user: ApiUser };
type Envelope<T> = { success: boolean; message?: string; data?: T };
type RequestOptions = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; formData?: FormData; token?: string; timeoutMs?: number };
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'ApiError'; }
}
const unauthorizedListeners = new Set<(token: string) => void>();
export function onUnauthorized(listener: (token: string) => void) {
  unauthorizedListeners.add(listener);
  return () => { unauthorizedListeners.delete(listener); };
}
export async function requestEnvelope<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T> & { requiresOTP?: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method || (options.body === undefined && !options.formData ? 'GET' : 'POST'),
      headers: { Accept: 'application/json', ...(options.body === undefined || options.formData ? {} : { 'Content-Type': 'application/json' }), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      ...(options.formData ? { body: options.formData } : options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });
    if (response.status === 401 && options.token) unauthorizedListeners.forEach(listener => listener(options.token!));
    if (response.status === 204 && response.ok) return { success: true };
    let result: Envelope<T>;
    try { result = await response.json(); } catch { throw new ApiError(`Máy chủ trả về dữ liệu không hợp lệ (HTTP ${response.status}).`, response.status); }
    if (!response.ok || !result || result.success !== true) throw new ApiError(result?.message || `Yêu cầu thất bại (HTTP ${response.status}).`, response.status);
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Kết nối quá thời gian. Vui lòng thử lại.');
    if (error instanceof TypeError) throw new Error('Không kết nối được backend. Kiểm tra địa chỉ API và kết nối mạng.');
    throw error;
  } finally { clearTimeout(timer); }
}
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await requestEnvelope<T>(path, options)).data as T;
}
export async function requestHtml(path: string, token: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}${path}`, { headers: { Accept: 'text/html', Authorization: `Bearer ${token}` }, signal: controller.signal });
    if (response.status === 401) unauthorizedListeners.forEach(listener => listener(token));
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new ApiError(result?.message || `Không tải được biên nhận (HTTP ${response.status}).`, response.status);
    }
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Biên nhận từ máy chủ không hợp lệ.');
    return await response.text();
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Kết nối quá thời gian. Vui lòng thử lại.');
    throw error;
  } finally { clearTimeout(timer); }
}
export const authApi = {
  register: (email: string, password: string) => request<ApiUser>('/api/auth/register', { body: { email: email.trim().toLowerCase(), password, role: 'MEMBER' } }),
  login: (email: string, password: string) => request<AuthSession>('/api/auth/login', {
    body: { email: email.trim().toLowerCase(), password },
    timeoutMs: 60_000,
  }),
  me: (token: string) => request<ApiUser>('/api/auth/me', { token }),
  google: async (idToken: string) => parseGoogleAuth(await requestEnvelope<{ token?: string; user?: ApiUser; email?: string; challengeToken?: string }>('/api/auth/google', { body: { idToken } })),
  verifyGoogleOtp: (challengeToken: string, otp: string) => request<AuthSession>('/api/auth/google/verify-otp', { body: { challengeToken, otp } }),
};

export type GoogleAuthResult = { requiresOTP: false; token: string; user: ApiUser } | { requiresOTP: true; email: string; challengeToken: string };

/** BE answers { requiresOTP: false, data: { token, user } } or { requiresOTP: true, data: { email, challengeToken } }. */
export function parseGoogleAuth(result: { requiresOTP?: boolean; data?: { token?: string; user?: ApiUser; email?: string; challengeToken?: string } }): GoogleAuthResult {
  const data = result?.data;
  if (result?.requiresOTP === true) {
    if (!data?.email || !data.challengeToken) throw new Error('Máy chủ chưa trả về thông tin xác minh OTP.');
    return { requiresOTP: true, email: data.email, challengeToken: data.challengeToken };
  }
  if (!data?.token || !data.user) throw new Error('Máy chủ chưa trả về phiên đăng nhập Google hợp lệ.');
  return { requiresOTP: false, token: data.token, user: data.user };
}
