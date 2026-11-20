import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { loadReceptionBoard } from '@/services/reception';
import { bangkokDate } from '@/services/dashboard';
import { referenceLabel } from '@/services/operations';
import { statusLabels } from '@/utils/resource-display';
import { receptionCards } from '@/utils/home-cards';
import { roleHome } from '@/utils/staff-navigation';
import { AttentionList, MetricGrid } from '@/components/dashboard/home-widgets';
import { QueryStatus } from '@/components/sport/access';
import { Screen, Button } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';

export default function Reception() {
  const { user, token } = useAuth();
  const load = useCallback(() => loadReceptionBoard(token!), [token]);
  const query = useApiQuery(load, !!token && user?.role === 'RECEPTIONIST', false);
  const { reload } = query;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!user || !token) return <Redirect href="/login" />;
  if (user.role !== 'RECEPTIONIST') return <Redirect href={roleHome(user.role)} />;

  const board = query.data;
  const home = board ? receptionCards(board, bangkokDate(new Date())) : null;
  return <Screen>
    <View style={{ gap: 4 }}>
      <Text style={ui.eyebrow}>LỄ TÂN</Text>
      <Text style={ui.title}>Chào {user.name}</Text>
      <Text style={ui.body}>Tiếp đón, đăng ký lớp, thu học phí và hỗ trợ hội viên.</Text>
    </View>
    <Button title="Quét QR ra/vào" onPress={() => router.push('/checkin-desk')} />
    <Button secondary title="Đăng ký lớp cho hội viên" onPress={() => router.push('/enroll')} />
    {!board && <QueryStatus loading={query.loading} error={query.error} retry={reload} />}
    {!!board?.errors.length && <View style={{ gap: 8 }}>
      <Text accessibilityRole="alert" style={ui.error}>Một phần dữ liệu chưa tải được: {board.errors.join('; ')}</Text>
      <Button secondary title="Thử lại" onPress={reload} />
    </View>}
    {home && <>
      <MetricGrid items={home.metrics} />
      <AttentionList items={home.attention} />
      <View style={{ gap: 10 }}>
        <View style={ui.between}>
          <Text style={ui.heading}>Đăng ký gần đây</Text>
          <Text accessibilityRole="link" style={ui.link} onPress={() => router.push({ pathname: '/workspace/[resource]', params: { resource: 'class-registrations' } })}>Xem tất cả</Text>
        </View>
        {!home.recent.length && <Text style={ui.body}>{board?.registrations ? 'Chưa có đăng ký lớp.' : 'Chưa tải được danh sách đăng ký.'}</Text>}
        {home.recent.map((item, index) => <View key={String(item._id || index)} style={[ui.card, { padding: 14, gap: 4 }]}>
          <Text style={ui.heading}>{item.memberId ? referenceLabel(item.memberId) : 'Hồ sơ hội viên đã bị xóa'}</Text>
          <Text style={ui.body}>{referenceLabel(item.classId)} · {statusLabels[String(item.status)] || String(item.status)}</Text>
        </View>)}
      </View>
    </>}
  </Screen>;
}
