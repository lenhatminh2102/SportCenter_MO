import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Button, Check, Field } from '@/components/sport/ui';
import { AuthLayout } from '@/components/sport/auth-layout';
import { ui } from '@/components/sport/styles';
import { useAuth } from '@/context/auth';
import { authApi } from '@/services/api';
import { validEmail, passwordStrength } from '@/utils/validation';
import { colors } from '@/data/sport';

const OTP_TTL_MS = 5 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
type OtpStep = { email: string; expiresAt: number; resendAt: number };

/** Sign-up: the BE emails a 6-digit code and creates the account only once the code is entered. */
export default function Register() {
  const { plan } = useLocalSearchParams<{ plan?: string }>();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const { register, login } = useAuth();
  const [created, setCreated] = useState(false);
  const [otpStep, setOtpStep] = useState<OtpStep | null>(null);
  const [otp, setOtp] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const errors = { email: !validEmail(form.email) ? 'Email chưa hợp lệ.' : '', password: form.password.length < 6 ? 'Mật khẩu cần ít nhất 6 ký tự.' : '', confirm: form.password !== form.confirm || !form.confirm ? 'Mật khẩu xác nhận không khớp.' : '' };
  const strength = passwordStrength(form.password);
  const score = strength === 'Mạnh' ? 3 : strength === 'Trung bình' ? 2 : 1;

  useEffect(() => {
    if (!otpStep) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [otpStep]);

  /** The account exists: sign in straight away, or send the member to the login screen. */
  async function signInCreated(email: string) {
    setCreated(true);
    try { await login(email, form.password); router.replace('/dashboard'); }
    catch { router.replace({ pathname: '/login', params: { email, registered: '1' } }); }
  }

  async function submit() {
    if (pending.current) return;
    if (created) { router.replace({ pathname: '/login', params: { email: form.email.trim(), registered: '1' } }); return; }
    setSubmitted(true); setError(''); setMessage('');
    if (Object.values(errors).some(Boolean) || !agreed) return;
    pending.current = true; setBusy(true);
    try {
      const email = form.email.trim();
      const step = await register({ email, password: form.password });
      if (step === 'created') { await signInCreated(email); return; }
      const sentAt = Date.now();
      setOtp(''); setNow(sentAt);
      setOtpStep({ email, expiresAt: sentAt + OTP_TTL_MS, resendAt: sentAt + RESEND_COOLDOWN_MS });
      if (otpStep) setMessage('Đã gửi mã mới. Vui lòng kiểm tra hộp thư và thư rác.');
    }
    catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }

  async function verify() {
    if (pending.current || !otpStep) return;
    setError(''); setMessage('');
    if (!/^\d{6}$/.test(otp)) { setError('Vui lòng nhập đủ 6 chữ số trong email.'); return; }
    pending.current = true; setBusy(true);
    try { await authApi.verifyRegistration(otpStep.email, otp); await signInCreated(otpStep.email); }
    catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }

  if (otpStep) {
    const wait = Math.max(0, Math.ceil((otpStep.resendAt - now) / 1000));
    const expires = Math.max(0, Math.ceil((otpStep.expiresAt - now) / 1000));
    return <AuthLayout>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26, color: colors.primary }}>✉</Text></View>
      <View style={{ gap: 8 }}>
        <Text style={ui.eyebrow}>XÁC NHẬN EMAIL</Text>
        <Text style={[ui.title, { fontSize: 28 }]}>Kiểm tra hộp thư của bạn</Text>
        <Text style={ui.body}>Nhập mã 6 số được gửi tới <Text style={{ fontWeight: '700', color: colors.ink }}>{otpStep.email}</Text>. Tài khoản chỉ được tạo sau khi bạn xác nhận mã này.</Text>
      </View>
      <Field label="Mã xác nhận" placeholder="000000" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} autoFocus
        value={otp} onChangeText={value => setOtp(value.replace(/\D/g, '').slice(0, 6))} editable={!busy && !created} onSubmitEditing={() => void verify()} />
      <Text style={expires ? ui.body : ui.error}>{expires ? `Mã còn hiệu lực ${formatSeconds(expires)}` : 'Mã đã hết hạn. Gửi lại để nhận mã mới.'}</Text>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      {!!message && <Text style={{ color: colors.green, lineHeight: 22 }}>{message}</Text>}
      <Button title={busy ? 'Đang xử lý…' : 'Xác nhận & tạo tài khoản →'} disabled={busy || created || !expires || otp.length !== 6} onPress={() => void verify()} />
      <Button secondary title={wait ? `Gửi lại mã sau ${wait}s` : 'Gửi lại mã xác nhận'} disabled={busy || created || wait > 0} onPress={() => void submit()} />
      <Button secondary title="Đổi email" disabled={busy || created} onPress={() => { setOtpStep(null); setOtp(''); setError(''); setMessage(''); }} />
      <Text style={[ui.body, { fontSize: 13 }]}>Không chia sẻ mã này với người khác.</Text>
    </AuthLayout>;
  }

  return <AuthLayout><View style={{ gap: 10 }}><Text style={ui.eyebrow}>HÀNH TRÌNH CỦA BẠN BẮT ĐẦU TỪ ĐÂY</Text><Text style={[ui.title, { fontSize: 32, lineHeight: 41 }]}>Tạo tài khoản hội viên</Text><Text style={ui.body}>Bắt đầu hành trình cùng ActiveHub.</Text></View>{!!plan && <Text style={{ color: colors.primary, padding: 14, backgroundColor: colors.pale, borderRadius: 12 }}>Lựa chọn quan tâm: {plan}</Text>}{(['email', 'password', 'confirm'] as const).map(key => <Field key={key} label={{ email: 'Email', password: 'Mật khẩu', confirm: 'Xác nhận mật khẩu' }[key]} placeholder={{ email: 'name@email.com', password: 'Tối thiểu 6 ký tự', confirm: 'Nhập lại mật khẩu' }[key]} value={form[key]} onChangeText={value => setForm(current => ({ ...current, [key]: value }))} password={key !== 'email'} autoCapitalize="none" keyboardType={key === 'email' ? 'email-address' : 'default'} autoComplete={key === 'email' ? 'email' : 'new-password'} editable={!busy && !created} error={submitted ? errors[key] : undefined} />)}{!!form.password && <View style={{ gap: 7 }}><View style={{ flexDirection: 'row', gap: 5 }}>{[1, 2, 3].map(index => <View key={index} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: index <= score ? score === 3 ? colors.green : colors.primary : colors.border }} />)}</View><Text style={[ui.body, { fontSize: 12 }]}>Độ mạnh: {strength}</Text></View>}<Check checked={agreed} onPress={() => { if (!busy) setAgreed(!agreed); }} label="Tôi đồng ý với điều khoản và chính sách quyền riêng tư." /><Link href="/terms" style={ui.link}>Đọc điều khoản sử dụng →</Link>{submitted && !agreed && <Text style={ui.error}>Vui lòng đồng ý với điều khoản để tiếp tục.</Text>}{!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}<Button disabled={busy} title={busy ? 'Đang gửi mã xác nhận…' : created ? 'Đăng nhập tài khoản đã tạo →' : 'Tạo tài khoản →'} onPress={submit} /><Text style={[ui.body, { textAlign: 'center' }]}>Đã có tài khoản? <Link href="/login" style={ui.link}>Đăng nhập</Link></Text><Text style={[ui.body, { fontSize: 12 }]}>Bạn có thể bổ sung hồ sơ tập luyện sau khi đăng nhập.</Text></AuthLayout>;
}
