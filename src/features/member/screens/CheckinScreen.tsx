import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { checkInApi, clockTime, dayTime, mmss, secondsLeft, visitClasses, type IssuedQr } from '@/services/checkin';
import { roleHome } from '@/utils/staff-navigation';
import { colors } from '@/data/sport';
import { Screen, Button } from '@/components/sport/ui';
import { QueryStatus } from '@/components/sport/access';
import { ui } from '@/components/sport/styles';

const POLL_MS = 3000;
const badge = (status: string, active: boolean) => (status === 'PENDING_PAYMENT'
  ? { color: '#b45309', backgroundColor: '#fef3e2' } : active ? { color: colors.green, backgroundColor: '#e7f6ec' } : { color: colors.muted, backgroundColor: '#f4efea' });

/** Member: registration status, a short-lived single-use QR for the front desk, and past visits. */
export default function CheckInPass() {
  const { user, token } = useAuth();
  const member = user?.role === 'MEMBER';
  const [qr, setQr] = useState<IssuedQr | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const loadAccess = useCallback(() => checkInApi.me(token!), [token]);
  const access = useApiQuery(loadAccess, !!token && member, false);
  const loadVisits = useCallback(() => checkInApi.myVisits(token!), [token]);
  const visits = useApiQuery(loadVisits, !!token && member, false);
  const { reload: reloadAccess } = access;
  const { reload: reloadVisits } = visits;
  // reload() empties `data` until the answer arrives; keep the last answer on screen so the poll
  // below does not blank the page every few seconds.
  const [lastAccess, setLastAccess] = useState(access.data);
  const [lastVisits, setLastVisits] = useState(visits.data);
  if (access.data && access.data !== lastAccess) setLastAccess(access.data);
  if (visits.data && visits.data !== lastVisits) setLastVisits(visits.data);
  const data = access.data ?? lastAccess;
  const visitList = visits.data ?? lastVisits;
  const openSince = data?.openVisit?.checkedInAt || '';
  const lastOpen = useRef<string | undefined>(undefined);

  useFocusEffect(useCallback(() => { reloadAccess(); reloadVisits(); }, [reloadAccess, reloadVisits]));

  // While a code is on screen: tick the countdown and watch for the front desk's confirmation.
  useEffect(() => {
    if (!qr) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(reloadAccess, POLL_MS);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [qr, reloadAccess]);

  // The visit opened or closed → the code shown was used: hide it and say what happened.
  useEffect(() => {
    if (!data) return;
    if (lastOpen.current !== undefined && lastOpen.current !== openSince) {
      setQr(null);
      setNotice(openSince ? `Lễ tân đã xác nhận vào lúc ${clockTime(openSince)}.` : 'Lễ tân đã xác nhận ra. Hẹn gặp lại!');
      reloadVisits();
    }
    lastOpen.current = openSince;
  }, [data, openSince, reloadVisits]);

  if (!user || !token) return <Redirect href="/login" />;
  if (!member) return <Redirect href={roleHome(user.role)} />;

  async function getCode() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { setQr(await checkInApi.issueQr(token!)); setNow(Date.now()); }
    catch (e) { setError((e as Error).message); reloadAccess(); }
    finally { setBusy(false); }
  }

  const left = qr ? secondsLeft(qr.expiresAt, now) : 0;
  const action = data?.nextAction === 'OUT' ? 'ra' : 'vào';

  return <Screen>
    <View style={{ gap: 4 }}>
      <Text style={ui.eyebrow}>RA/VÀO TRUNG TÂM</Text>
      <Text style={ui.title}>Mã QR ra/vào</Text>
      <Text style={ui.body}>Đưa mã cho lễ tân quét khi đến và khi rời trung tâm. Mỗi mã dùng một lần, hết hạn sau 2 phút.</Text>
    </View>
    {!data && <QueryStatus loading={access.loading} error={access.error} retry={reloadAccess} />}
    {data && <>
      <View style={[ui.card, { backgroundColor: data.openVisit ? '#e7f6ec' : colors.surface, borderColor: data.openVisit ? '#cdebd8' : colors.border, gap: 4 }]}>
        <Text style={[ui.heading, { fontSize: 17, color: data.openVisit ? colors.green : colors.ink }]}>{data.openVisit ? '✓ Đang ở trung tâm' : 'Đang ở ngoài trung tâm'}</Text>
        <Text style={ui.body}>{data.openVisit ? `Vào lúc ${clockTime(data.openVisit.checkedInAt)} · nhớ đưa mã cho lễ tân khi ra về` : 'Lấy mã khi đến quầy lễ tân'}</Text>
      </View>
      {!!notice && <Text accessibilityRole="alert" style={{ color: colors.green, fontWeight: '700', fontSize: 15 }}>{notice}</Text>}
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}

      {!data.allowed && <View style={[ui.card, { alignItems: 'center' }]}>
        <Text style={{ fontSize: 30 }}>🔒</Text>
        <Text style={[ui.body, { textAlign: 'center' }]}>{data.message}</Text>
        <View style={{ alignSelf: 'stretch' }}>{data.code === 'PENDING_APPROVAL'
          ? <Button secondary title="Xem đăng ký của tôi" onPress={() => router.push({ pathname: '/workspace/[resource]', params: { resource: 'class-registrations' } })} />
          : <Button title="Khám phá lớp học" onPress={() => router.navigate('/explore')} />}</View>
      </View>}

      {data.allowed && !qr && <View style={[ui.card, { alignItems: 'center' }]}>
        <Text style={[ui.body, { textAlign: 'center' }]}>Mã dùng để xác nhận <Text style={{ fontWeight: '800', color: colors.ink }}>{action}</Text> trung tâm.</Text>
        <View style={{ alignSelf: 'stretch' }}><Button title={busy ? 'Đang tạo mã…' : `Lấy mã QR ${action}`} disabled={busy} onPress={() => void getCode()} /></View>
      </View>}

      {data.allowed && qr && <View style={[ui.card, { alignItems: 'center' }]}>
        <View style={{ padding: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: 'white' }}>
          <Image source={{ uri: qr.qrImage }} accessibilityLabel={`Mã QR ${action} trung tâm`} style={{ width: 240, height: 240, opacity: left ? 1 : 0.12 }} />
          {!left && <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}><Text style={ui.heading}>Mã đã hết hạn</Text></View>}
        </View>
        <Text style={{ fontSize: 16, color: colors.ink }}>{left ? <>Mã {action} · còn <Text style={{ fontWeight: '800' }}>{mmss(left)}</Text></> : 'Lấy mã mới để tiếp tục'}</Text>
        <View style={{ alignSelf: 'stretch' }}><Button secondary={!!left} title={busy ? 'Đang tạo mã…' : 'Lấy mã mới'} disabled={busy} onPress={() => void getCode()} /></View>
        <Text style={[ui.body, { fontSize: 13, textAlign: 'center' }]}>Mã chỉ chứa một chuỗi ngẫu nhiên, không chứa thông tin cá nhân. Lấy mã mới thì mã cũ hết hiệu lực.</Text>
      </View>}

      <View style={ui.card}>
        <Text style={ui.heading}>Đăng ký của tôi</Text>
        {data.registrations.length ? data.registrations.map(item => <View key={item.id} style={[ui.between, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
          <View style={{ flex: 1, gap: 2 }}><Text style={{ fontWeight: '700', color: colors.ink, fontSize: 15 }}>{item.className}</Text><Text style={[ui.body, { fontSize: 13, lineHeight: 18 }]}>{[item.subjectName, item.courseName].filter(Boolean).join(' · ')}</Text></View>
          <Text style={[{ fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' }, badge(item.status, item.active)]}>{item.label}</Text>
        </View>) : <Text style={ui.body}>Chưa có đăng ký lớp. Đăng ký một lớp để có mã QR ra/vào.</Text>}
      </View>
    </>}

    <View style={ui.card}>
      <Text style={ui.heading}>Lượt ra/vào gần đây</Text>
      {!visitList && <QueryStatus loading={visits.loading} error={visits.error} retry={reloadVisits} />}
      {visitList && (visitList.length ? visitList.map(visit => <View key={visit._id} style={[ui.between, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
        <View style={{ flex: 1, gap: 2 }}><Text style={{ fontWeight: '700', color: colors.ink, fontSize: 15 }}>Vào {dayTime(visit.checkedInAt)}</Text><Text style={[ui.body, { fontSize: 13, lineHeight: 18 }]}>{visit.checkedOutAt ? `Ra ${dayTime(visit.checkedOutAt)}` : visit.status === 'OPEN' ? 'Đang ở trung tâm' : 'Không ghi giờ ra'}</Text></View>
        <Text style={[ui.body, { fontSize: 13, flexShrink: 1, textAlign: 'right' }]}>{visitClasses(visit)}</Text>
      </View>) : <Text style={ui.body}>Chưa có lượt nào. Lượt ra/vào xuất hiện sau khi lễ tân xác nhận.</Text>)}
    </View>
  </Screen>;
}
