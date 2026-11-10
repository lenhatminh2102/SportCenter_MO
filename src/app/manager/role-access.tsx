import { useCallback, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { managerApi, type ConfigurableRole, type RoleAccess } from '@/services/manager';
import { isResource, resources } from '@/utils/resources';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';

const roleLabels: Record<ConfigurableRole, string> = {
  MEMBER: 'Hội viên', COACH: 'Huấn luyện viên', RECEPTIONIST: 'Lễ tân',
};

export default function ManagerRoleAccess() {
  const { user, token } = useAuth();
  const allowed = !!token && user?.role === 'CENTER_MANAGER';
  const load = useCallback(() => managerApi.getRoleAccess(token!), [token]);
  const query = useApiQuery(load, allowed);
  if (!user || !token) return <AccessScreen />;
  if (!allowed) return <AccessScreen denied />;
  return <Screen>
    <Link href="/manager" style={ui.link}>← Tổng quan</Link>
    <Text style={ui.title}>Quyền theo vai trò</Text>
    <Text style={ui.body}>Bật công tắc để chặn thao tác. Khi bỏ chặn, quyền mặc định của vai trò vẫn được áp dụng.</Text>
    <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />
    {query.data && <RoleSettings token={token} {...query.data} />}
  </Screen>;
}

function RoleSettings({ token, accessKeys, roles }: { token: string; accessKeys: string[]; roles: RoleAccess[] }) {
  const [saved, setSaved] = useState(roles);
  const [role, setRole] = useState<ConfigurableRole>(roles[0]?.role || 'MEMBER');
  const [drafts, setDrafts] = useState<Partial<Record<ConfigurableRole, string[]>>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const original = saved.find(item => item.role === role)?.disabled || [];
  const disabled = drafts[role] ?? original;
  const changed = disabled.length !== original.length || disabled.some(key => !original.includes(key));
  const grouped = [...new Set(accessKeys.map(key => key.split(':')[0]))].filter(resource => resource !== 'notifications');

  async function save() {
    if (pending.current || !changed) return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const result = await managerApi.updateRoleAccess(token, role, disabled);
      setSaved(current => current.map(item => item.role === role ? result : item));
      setDrafts(current => ({ ...current, [role]: undefined }));
      setNotice(`Đã lưu quyền cho ${roleLabels[role]}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{roles.map(item =>
      <Button key={item.role} title={roleLabels[item.role]} secondary={role !== item.role} disabled={busy}
        onPress={() => { setRole(item.role); setNotice(''); setError(''); }} />)}</View>
    {grouped.map(resource => {
      const title = isResource(resource) ? resources[resource].title : ({
        members: 'Hội viên', payments: 'Thanh toán',
        'support-requests': 'Hỗ trợ hội viên', homeworks: 'Bài tập về nhà',
      } as Record<string, string>)[resource] || resource;
      return <View style={ui.card} key={resource}>
        <Text style={ui.heading}>{title}</Text>
        {(['read', 'write'] as const).map(operation => {
          const key = `${resource}:${operation}`;
          if (!accessKeys.includes(key)) return null;
          const label = operation === 'read' ? 'Chặn xem' : 'Chặn thêm, sửa và xóa';
          return <View style={ui.between} key={operation}>
            <Text style={ui.body}>{label}</Text>
            <Switch accessibilityLabel={`${label} · ${title}`} disabled={busy} value={disabled.includes(key)}
              onValueChange={value => {
                setNotice('');
                setDrafts(current => {
                  const previous = current[role] ?? original;
                  const next = value ? [...new Set([...previous, key])] : previous.filter(item => item !== key);
                  return { ...current, [role]: next };
                });
              }} />
          </View>;
        })}
      </View>;
    })}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {!!notice && <Text accessibilityRole="alert" style={ui.body}>{notice}</Text>}
    <Button title={busy ? 'Đang lưu…' : `Lưu quyền · ${roleLabels[role]}`} disabled={busy || !changed} onPress={() => void save()} />
  </>;
}
