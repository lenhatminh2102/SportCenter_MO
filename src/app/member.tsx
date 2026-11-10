import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { loadMemberHome, upcomingMemberSessions } from '@/services/member-home';
import { referenceLabel } from '@/services/operations';
import { isVoidedPayment, registrationFor } from '@/services/payments';
import { roleHome } from '@/utils/staff-navigation';
import { Screen, Button } from '@/components/sport/ui';
import { QueryStatus } from '@/components/sport/access';
import { ui } from '@/components/sport/styles';

export default function MemberHome() {
  const { user, token } = useAuth();
  const userId = user?.id;
  const load = useCallback(async () => {
    if (!token || !userId) throw new Error('Phiên đăng nhập đã kết thúc.');
    return loadMemberHome(token);
  }, [token, userId]);
  const query = useApiQuery(load, !!token && user?.role === 'MEMBER', false);
  const { reload } = query;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!user || !token) return <Redirect href="/login" />;
  if (user.role !== 'MEMBER') return <Redirect href={roleHome(user.role)} />;

  const data = query.data;
  const next = upcomingMemberSessions(data?.schedules || [])[0];
  const pending = data?.payments?.filter(item => item.status === 'PENDING' && !isVoidedPayment(item, registrationFor(item, data.registrations || []))).length;

  return <Screen>
    <View style={{ gap: 4 }}>
      <Text style={ui.eyebrow}>ACTIVEHUB</Text>
      <Text style={ui.title}>Chào {data?.profile?.fullName || user.name}</Text>
    </View>
    <Button title="Tìm lớp học" onPress={() => router.navigate({ pathname: '/workspace/[resource]', params: { resource: 'classes' } })} />
    <QueryStatus loading={query.loading} error={query.error} retry={reload} />
    {!!data?.errors.length && <View style={{ gap: 8 }}>
      <Text style={ui.error} accessibilityRole="alert">Một phần dữ liệu chưa tải được.</Text>
      <Button secondary title="Thử lại" onPress={reload} />
    </View>}
    {data?.profileMissing && <View style={ui.card}>
      <Text style={ui.heading}>Hoàn thiện hồ sơ</Text>
      <Text style={ui.body}>Thêm họ tên, số điện thoại và mục tiêu tập luyện.</Text>
      <Button secondary title="Cập nhật hồ sơ" onPress={() => router.push('/profile')} />
    </View>}
    {data && <View style={ui.card}>
      <Text style={ui.heading}>Buổi tập tiếp theo</Text>
      {next ? <>
        <Text style={ui.heading}>{referenceLabel(next.classId)}</Text>
        <Text style={ui.body}>{String(next.date).slice(0, 10)} · {String(next.startTime)} – {String(next.endTime)}</Text>
        <Text style={ui.body}>Phòng: {referenceLabel(next.roomId)}</Text>
      </> : <Text style={ui.body}>{data.schedules ? 'Bạn chưa có buổi tập sắp tới.' : 'Lịch tập sẽ hiển thị sau khi đăng ký lớp được xác nhận.'}</Text>}
      <Button secondary title="Xem lịch của tôi" onPress={() => router.navigate({ pathname: '/workspace/[resource]', params: { resource: 'schedules' } })} />
    </View>}
    {!!pending && <View style={ui.card}>
      <Text style={ui.heading}>{pending} khoản chờ thanh toán</Text>
      <Button secondary title="Xem học phí" onPress={() => router.push('/payments')} />
    </View>}
  </Screen>;
}
