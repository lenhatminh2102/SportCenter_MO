import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Screen } from '@/components/sport/ui';
import { AccessScreen } from '@/components/sport/access';
import { ui } from '@/components/sport/styles';
import { useAuth } from '@/context/auth';
import { canManagePayments } from '@/services/payments';
import { canResolveSupport } from '@/services/support';

const roles: Record<string, string> = { MEMBER: 'Hội viên', CENTER_MANAGER: 'Quản lý trung tâm', COACH: 'Huấn luyện viên', RECEPTIONIST: 'Lễ tân' };

export default function Account() {
  const { user, refreshUser, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!user) return <AccessScreen />;

  async function refresh() {
    setBusy(true);
    setMessage('');
    try {
      await refreshUser();
      setMessage('Đã cập nhật thông tin tài khoản.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <Screen>
    <Text style={ui.title}>Tài khoản</Text>
    <View style={ui.card}>
      <Text style={ui.heading}>{user.name}</Text>
      <Text selectable style={ui.body}>{user.email}</Text>
      <Text style={ui.body}>{roles[user.role] || user.role} · {user.status === 'ACTIVE' ? 'Đang hoạt động' : user.status}</Text>
      <Button secondary title={busy ? 'Đang cập nhật…' : 'Làm mới tài khoản'} disabled={busy} onPress={() => void refresh()} />
      {!!message && <Text accessibilityRole="alert" style={ui.body}>{message}</Text>}
    </View>
    {user.role === 'MEMBER' && <>
      <Button secondary title="Hồ sơ tập luyện" onPress={() => router.push('/profile')} />
      <Button secondary title="Đăng ký của tôi" onPress={() => router.push({ pathname: '/workspace/[resource]', params: { resource: 'class-registrations' } })} />
    </>}
    {canManagePayments(user.role) && <Button secondary title="Thanh toán" onPress={() => router.push('/payments')} />}
    {(user.role === 'MEMBER' || canResolveSupport(user.role)) && <Button secondary title="Hỗ trợ" onPress={() => router.push('/support')} />}
    <Button secondary title="Đăng xuất" onPress={() => { logout(); router.replace('/login'); }} />
  </Screen>;
}
