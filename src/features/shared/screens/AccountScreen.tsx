import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/use-api-query';
import { notificationsApi, ownNotifications } from '@/services/notifications';
import { Button, Screen } from '@/components/sport/ui';
import { AccessScreen } from '@/components/sport/access';
import { ui } from '@/components/sport/styles';
import { useAuth } from '@/context/auth';
import { canManagePayments } from '@/services/payments';
import { canResolveSupport } from '@/services/support';
import { managerAdminLinks } from '@/utils/staff-navigation';
import { MemberAccount } from '@/features/member/components/member-account';

const roles: Record<string, string> = { MEMBER: 'Hội viên', CENTER_MANAGER: 'Quản lý trung tâm', COACH: 'Huấn luyện viên', RECEPTIONIST: 'Lễ tân' };

export default function Account() {
  const { user, token, refreshUser, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const loadNotices = useCallback(async () => ownNotifications(await notificationsApi.my(token!), user!.id), [token, user]);
  const notices = useApiQuery(loadNotices, !!token && !!user);
  const unread = notices.data?.filter(item => !item.isRead).length || 0;
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

  function signOut() {
    logout();
    router.replace('/login');
  }

  if (user.role === 'MEMBER') {
    return <MemberAccount name={user.name} email={user.email} status={user.status} unread={unread}
      busy={busy} message={message} onRefresh={refresh} onLogout={signOut} />;
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
    {user.role === 'CENTER_MANAGER' && <View style={ui.card}>
      <Text style={ui.heading}>Quản trị trung tâm</Text>
      {managerAdminLinks.map(link => <Button key={link.path} secondary title={link.label} onPress={() => router.push(link.href)} />)}
    </View>}
    <Button secondary title={unread ? `Thông báo (${unread} chưa đọc)` : 'Thông báo'} onPress={() => router.push('/notifications')} />
    {canManagePayments(user.role) && <Button secondary title="Thanh toán" onPress={() => router.push('/payments')} />}
    {canResolveSupport(user.role) && <Button secondary title="Hỗ trợ" onPress={() => router.push('/support')} />}
    <Button secondary title="Đăng xuất" onPress={signOut} />
  </Screen>;
}
