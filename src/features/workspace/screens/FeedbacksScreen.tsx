import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { classesApi, coachesApi, entityId, referenceId, referenceLabel, type Entity } from '@/services/operations';
import { notificationsApi, ownNotifications } from '@/services/notifications';
import { feedbackRecipients, isFeedback, sendFeedback, validateFeedback, FEEDBACK_TITLE, type FeedbackTarget } from '@/services/feedback';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { ListPage } from '@/components/sport/list-page';
import { Button, Field, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
// Coach: write feedback for a whole class or one student (sent as notifications).
function CoachFeedback({ token }: { token: string }) {
  const load = useCallback(async () => {
    const [coach, classes, students] = await Promise.all([coachesApi.me(token), classesApi.list(token), coachesApi.myStudents(token)]);
    return { classes: classes.filter(item => referenceId(item.coachId) === entityId(coach)), students };
  }, [token]);
  const query = useApiQuery(load);
  const [classId, setClassId] = useState(''); const [target, setTarget] = useState<FeedbackTarget>('class'); const [memberId, setMemberId] = useState('');
  const [content, setContent] = useState(''); const [rating, setRating] = useState<number | undefined>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [sent, setSent] = useState<{ title: string; count: number }[]>([]);
  const pending = useRef(false);
  const classes = query.data?.classes || []; const selectedClass = classes.find(item => entityId(item) === classId);
  const classStudents = feedbackRecipients(query.data?.students || [], 'class', classId);
  async function send() {
    if (pending.current) return;
    const input = { target, classId, className: String(selectedClass?.name || ''), memberId, content, rating };
    const invalid = validateFeedback(input);
    if (invalid) { setError(invalid); return; }
    const recipients = feedbackRecipients(query.data?.students || [], target, classId, memberId);
    if (!recipients.length) { setError('Lớp chưa có học viên đã xác nhận để nhận nhận xét.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await sendFeedback(token, recipients, input);
      if (result.sent) { setSent(current => [{ title: `${target === 'class' ? 'Cả lớp' : recipients[0].fullName} · ${input.className}`, count: result.sent }, ...current].slice(0, 5)); setContent(''); setRating(undefined); }
      if (result.failed.length) setError(`Chưa gửi được tới ${result.failed.map(item => item.fullName || item.memberId).join(', ')}. ${result.error}`);
    } catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Screen><Link href="/coach" style={ui.link}>← Tổng quan</Link><Text style={ui.eyebrow}>ĐỒNG HÀNH CÙNG HỌC VIÊN</Text><Text style={ui.title}>Nhận xét học viên</Text>
    <Text style={ui.body}>Nhận xét cả lớp hoặc từng học viên đã xác nhận. Học viên xem nhận xét ở mục “Nhận xét từ HLV”.</Text>
    <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />
    {query.data && <>
      <View style={ui.card}><Text style={ui.heading}>1. Lớp</Text>{classes.map(item => <Button key={entityId(item)} secondary={classId !== entityId(item)} disabled={busy} title={`${String(item.name)} · ${referenceLabel(item.subjectId)}`} onPress={() => { setClassId(entityId(item)); setMemberId(''); setError(''); }} />)}{!classes.length && <Text style={ui.body}>Bạn chưa được phân công lớp.</Text>}</View>
      {selectedClass && <View style={ui.card}><Text style={ui.heading}>2. Nhận xét cho</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{([['class', `Cả lớp (${classStudents.length})`], ['member', 'Một học viên']] as const).map(([value, label]) => <Button key={value} secondary={target !== value} disabled={busy} title={label} onPress={() => { setTarget(value); setMemberId(''); }} />)}</View>
        {target === 'member' && classStudents.map(item => <Button key={item.memberId} secondary={memberId !== item.memberId} disabled={busy} title={item.fullName || item.memberId} onPress={() => setMemberId(item.memberId)} />)}
        {!classStudents.length && <Text style={ui.body}>Lớp chưa có học viên đã xác nhận.</Text>}
      </View>}
      {selectedClass && <View style={ui.card}><Text style={ui.heading}>3. Nội dung</Text>
        <Field label="Nhận xét" multiline value={content} onChangeText={setContent} editable={!busy} placeholder="Ví dụ: Cả lớp giữ nhịp tốt, cần chú ý khởi động kỹ hơn." />
        <Text style={ui.body}>Đánh giá (tùy chọn)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[1, 2, 3, 4, 5].map(value => <Button key={value} secondary={rating !== value} disabled={busy} title={`${value}★`} onPress={() => setRating(rating === value ? undefined : value)} />)}</View>
        {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
        <Button disabled={busy} title={busy ? 'Đang gửi…' : 'Gửi nhận xét'} onPress={() => void send()} />
      </View>}
      {sent.length > 0 && <View style={ui.card}><Text style={ui.heading}>Đã gửi trong phiên này</Text>{sent.map((item, index) => <Text key={index} style={ui.body}>✓ {item.title} · {item.count} học viên</Text>)}</View>}
    </>}
  </Screen>;
}
// Member: feedback received from coaches (own + class), filtered from notifications.
function MemberFeedback({ token, userId }: { token: string; userId: string }) {
  const load = useCallback(async () => ownNotifications(await notificationsApi.my(token), userId).filter(isFeedback), [token, userId]);
  const query = useApiQuery(load, true, false); const { reload } = query;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return <ListPage title="Nhận xét từ HLV" description="Nhận xét huấn luyện viên gửi cho cả lớp hoặc riêng bạn." items={query.data || []} loading={query.loading} error={query.error} reload={reload} empty="Chưa có nhận xét nào." renderItem={(item: Entity) => <View style={ui.card}><Text style={ui.eyebrow}>{String(item.title || '').replace(`${FEEDBACK_TITLE} · `, '').toUpperCase()}</Text><Text style={ui.body}>{String(item.message || '')}</Text><Text style={[ui.body, { fontSize: 12 }]}>{item.createdAt ? new Date(String(item.createdAt)).toLocaleString('vi-VN') : ''}</Text></View>} />;
}
export default function Feedbacks() {
  const { user, token } = useAuth();
  if (!user || !token) return <AccessScreen />;
  if (user.role === 'COACH') return <CoachFeedback token={token} />;
  if (user.role === 'MEMBER') return <MemberFeedback token={token} userId={user.id} />;
  return <AccessScreen denied />;
}
