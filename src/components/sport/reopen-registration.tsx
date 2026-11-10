import { useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { entityId, type Entity } from '@/services/operations';
import { currency } from '@/services/payments';
import { reopenRegistration } from '@/services/registration-reopen';
import { Button } from './ui';
import { ui } from './styles';
/** Staff action: reopen a cancelled registration so the member can pay and join again. */
export function ReopenRegistration({ item, token, pendingAmount, onReopened }: { item: Entity; token: string; pendingAmount?: unknown; onReopened: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  async function reopen() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await reopenRegistration(token, entityId(item)); setOpen(false); onReopened(); }
    catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  return <><Button title="Mở lại đăng ký" onPress={() => { setError(''); setOpen(true); }} /><Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}><View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0008' }}><View accessibilityViewIsModal style={[ui.card, { maxWidth: 480, width: '100%', alignSelf: 'center' }]}>
    <Text style={ui.heading}>Mở lại đăng ký lớp này?</Text>
    <Text style={ui.body}>Đăng ký chuyển về trạng thái chờ thanh toán. Hội viên chỉ được xác nhận vào lớp sau khi thanh toán thành công.</Text>
    <Text style={ui.body}>{pendingAmount !== undefined ? `Yêu cầu thanh toán cũ ${currency(pendingAmount)} sẽ được dùng lại: hội viên thanh toán online, hoặc lễ tân xác nhận thu tiền tại quầy.` : 'Sau khi mở lại, tạo yêu cầu thanh toán cho hội viên.'}</Text>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Button title={busy ? 'Đang mở lại…' : 'Xác nhận mở lại'} disabled={busy} onPress={() => void reopen()} />
    <Button secondary title="Giữ trạng thái đã hủy" disabled={busy} onPress={() => setOpen(false)} />
  </View></View></Modal></>;
}
