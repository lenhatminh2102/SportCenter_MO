import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { canConfirmAtDesk, checkInActionLabel, checkInApi, cleanScannedCode, clockTime, secondsLeft, staffName, visitClasses, type CheckInPreview } from '@/services/checkin';
import { roleHome } from '@/utils/staff-navigation';
import { colors } from '@/data/sport';
import { Screen, Button, Field } from '@/components/sport/ui';
import { QueryStatus } from '@/components/sport/access';
import { ui } from '@/components/sport/styles';

const tone = (status: string, active: boolean) => (status === 'PENDING_PAYMENT'
  ? { color: '#b45309', backgroundColor: '#fef3e2' } : active ? { color: colors.green, backgroundColor: '#e7f6ec' } : { color: colors.muted, backgroundColor: '#f4efea' });

/**
 * Front desk: scan a member's QR with the phone camera (or type/paste it), check who it is, then
 * confirm entry or exit. Scanning alone records nothing; the code is used on confirm.
 */
export default function CheckInDesk() {
  const { user, token } = useAuth();
  const allowed = canConfirmAtDesk(user?.role);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState('');
  const [scanned, setScanned] = useState('');
  const [preview, setPreview] = useState<CheckInPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [now, setNow] = useState(() => Date.now());
  // Refs, not state: the camera reports the same code many times a second and a double tap fires
  // twice before React re-renders, so these stop duplicate lookups and confirms.
  const lookingUp = useRef(false);
  const confirming = useRef(false);
  const loadVisits = useCallback(() => checkInApi.visits(token!), [token]);
  const visits = useApiQuery(loadVisits, !!token && allowed, false);
  const { reload: reloadVisits } = visits;
  const [lastVisits, setLastVisits] = useState(visits.data);
  if (visits.data && visits.data !== lastVisits) setLastVisits(visits.data);
  const visitList = (visits.data ?? lastVisits)?.visits;

  useFocusEffect(useCallback(() => { reloadVisits(); return () => setScanning(false); }, [reloadVisits]));

  useEffect(() => {
    if (!preview) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [preview]);

  if (!user || !token) return <Redirect href="/login" />;
  if (!allowed) return <Redirect href={roleHome(user.role)} />;

  async function lookUp(code: string) {
    const value = cleanScannedCode(code);
    if (!value || lookingUp.current) return;
    lookingUp.current = true;
    setScanning(false); setBusy(true); setError(''); setResult(''); setPreview(null); setScanned(value);
    try { setPreview(await checkInApi.preview(token!, value)); setNow(Date.now()); }
    catch (e) { setError((e as Error).message); }
    finally { lookingUp.current = false; setBusy(false); }
  }

  async function startCamera() {
    setError('');
    const answer = permission?.granted ? permission : await requestPermission();
    if (!answer.granted) { setError('Chưa được phép dùng camera. Cho phép camera trong cài đặt, hoặc nhập mã bên dưới.'); return; }
    setResult(''); setPreview(null); setScanning(true);
  }

  async function confirm() {
    if (!preview || confirming.current) return;
    confirming.current = true; setBusy(true); setError('');
    try {
      const done = await checkInApi.confirm(token!, scanned, preview.nextAction);
      const name = done.visit?.member?.fullName || preview.member.fullName;
      const when = clockTime(done.action === 'OUT' ? done.visit.checkedOutAt : done.visit.checkedInAt);
      setResult(`${done.action === 'OUT' ? 'Đã xác nhận ra' : 'Đã xác nhận vào'}: ${name} lúc ${when}${done.alreadyRecorded ? ' (đã ghi trước đó)' : ''}.`);
      setPreview(null); setScanned(''); setManual('');
      reloadVisits();
    } catch (e) { setError((e as Error).message); }
    finally { confirming.current = false; setBusy(false); }
  }

  function reset() { setPreview(null); setScanned(''); setManual(''); setError(''); setResult(''); }

  const left = preview ? secondsLeft(preview.tokenExpiresAt, now) : 0;
  const inside = (visitList || []).filter(visit => visit.status === 'OPEN').length;

  return <Screen>
    <View style={{ gap: 4 }}>
      <Text style={ui.eyebrow}>QUẦY LỄ TÂN</Text>
      <Text style={ui.title}>Quét QR ra/vào</Text>
      <Text style={ui.body}>Quét mã của hội viên, đối chiếu thông tin rồi bấm xác nhận. Chỉ quét thì chưa ghi nhận lượt.</Text>
    </View>

    {!preview && <View style={ui.card}>
      {scanning
        ? <View style={{ aspectRatio: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1f1a17' }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={(scan: BarcodeScanningResult) => { void lookUp(scan.data); }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: '18%', left: '18%', right: '18%', bottom: '18%', borderWidth: 3, borderColor: 'white', borderRadius: 18, opacity: 0.85 }} />
        </View>
        : <View style={{ aspectRatio: 1.6, borderRadius: 14, backgroundColor: '#1f1a17', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Text style={{ fontSize: 34, color: '#cfc4bc' }}>⌗</Text><Text style={{ color: '#cfc4bc' }}>{busy ? 'Đang tra cứu mã…' : 'Camera đang tắt'}</Text>
        </View>}
      {scanning ? <Button secondary title="Tắt camera" onPress={() => setScanning(false)} /> : <Button title="Quét bằng camera" disabled={busy} onPress={() => void startCamera()} />}
      <Field label="Hoặc nhập / dán mã" value={manual} onChangeText={setManual} placeholder="Mã 43 ký tự trên QR" autoCapitalize="none" autoCorrect={false} onSubmitEditing={() => void lookUp(manual)} returnKeyType="search" />
      <Button secondary title="Tra cứu mã" disabled={busy || !manual.trim()} onPress={() => void lookUp(manual)} />
    </View>}

    {!!result && <Text accessibilityRole="alert" style={{ color: colors.green, fontWeight: '700', fontSize: 15 }}>✓ {result}</Text>}
    {!!error && <Text accessibilityRole="alert" style={[ui.error, { fontSize: 15 }]}>{error}</Text>}

    {preview && <View style={ui.card}>
      <View style={ui.row}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '800', fontSize: 20 }}>{preview.member.fullName.split(/\s+/).slice(-1)[0]?.[0] || '?'}</Text></View>
        <View style={{ flex: 1, gap: 2 }}><Text style={ui.heading}>{preview.member.fullName}</Text><Text style={[ui.body, { fontSize: 13 }]}>{preview.member.phone || 'Chưa có số điện thoại'}</Text></View>
      </View>
      <Text style={{ fontWeight: '700', color: preview.openVisit ? colors.green : colors.ink }}>{preview.openVisit ? `Đang ở trung tâm từ ${clockTime(preview.openVisit.checkedInAt)}` : 'Đang ở ngoài trung tâm'}</Text>
      {preview.registrations.length ? preview.registrations.map(item => <View key={item.id} style={[ui.between, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
        <View style={{ flex: 1, gap: 2 }}><Text style={{ fontWeight: '700', color: colors.ink }}>{item.className}</Text><Text style={[ui.body, { fontSize: 13, lineHeight: 18 }]}>{[item.subjectName, item.courseName].filter(Boolean).join(' · ')}</Text></View>
        <Text style={[{ fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' }, tone(item.status, item.active)]}>{item.label}</Text>
      </View>) : <Text style={ui.body}>Hội viên chưa đăng ký lớp nào.</Text>}
      {!preview.allowed && <Text accessibilityRole="alert" style={{ color: '#b45309', fontWeight: '700' }}>{preview.message}</Text>}
      <Text style={[ui.body, { fontSize: 13 }]}>{left ? `Mã còn hiệu lực ${left} giây.` : 'Mã đã hết hạn, nhờ hội viên lấy mã mới.'}</Text>
      <Button title={busy ? 'Đang xác nhận…' : checkInActionLabel(preview.nextAction)} disabled={busy || !preview.allowed || !left} onPress={() => void confirm()} />
      <Button secondary title="Quét mã khác" disabled={busy} onPress={reset} />
    </View>}

    <View style={ui.card}>
      <View style={ui.between}><Text style={ui.heading}>Lượt hôm nay</Text><Text style={[ui.body, { fontSize: 13 }]}>{inside} người đang ở trung tâm</Text></View>
      {!visitList && <QueryStatus loading={visits.loading} error={visits.error} retry={reloadVisits} />}
      {visitList && (visitList.length ? visitList.map(visit => <View key={visit._id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 2 }}>
        <View style={ui.between}><Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{visit.memberId?.fullName || 'Hội viên đã xóa'}</Text>{visit.status === 'OPEN' && <Text style={{ color: colors.green, fontWeight: '700', fontSize: 12 }}>Đang ở trung tâm</Text>}</View>
        {!!visitClasses(visit) && <Text style={[ui.body, { fontSize: 13, lineHeight: 18 }]}>{visitClasses(visit)}</Text>}
        <Text style={[ui.body, { fontSize: 13, lineHeight: 18 }]}>Vào {clockTime(visit.checkedInAt)} · {staffName(visit.checkedInBy)}{visit.checkedOutAt ? `  ·  Ra ${clockTime(visit.checkedOutAt)} · ${staffName(visit.checkedOutBy)}` : ''}</Text>
      </View>) : <Text style={ui.body}>Chưa có lượt nào hôm nay.</Text>)}
      <Button secondary title="Làm mới" onPress={reloadVisits} />
    </View>
  </Screen>;
}
