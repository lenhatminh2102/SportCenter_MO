import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import { Button, Screen } from '@/components/sport/ui';
import { QueryStatus, AccessScreen } from '@/components/sport/access';
import { ui } from '@/components/sport/styles';
import { coursesApi, coursePrice, entityId } from '@/services/operations';
import { currency } from '@/services/payments';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
export default function Pricing() {
  const { token } = useAuth();
  const load = useCallback(() => coursesApi.list(token!), [token]);
  const query = useApiQuery(load, !!token, false); const { reload } = query;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!token) return <AccessScreen />;
  return <Screen><Link href="/operations" style={ui.link}>← Không gian của tôi</Link><Text style={ui.eyebrow}>ĐẦU TƯ CHO SỨC KHỎE</Text><Text style={ui.title}>Huấn luyện cá nhân & lớp nhóm</Text><Text style={ui.body}>Học phí được tính một lần cho lớp đã chọn, theo toàn bộ lịch của lớp.</Text><QueryStatus loading={query.loading} error={query.error} retry={reload} />{query.data?.filter(item => item.status === 'ACTIVE').map(item => <View key={entityId(item)} style={ui.card}><Text style={ui.heading}>{String(item.name || '')}</Text><Text style={ui.heading}>Cá nhân 1–1 · {currency(coursePrice(item, 'PERSONAL'))}</Text><Text style={ui.heading}>Lớp nhóm · {currency(coursePrice(item, 'GROUP'))}</Text><Text style={ui.body}>{String(item.description || '')}</Text><Button title="Tìm lớp để tham gia →" onPress={() => router.push({ pathname: '/workspace/[resource]', params: { resource: 'classes', courseId: entityId(item) } })} /></View>)}{query.data && !query.data.some(item => item.status === 'ACTIVE') && <Text style={ui.body}>Chưa có khóa học đang hoạt động.</Text>}</Screen>;
}
