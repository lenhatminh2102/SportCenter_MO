import { useState } from 'react';
import { Text } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/context/auth';
import { membersApi } from '@/services/members';
import { canManageMembers } from '@/utils/permissions';
import { AccessScreen } from '@/components/sport/access';
import { MemberForm } from '@/components/sport/member-form';
import { Field, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';

export default function FrontDesk() {
  const { user, token } = useAuth(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  if (!user || !token) return <AccessScreen />; if (!canManageMembers(user.role)) return <AccessScreen denied />;
  return <Screen><Link href="/members" style={ui.link}>← Hội viên</Link><Text style={ui.title}>Tạo hội viên tại quầy</Text><Text style={ui.body}>Tạo tài khoản đăng nhập và hồ sơ cho hội viên mới.</Text>
    <Field label="Email đăng nhập" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!busy} /><Field label="Mật khẩu ban đầu (ít nhất 6 ký tự)" password value={password} onChangeText={setPassword} autoCapitalize="none" editable={!busy} />
    <MemberForm onSave={async input => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Nhập email hợp lệ.');
      if (password.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
      setBusy(true); try { await membersApi.frontDesk(token, input, email, password); setPassword(''); } finally { setBusy(false); }
    }} onSaved={() => router.dismissTo('/members')} />
  </Screen>;
}
