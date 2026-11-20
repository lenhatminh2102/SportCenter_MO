import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { homeworksApi } from '@/services/homeworks';
import { classesApi, coachesApi, entityId, referenceId, referenceLabel } from '@/services/operations';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button, Field, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
function HomeworkForm({ token, onSaved }: { token: string; onSaved: () => void }) {
  const load = useCallback(async () => {
    const [coach, classes, students] = await Promise.all([coachesApi.me(token), classesApi.list(token), coachesApi.myStudents(token)]);
    return { classes: classes.filter(item => referenceId(item.coachId) === entityId(coach)), students };
  }, [token]);
  const query = useApiQuery(load);
  const [target, setTarget] = useState<'class' | 'member'>('class');
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(''); const [attachments, setAttachments] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const saving = useRef(false);
  const students = (query.data?.students || []).map(row => row.member).filter((item): item is NonNullable<typeof item> & object => !!item && typeof item === 'object');
  const choices = target === 'class' ? query.data?.classes || [] : students.filter((item, index) => students.findIndex(other => referenceId(other) === referenceId(item)) === index);
  async function save() {
    if (saving.current) return;
    setError('');
    if (!choices.some(item => referenceId(item) === targetId) || !title.trim() || title.trim().length > 200 || !description.trim()) { setError('Chọn lớp/học viên, nhập tiêu đề tối đa 200 ký tự và nội dung bài tập.'); return; }
    if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate)) || new Date(dueDate).toISOString().slice(0, 10) !== dueDate)) { setError('Hạn nộp phải là ngày hợp lệ dạng YYYY-MM-DD.'); return; }
    const links = attachments.split('\n').map(value => value.trim()).filter(Boolean);
    if (links.some(value => { try { return !['https:', 'http:'].includes(new URL(value).protocol); } catch { return true; } })) { setError('Mỗi dòng đính kèm phải là một liên kết HTTP/HTTPS.'); return; }
    saving.current = true; setBusy(true);
    try {
      await homeworksApi.create(token, { ...(target === 'class' ? { classId: targetId } : { memberId: targetId }), title: title.trim(), description: description.trim(), ...(dueDate ? { dueDate } : {}), attachments: links });
      setTitle(''); setDescription(''); setDueDate(''); setAttachments(''); onSaved();
    } catch (e) { setError((e as Error).message); } finally { saving.current = false; setBusy(false); }
  }
  return <View style={ui.card}><Text style={ui.heading}>Giao bài tập</Text><QueryStatus loading={query.loading} error={query.error} retry={query.reload} />
    <Button secondary disabled={busy} title={target === 'class' ? 'Đang giao cho lớp · Chuyển sang học viên' : 'Đang giao cho học viên · Chuyển sang lớp'} onPress={() => { setTarget(target === 'class' ? 'member' : 'class'); setTargetId(''); }} />
    {choices.map(item => <Button key={referenceId(item)} secondary={targetId !== referenceId(item)} disabled={busy} title={referenceLabel(item)} onPress={() => setTargetId(referenceId(item))} />)}
    {!query.loading && !choices.length && <Text style={ui.body}>Chưa có lớp hoặc học viên có thể chọn.</Text>}
    <Field label="Tiêu đề" maxLength={200} value={title} onChangeText={setTitle} editable={!busy} /><Field label="Nội dung" multiline value={description} onChangeText={setDescription} editable={!busy} /><Field label="Hạn nộp (YYYY-MM-DD, tùy chọn)" value={dueDate} onChangeText={setDueDate} editable={!busy} /><Field label="Liên kết đính kèm (mỗi dòng một URL, tùy chọn)" multiline autoCapitalize="none" value={attachments} onChangeText={setAttachments} editable={!busy} />
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}<Button disabled={busy || query.loading || !!query.error} title={busy ? 'Đang giao…' : 'Giao bài tập'} onPress={() => void save()} />
  </View>;
}
export default function Homeworks() {
  const { token, user } = useAuth(); const allowed = ['COACH', 'MEMBER'].includes(user?.role || '');
  const load = useCallback(() => homeworksApi.my(token!), [token]); const query = useApiQuery(load, !!token && allowed, false);
  const { reload } = query;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!user || !token) return <AccessScreen />; if (!allowed) return <AccessScreen denied />;
  return <Screen><Link href="/operations" style={ui.link}>← Không gian của tôi</Link><Text style={ui.title}>{user.role === 'COACH' ? 'Bài tập đã giao' : 'Bài tập về nhà'}</Text>
    {user.role === 'COACH' && <HomeworkForm token={token} onSaved={query.reload} />}<QueryStatus loading={query.loading} error={query.error} retry={query.reload} />
    {query.data?.length === 0 && <Text style={ui.body}>Chưa có bài tập.</Text>}{query.data?.map(item => <View key={entityId(item)} style={ui.card}><Text style={ui.heading}>{String(item.title || '')}</Text><Text selectable style={ui.body}>{String(item.description || '')}</Text>{!!item.classId && <Text style={ui.body}>Lớp: {referenceLabel(item.classId)}</Text>}{!!item.dueDate && <Text style={ui.body}>Hạn nộp: {new Date(String(item.dueDate)).toLocaleDateString('vi-VN', { timeZone: 'Asia/Bangkok' })}</Text>}{Array.isArray(item.attachments) && item.attachments.map((url, index) => <Text key={index} selectable style={ui.body}>{String(url)}</Text>)}</View>)}
  </Screen>;
}
