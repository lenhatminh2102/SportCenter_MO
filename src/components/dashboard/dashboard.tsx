import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useStaffShell } from '@/context/staff-shell';
import { loadDashboard } from '@/services/dashboard';
import { entityId, referenceId, referenceLabel } from '@/services/operations';
import { isStaffRole, roleHome, type StaffRole } from '@/utils/staff-navigation';
import { useApiQuery } from '@/hooks/use-api-query';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';

export function Dashboard({ role }: { role: StaffRole }) {
  const { user, token } = useAuth();
  const inStaffShell = useStaffShell();
  const userId = user?.id;
  const userRole = user?.role;
  const load = useCallback(async () => {
    if (!userId || !token || userRole !== role) throw new Error('Phiên đăng nhập đã kết thúc.');
    return loadDashboard(role, userId, token);
  }, [role, userId, userRole, token]);
  const query = useApiQuery(load, userRole === role && !!userId && !!token, false);
  const { reload } = query;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!user || !token) return <AccessScreen />;
  if (userRole !== role) return isStaffRole(userRole) ? <Redirect href={roleHome(userRole)} /> : <AccessScreen denied />;

  const manager = role === 'CENTER_MANAGER';
  const data = query.data;
  const metrics = data?.metrics.filter(item => manager
    ? ['members', 'classes'].includes(item.resource)
    : ['schedules', 'coach-students'].includes(item.resource));
  const openResource = (resource: string) => {
    if (resource === 'members') return router.navigate('/members');
    if (resource === 'coach-students') return router.navigate('/coach-students');
    router.navigate({ pathname: '/workspace/[resource]', params: { resource } });
  };

  return <SafeAreaView edges={inStaffShell ? ['left', 'right'] : ['top', 'bottom', 'left', 'right']} style={[ui.page, { backgroundColor: colors.public }]}>
    <ScrollView refreshControl={<RefreshControl refreshing={query.loading} onRefresh={reload} />} contentContainerStyle={ui.content}>
      <View style={{ gap: 4 }}>
        <Text style={ui.eyebrow}>{manager ? 'QUẢN LÝ TRUNG TÂM' : 'LỊCH HUẤN LUYỆN'}</Text>
        <Text style={ui.title}>Chào {manager ? user.name : data?.name || user.name}</Text>
      </View>
      <QueryStatus loading={query.loading} error={query.error} retry={reload} />
      {!!data?.errors.length && <Text accessibilityRole="alert" style={ui.error}>Một phần dữ liệu chưa tải được. Kéo xuống để thử lại.</Text>}
      {metrics && <View style={{ flexDirection: 'row', gap: 10 }}>
        {metrics.map(item => <Pressable key={item.resource} accessibilityRole="button" accessibilityLabel={`${item.label}: ${item.value ?? 'chưa tải được'}`}
          onPress={() => openResource(item.resource)} style={({ pressed }) => [ui.card, { flex: 1, minHeight: 88, padding: 14, gap: 4, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: '800' }}>{item.value ?? '—'}</Text>
          <Text style={[ui.body, { fontSize: 13, lineHeight: 18 }]}>{item.label}</Text>
        </Pressable>)}
      </View>}
      {data && <View style={{ gap: 10 }}>
        <View style={ui.between}>
          <Text style={ui.heading}>{manager ? 'Lịch sắp tới' : 'Buổi dạy sắp tới'}</Text>
          <Pressable accessibilityRole="button" onPress={() => openResource('schedules')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={ui.link}>Xem lịch</Text>
          </Pressable>
        </View>
        {!data.sessions.length && <Text style={ui.body}>{data.week.every(day => day.count === null) ? 'Chưa tải được lịch.' : 'Chưa có buổi tập sắp tới.'}</Text>}
        {data.sessions.slice(0, 3).map(session => {
          const date = String(session.date).slice(0, 10);
          return <View key={entityId(session)} style={[ui.card, { gap: 5, padding: 14 }]}>
            <Text style={ui.link}>{date.slice(8, 10)}/{date.slice(5, 7)} · {String(session.startTime)} – {String(session.endTime)}</Text>
            <Text style={ui.heading}>{referenceLabel(session.classId)}</Text>
            <Text style={ui.body}>{referenceLabel(session.roomId)}</Text>
            {!manager && <Button secondary title="Điểm danh" onPress={() => (role === 'COACH'
              ? router.push({ pathname: '/attendance/session', params: { scheduleId: entityId(session) } })
              : router.push({
                pathname: '/workspace/[resource]/edit',
                params: { resource: 'attendances', scheduleId: entityId(session), classId: referenceId(session.classId), date },
              }))} />}
          </View>;
        })}
      </View>}
      {manager && <View style={{ gap: 8 }}>
        <Button title="Thêm lịch tập" onPress={() => router.push({ pathname: '/workspace/[resource]/edit', params: { resource: 'schedules' } })} />
        <Button secondary title="Xem báo cáo" onPress={() => router.push('/manager/reports')} />
      </View>}
    </ScrollView>
  </SafeAreaView>;
}
