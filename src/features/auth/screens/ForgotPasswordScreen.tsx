import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { AuthLayout } from '@/components/sport/auth-layout';
import { Button, Field } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { authApi } from '@/services/api';
import { passwordStrength, validEmail } from '@/utils/validation';
import { colors } from '@/data/sport';

const OTP_TTL_MS = 5 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
type CodeStep = { email: string; expiresAt: number; resendAt: number };

/** Password reset inside the app: the BE emails a 6-digit code, then the member sets a new password with it. */
export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<CodeStep | null>(null);
  const [form, setForm] = useState({ otp: '', password: '', confirm: '' });
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef(false);
  const errors = {
    otp: /^\d{6}$/.test(form.otp) ? '' : 'Nhập đủ 6 chữ số trong email.',
    password: form.password.length >= 6 ? '' : 'Mật khẩu mới cần ít nhất 6 ký tự.',
    confirm: form.confirm && form.confirm === form.password ? '' : 'Mật khẩu xác nhận không khớp.',
  };

  useEffect(() => {
    if (!step) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  async function sendCode() {
    if (pending.current) return;
    setSubmitted(true); setError(''); setMessage('');
    if (!validEmail(email)) return;
    pending.current = true; setBusy(true);
    try {
      await authApi.forgotPasswordOtp(email);
      const sentAt = Date.now();
      setNow(sentAt);
      if (step) setMessage('Đã gửi mã mới. Vui lòng kiểm tra hộp thư và thư rác.');
      setStep({ email: email.trim(), expiresAt: sentAt + OTP_TTL_MS, resendAt: sentAt + RESEND_COOLDOWN_MS });
      setForm(current => ({ ...current, otp: '' }));
    } catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }

  async function reset() {
    if (pending.current || !step) return;
    setTried(true); setError(''); setMessage('');
    if (Object.values(errors).some(Boolean)) return;
    pending.current = true; setBusy(true);
    try {
      await authApi.resetPasswordOtp(step.email, form.otp, form.password);
      router.replace({ pathname: '/login', params: { email: step.email, reset: '1' } });
    } catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }

  if (step) {
    const wait = Math.max(0, Math.ceil((step.resendAt - now) / 1000));
    const expires = Math.max(0, Math.ceil((step.expiresAt - now) / 1000));
    return <AuthLayout>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26, color: colors.primary }}>✉</Text></View>
      <View style={{ gap: 8 }}>
        <Text style={ui.eyebrow}>ĐẶT LẠI MẬT KHẨU</Text>
        <Text style={[ui.title, { fontSize: 28 }]}>Nhập mã và mật khẩu mới</Text>
        <Text style={ui.body}>Nếu <Text style={{ fontWeight: '700', color: colors.ink }}>{step.email}</Text> là tài khoản đăng nhập bằng email và mật khẩu, bạn sẽ nhận được mã 6 số. Hãy kiểm tra cả thư rác.</Text>
      </View>
      <Field label="Mã xác nhận" placeholder="000000" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} autoFocus
        value={form.otp} onChangeText={value => setForm(current => ({ ...current, otp: value.replace(/\D/g, '').slice(0, 6) }))} editable={!busy}
        error={tried ? errors.otp || undefined : undefined} />
      <Text style={expires ? ui.body : ui.error}>{expires ? `Mã còn hiệu lực ${formatSeconds(expires)}` : 'Mã đã hết hạn. Gửi lại để nhận mã mới.'}</Text>
      <Field label="Mật khẩu mới" placeholder="Tối thiểu 6 ký tự" password autoCapitalize="none" autoComplete="new-password" value={form.password}
        onChangeText={value => setForm(current => ({ ...current, password: value }))} editable={!busy} error={tried ? errors.password || undefined : undefined} />
      {!!form.password && <Text style={[ui.body, { fontSize: 12 }]}>Độ mạnh: {passwordStrength(form.password)}</Text>}
      <Field label="Xác nhận mật khẩu mới" placeholder="Nhập lại mật khẩu mới" password autoCapitalize="none" autoComplete="new-password" value={form.confirm}
        onChangeText={value => setForm(current => ({ ...current, confirm: value }))} editable={!busy} onSubmitEditing={() => void reset()}
        error={tried ? errors.confirm || undefined : undefined} />
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      {!!message && <Text style={{ color: colors.green, lineHeight: 22 }}>{message}</Text>}
      <Button title={busy ? 'Đang xử lý…' : 'Đặt mật khẩu mới →'} disabled={busy || !expires} onPress={() => void reset()} />
      <Button secondary title={wait ? `Gửi lại mã sau ${wait}s` : 'Gửi lại mã'} disabled={busy || wait > 0} onPress={() => void sendCode()} />
      <Button secondary title="Đổi email" disabled={busy} onPress={() => { setStep(null); setForm({ otp: '', password: '', confirm: '' }); setTried(false); setError(''); setMessage(''); }} />
      <Text style={[ui.body, { fontSize: 13 }]}>Không chia sẻ mã này với người khác. Sau khi đổi, các phiên đăng nhập cũ sẽ bị đăng xuất.</Text>
    </AuthLayout>;
  }

  return <AuthLayout>
    <View style={{ gap: 10 }}>
      <Text style={ui.eyebrow}>HỖ TRỢ TÀI KHOẢN</Text>
      <Text style={ui.title}>Quên mật khẩu?</Text>
      <Text style={ui.body}>Nhập email bạn dùng để đăng nhập, chúng tôi sẽ gửi mã 6 số để bạn đặt mật khẩu mới ngay trong ứng dụng.</Text>
    </View>
    <Field label="Email" placeholder="name@email.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address"
      editable={!busy} onSubmitEditing={() => void sendCode()} error={submitted && !validEmail(email) ? 'Vui lòng nhập email hợp lệ.' : undefined} />
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Button disabled={busy} title={busy ? 'Đang gửi…' : 'Gửi mã xác nhận →'} onPress={() => void sendCode()} />
    <Link href="/login" style={[ui.link, { paddingVertical: 14 }]}>← Quay lại đăng nhập</Link>
  </AuthLayout>;
}
