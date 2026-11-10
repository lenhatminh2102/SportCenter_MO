import { Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/context/auth';
import { roleHome } from '@/utils/staff-navigation';
import { Screen, Button } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';

export default function Reception() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'RECEPTIONIST') return <Redirect href={roleHome(user.role)} />;
  return <Screen>
    <View style={{ gap: 4 }}>
      <Text style={ui.eyebrow}>LỄ TÂN</Text>
      <Text style={ui.title}>Chào {user.name}</Text>
    </View>
    <Button title="Đăng ký lớp cho hội viên" onPress={() => router.push('/enroll')} />
    <View style={ui.card}>
      <Text style={ui.heading}>Tiếp đón hôm nay</Text>
      <Button secondary title="Xem lịch tập" onPress={() => router.push({ pathname: '/workspace/[resource]', params: { resource: 'schedules' } })} />
      <Button secondary title="Theo dõi thanh toán" onPress={() => router.push('/payments')} />
    </View>
  </Screen>;
}
