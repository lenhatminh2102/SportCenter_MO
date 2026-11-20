import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth';
import { ApiError } from '@/services/api';
import { classRegistrationsApi, entityId, referenceLabel, type Entity } from '@/services/operations';
import { currency, paymentMethods, paymentsApi, registrationFor } from '@/services/payments';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';

const MAX_AUTO_CHECKS = 5;
type Result = { status: { status?: string; registrationStatus?: string; paymentDate?: string }; payment: Entity | null; registration: Entity | null };

/** Landing screen after payOS. The status always comes from the BE (which asks payOS), never from the link. */
export default function PaymentResult() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const { user, token } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !id) return undefined;
    let active = true;
    Promise.all([paymentsApi.status(token, id), paymentsApi.list(token), classRegistrationsApi.list(token)])
      .then(([status, payments, registrations]) => {
        const payment = payments.find(item => entityId(item) === id) || null;
        if (active) { setData({ status: status as Result['status'], payment, registration: payment ? registrationFor(payment, registrations) || null : null }); setError(null); setLoading(false); }
      })
      .catch(e => { if (active) { setError(e instanceof ApiError && [403, 404].includes(e.status) ? new Error('Không tìm thấy giao dịch này trong tài khoản đang đăng nhập.') : e as Error); setLoading(false); } });
    return () => { active = false; };
  }, [token, id, attempt]);

  const state = data?.status.status;
  // payOS can take a few seconds to settle: re-check a pending payment automatically.
  useEffect(() => {
    if (state !== 'PENDING' || attempt >= MAX_AUTO_CHECKS) return undefined;
    const timer = setTimeout(() => setAttempt(value => value + 1), 3000);
    return () => clearTimeout(timer);
  }, [state, attempt]);

  // Paid and enrolled: continue in the registration screen, which shows the success notice.
  const enrolledId = state === 'SUCCESS' && data?.registration && data.status.registrationStatus === 'CONFIRMED' ? entityId(data.registration) : '';
  useEffect(() => {
    if (enrolledId) router.replace({ pathname: '/registration-detail', params: { id: enrolledId, paid: id } });
  }, [enrolledId, id]);

  if (!user || !token) return <AccessScreen />;
  const view = state === 'SUCCESS'
    ? { tone: colors.green, bg: '#e7f6ec', icon: '✓', title: 'Thanh toán thành công', text: data?.status.registrationStatus === 'CANCELLED' ? 'Đã nhận tiền nhưng đăng ký lớp đã bị hủy. Vui lòng liên hệ lễ tân để được hoàn tiền.' : 'Đăng ký lớp của bạn đã được xác nhận.' }
    : state === 'FAILED'
      ? { tone: '#b91c1c', bg: '#fdeceb', icon: '!', title: 'Thanh toán chưa thành công', text: 'Giao dịch đã bị hủy hoặc hết hạn, bạn chưa bị trừ tiền. Hãy tạo yêu cầu thanh toán mới để tiếp tục.' }
      : { tone: '#b45309', bg: '#fff4e0', icon: '…', title: 'Đang chờ xác nhận', text: attempt < MAX_AUTO_CHECKS ? 'Hệ thống đang xác nhận giao dịch với payOS…' : 'Chưa nhận được kết quả. Nếu bạn đã chuyển khoản, đợi một lát rồi kiểm tra lại.' };

  return <Screen>
    <QueryStatus loading={loading && !data} error={error} retry={() => { setLoading(true); setAttempt(value => value + 1); }} />
    {data && <View style={[ui.card, { alignItems: 'center', paddingVertical: 28 }]}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: view.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 32, color: view.tone, fontWeight: '800' }}>{view.icon}</Text></View>
      <Text style={[ui.heading, { fontSize: 24, textAlign: 'center' }]}>{view.title}</Text>
      <Text style={[ui.body, { textAlign: 'center' }]}>{view.text}</Text>
      {data.payment && <Text style={[ui.title, { fontSize: 30 }]}>{currency(data.payment.amount)}</Text>}
      <View style={{ alignSelf: 'stretch', gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
        <Text style={ui.body}>Lớp học: <Text style={{ color: colors.ink, fontWeight: '700' }}>{referenceLabel(data.registration?.classId)}</Text></Text>
        <Text style={ui.body}>Phương thức: <Text style={{ color: colors.ink, fontWeight: '700' }}>{paymentMethods.find(item => item.value === data.payment?.paymentMethod)?.label || '—'}</Text></Text>
        <Text style={ui.body}>Mã giao dịch: <Text style={{ color: colors.ink, fontWeight: '700' }}>{id.slice(-8).toUpperCase()}</Text></Text>
      </View>
      <View style={{ alignSelf: 'stretch', gap: 10 }}>
        {state === 'SUCCESS' && <Button title="Xem hóa đơn" onPress={() => router.push({ pathname: '/payment-receipt', params: { id } })} />}
        {state === 'FAILED' && data.registration && <Button title="Thanh toán lại" onPress={() => router.replace({ pathname: '/registration-detail', params: { id: entityId(data.registration!) } })} />}
        {state === 'PENDING' && <Button title="Kiểm tra lại" onPress={() => setAttempt(value => value + 1)} />}
        <Button secondary title="Về trang thanh toán" onPress={() => router.replace('/payments')} />
      </View>
    </View>}
  </Screen>;
}
