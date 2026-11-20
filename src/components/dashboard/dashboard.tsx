import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useStaffShell } from '@/context/staff-shell';
import { loadDashboard } from '@/services/dashboard';
import { entityId, referenceId, referenceLabel } from '@/services/operations';
import { isStaffRole, managerAdminLinks, roleHome, type StaffRole } from '@/utils/staff-navigation';
import { useApiQuery } from '@/hooks/use-api-query';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';
import { coachCards, managerCards } from '@/utils/home-cards';
import { coachStudentName } from '@/utils/coach-roster';
import { AttentionList, MetricGrid } from './home-widgets';

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
  const home = data?.manager ? managerCards(data.manager, data.today) : data?.coach ? coachCards(data.coach) : null;
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
      {home && <MetricGrid items={home.metrics} />}
      {home && <AttentionList items={home.attention} />}
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
      {!manager && data && <View style={{ gap: 10 }}>
        <View style={ui.between}>
          <Text style={ui.heading}>Học viên mới & kết quả</Text>
          <Pressable accessibilityRole="button" onPress={() => openResource('coach-students')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={ui.link}>Xem học viên</Text>
          </Pressable>
        </View>
        {!data.enrollments.length && !data.activity.length && <Text style={ui.body}>Chưa có học viên hoặc kết quả tập mới.</Text>}
        {data.enrollments.slice(0, 2).map(item => <View key={`${item.memberId}-${entityId(item.class)}`} style={[ui.card, { gap: 4, padding: 14 }]}>
          <Text style={ui.heading}>{coachStudentName(item)}</Text>
          <Text style={ui.body}>{referenceLabel(item.class)} · {item.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chờ thanh toán'}</Text>
        </View>)}
        {data.activity.map(result => <View key={entityId(result)} style={[ui.card, { gap: 4, padding: 14 }]}>
          <Text style={ui.heading}>{String(result.result || '').slice(0, 80) || 'Kết quả tập'}</Text>
          <Text style={ui.body}>{referenceLabel(result.memberId)}</Text>
        </View>)}
        <View style={ui.card}>
          <Text style={ui.eyebrow}>ĐỒNG HÀNH CÙNG HỌC VIÊN</Text>
          <Text style={ui.body}>Gửi nhận xét cho cả lớp hoặc từng học viên, giao bài tập về nhà và theo dõi tiến độ.</Text>
          <Button secondary title="Gửi nhận xét" onPress={() => router.push('/feedbacks')} />
          <Button secondary title="Gửi thông báo cho học viên" onPress={() => router.push('/notification-compose')} />
        </View>
      </View>}
      {manager && <View style={{ gap: 8 }}>
        <Button title="Thêm lịch tập" onPress={() => router.push({ pathname: '/workspace/[resource]/edit', params: { resource: 'schedules' } })} />
        <Button secondary title="Quét QR ra/vào" onPress={() => router.push('/checkin-desk')} />
      </View>}
      {manager && <View style={{ gap: 10 }}>
        <Text style={ui.heading}>Quản trị trung tâm</Text>
        {managerAdminLinks.map(link => <Pressable key={link.path} accessibilityRole="button" accessibilityLabel={link.label}
          onPress={() => router.push(link.href)} style={({ pressed }) => [ui.card, { padding: 14, gap: 4, opacity: pressed ? 0.7 : 1 }]}>
          <View style={ui.between}><Text style={ui.heading}>{link.label}</Text><Text style={ui.link}>›</Text></View>
          <Text style={[ui.body, { fontSize: 13, lineHeight: 18 }]}>{link.description}</Text>
        </Pressable>)}
      </View>}
    </ScrollView>
  </SafeAreaView>;
}
