import { useCallback, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { entityId, type Entity } from '@/services/operations';
import { currency, paymentsApi } from '@/services/payments';
import { Button } from './ui';
import { ui } from './styles';

export function PaymentManagement({ item, token, role, registration, onRefresh }: {
  item: Entity; token: string; role: string; registration?: Entity; onRefresh: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const recording = useRef(false);
  const id = entityId(item);
  useFocusEffect(useCallback(() => {
    if (item.status !== 'PENDING') return;
    let active = true; let checking = false;
    async function check() {
      if (!active || checking || recording.current || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      checking = true;
      try {
        const result = await paymentsApi.status(token, id);
        if (active && (result.status !== item.status || registration && result.registrationStatus !== registration.status)) onRefresh();
      } catch { /* Manual checking below reports errors; background retries stay quiet. */ }
      finally { checking = false; }
    }
    void check();
    const timer = setInterval(() => void check(), 10000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [id, token, item.status, registration, onRefresh]));
  async function run(record: boolean) {
    if (recording.current) return;
    recording.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (record) { await paymentsApi.record(token, id); setConfirm(false); }
      else { const result = await paymentsApi.status(token, id); setMessage(result.status === 'SUCCESS' ? 'Đã thanh toán thành công.' : result.status === 'FAILED' ? 'Thanh toán thất bại. Quay lại đăng ký để tạo yêu cầu mới.' : 'Chưa có xác nhận thanh toán từ hệ thống.'); }
      onRefresh();
    } catch (e) { setError((e as Error).message); if (record) onRefresh(); }
    finally { recording.current = false; setBusy(false); }
  }
  const canRecord = ['RECEPTIONIST', 'CENTER_MANAGER'].includes(role) && item.status === 'PENDING' && ['CASH', 'BANK_TRANSFER'].includes(String(item.paymentMethod)) && registration?.status === 'PENDING_PAYMENT';
  return <View style={ui.card}>
    {item.status === 'PENDING' && <Button secondary disabled={busy} title="Kiểm tra trạng thái giao dịch" onPress={() => void run(false)} />}
    {canRecord && (confirm ? <><Text style={ui.body}>Xác nhận đã nhận đủ {currency(item.amount)} bằng {item.paymentMethod === 'CASH' ? 'tiền mặt' : 'chuyển khoản'}? Thao tác này xác nhận đăng ký lớp.</Text><Button disabled={busy} title={busy ? 'Đang xác nhận…' : 'Đã nhận tiền · Xác nhận'} onPress={() => void run(true)} /><Button secondary disabled={busy} title="Hủy" onPress={() => setConfirm(false)} /></> : <Button title="Xác nhận đã thu tiền" onPress={() => setConfirm(true)} />)}
    {item.status === 'SUCCESS' && <Button title="Xem biên nhận" onPress={() => router.push({ pathname: '/payment-receipt', params: { id } })} />}
    {!!message && <Text style={ui.body}>{message}</Text>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </View>;
}
