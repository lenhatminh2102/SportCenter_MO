import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useActorProfile } from '@/hooks/use-actor-profile';
import { useApiQuery } from '@/hooks/use-api-query';
import { supportApi, canResolveSupport, ownSupport, supportResponder, supportSource } from '@/services/support';
import { entityId, referenceLabel, type Entity } from '@/services/operations';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { ListPage } from '@/components/sport/list-page';
import { Button, Field } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';

type Filter = 'ALL' | 'PENDING' | 'RESOLVED';
const FILTERS: [Filter, string][] = [['PENDING', 'Chờ xử lý'], ['RESOLVED', 'Đã giải quyết'], ['ALL', 'Tất cả']];
const when = (value: unknown) => (value ? new Date(String(value)).toLocaleString('vi-VN') : '');

/** The center's answer, shown to both the member and staff. */
function SupportAnswer({ item }: { item: Entity }) {
  if (!item.response) return null;
  return <View style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, backgroundColor: '#fff6ee', padding: 12, gap: 4 }}>
    <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 13 }}>Phản hồi từ {supportResponder(item)}{item.respondedAt ? ` · ${when(item.respondedAt)}` : ''}</Text>
    <Text style={ui.body}>{String(item.response)}</Text>
  </View>;
}

/** Staff: write the answer, then send it (keeps the request open) or send and close. */
function SupportReply({ item, busy, onReply, onReopen }: { item: Entity; busy: boolean; onReply: (response: string, close: boolean, done: () => void) => void; onReopen: () => void }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  if (item.status === 'RESOLVED') return <Button secondary disabled={busy} title="Mở lại yêu cầu" onPress={onReopen} />;
  const send = (close: boolean) => {
    if (draft.trim().length > 2000) { setError('Phản hồi tối đa 2000 ký tự.'); return; }
    setError('');
    onReply(draft, close, () => setDraft(''));
  };
  return <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
    <Field label="Phản hồi cho hội viên" multiline value={draft} onChangeText={value => { setDraft(value); setError(''); }} editable={!busy} placeholder="Ví dụ: Trung tâm đã đổi bạn sang lớp tối thứ 3." error={error} />
    <Button disabled={busy || !draft.trim()} title="Gửi phản hồi và đóng" onPress={() => send(true)} />
    <Button secondary disabled={busy || !draft.trim()} title="Gửi phản hồi" onPress={() => send(false)} />
    <Button secondary disabled={busy} title="Đóng không cần phản hồi" onPress={() => onReply('', true, () => setDraft(''))} />
  </View>;
}

/** Members send requests and read the center's answers; receptionist/manager answer and close them. */
export default function Support() {
  const { user, token } = useAuth(); const member = user?.role === 'MEMBER'; const staff = canResolveSupport(user?.role);
  const actor = useActorProfile(member); const actorId = actor.data ? entityId(actor.data) : '';
  // Opened from a session screen (?topic=…): start the request with that session named.
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const [message, setMessage] = useState(() => (topic ? `Về ${topic}: ` : ''));
  // Staff work the open requests first; members see everything they sent.
  const [filter, setFilter] = useState<Filter>(staff ? 'PENDING' : 'ALL');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const pending = useRef(false);
  const load = useCallback(async () => { const items = await supportApi.list(token!); return member ? ownSupport(items, actorId) : items; }, [token, member, actorId]);
  const query = useApiQuery(load, !!token && (staff || member && !!actorId), false);
  const { reload } = query;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!user || !token) return <AccessScreen />;
  if (!member && !staff) return <AccessScreen denied />;

  async function run(action: () => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await action(); query.reload(); }
    catch (e) { setError((e as Error).message); } finally { pending.current = false; setBusy(false); }
  }
  function send() {
    if (!message.trim()) { setError('Nhập nội dung cần hỗ trợ.'); return; }
    void run(async () => { await supportApi.create(token!, actorId, message); setMessage(''); });
  }
  const all = query.data || [];
  const count = (value: Filter) => all.filter(item => value === 'ALL' || item.status === value).length;

  return <ListPage
    title={member ? 'Trung tâm hỗ trợ' : 'Yêu cầu từ hội viên'}
    description={member ? 'Gửi yêu cầu đổi lịch, hỏi thông tin lớp học; câu trả lời của trung tâm hiện ngay dưới yêu cầu.' : 'Trả lời yêu cầu của hội viên rồi đóng lại; hội viên nhận câu trả lời kèm thông báo.'}
    items={all.filter(item => filter === 'ALL' || item.status === filter)}
    loading={query.loading || member && actor.loading} error={query.error} reload={query.reload}
    controls={<View style={{ gap: 12 }}>
      {member && <>
        <QueryStatus loading={actor.loading} error={actor.error} retry={actor.reload} />
        {actor.error ? <Link href="/profile" style={ui.link}>Hoàn thiện hồ sơ hội viên →</Link> : <View style={ui.card}>
          <Text style={ui.heading}>Bạn cần hỗ trợ gì?</Text>
          <Field label="Nội dung yêu cầu" multiline value={message} onChangeText={setMessage} editable={!busy} />
          <Button title={busy ? 'Đang gửi…' : 'Gửi yêu cầu'} disabled={busy || !actorId} onPress={send} />
        </View>}
      </>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map(([value, label]) => <Button key={value} secondary={value !== filter} title={`${label}${query.data ? ` (${count(value)})` : ''}`} onPress={() => setFilter(value)} />)}
      </View>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    </View>}
    renderItem={item => <View style={ui.card}>
      <Text style={ui.eyebrow}>{item.status === 'RESOLVED' ? '✓ ĐÃ GIẢI QUYẾT' : '◷ CHỜ XỬ LÝ'}</Text>
      {staff && <Text style={ui.heading}>{referenceLabel(item.memberId)}</Text>}
      <Text style={ui.body}>{String(item.message || '')}</Text>
      <Text style={[ui.body, { fontSize: 13 }]}>{[when(item.createdAt), staff ? supportSource(item) : ''].filter(Boolean).join(' · ')}</Text>
      <SupportAnswer item={item} />
      {member && item.status === 'PENDING' && !item.response && <Text style={[ui.body, { fontSize: 13 }]}>Trung tâm sẽ trả lời tại đây và gửi thông báo cho bạn.</Text>}
      {staff && <SupportReply
        item={item}
        busy={busy}
        onReply={(response, close, done) => void run(async () => {
          await (response.trim() ? supportApi.reply(token!, entityId(item), response, close) : supportApi.update(token!, entityId(item), 'RESOLVED'));
          done();
        })}
        onReopen={() => void run(() => supportApi.update(token!, entityId(item), 'PENDING'))}
      />}
    </View>}
  />;
}
