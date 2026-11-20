import { useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { entityId, type Entity } from '@/services/operations';
import { currency } from '@/services/payments';
import { confirmRegistrationAtDesk, type DeskPaymentMethod } from '@/services/checkin';
import { Button } from './ui';
import { ui } from './styles';

const METHODS: [DeskPaymentMethod, string][] = [['CASH', 'Tiền mặt'], ['BANK_TRANSFER', 'Chuyển khoản']];

/** Front desk: collect the fee, then confirm the registration. That turns on the member's QR. */
export function DeskConfirmRegistration({ item, token, amount, onConfirmed }: { item: Entity; token: string; amount?: unknown; onConfirmed: () => void }) {
  const [method, setMethod] = useState<DeskPaymentMethod>('CASH');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const methodLabel = METHODS.find(([value]) => value === method)?.[1].toLowerCase();
  async function confirm() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await confirmRegistrationAtDesk(token, entityId(item), method); setOpen(false); onConfirmed(); }
    catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  return <View style={ui.card}>
    <Text style={ui.heading}>Xác nhận đăng ký tại quầy</Text>
    <Text style={ui.body}>Thu học phí {amount !== undefined ? currency(amount) : ''} rồi xác nhận. Hội viên nhận thông báo và có ngay mã QR ra/vào trung tâm.</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>{METHODS.map(([value, label]) => <View key={value} style={{ flex: 1 }}><Button secondary={method !== value} title={label} onPress={() => setMethod(value)} /></View>)}</View>
    {!!error && !open && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Button title="Xác nhận đăng ký" onPress={() => { setError(''); setOpen(true); }} />
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}><View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0008' }}><View accessibilityViewIsModal style={[ui.card, { maxWidth: 480, width: '100%', alignSelf: 'center' }]}>
      <Text style={ui.heading}>Đã thu tiền và xác nhận đăng ký?</Text>
      <Text style={ui.body}>Ghi nhận {amount !== undefined ? currency(amount) : 'học phí'} ({methodLabel}) và xác nhận đăng ký. Thao tác này kích hoạt mã QR ra/vào cho hội viên.</Text>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      <Button title={busy ? 'Đang xác nhận…' : 'Đã thu tiền, xác nhận'} disabled={busy} onPress={() => void confirm()} />
      <Button secondary title="Chưa" disabled={busy} onPress={() => setOpen(false)} />
    </View></View></Modal>
  </View>;
}
