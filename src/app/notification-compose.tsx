import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/context/auth';
import { canSendNotification, notificationsApi } from '@/services/notifications';
import { entityId, referenceId, type Entity } from '@/services/operations';
import { AccessScreen } from '@/components/sport/access';
import { RelationField } from '@/components/sport/relation-field';
import { Button, Field, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';

/** Unique member objects from /api/coaches/my-students rows. */
function studentMembers(rows: Entity[]) {
  const members = new Map<string, Entity>();
  for (const row of rows) {
    const member = row.member && typeof row.member === 'object' ? row.member as Entity : undefined;
    if (member && entityId(member) && !members.has(entityId(member))) members.set(entityId(member), member);
  }
  return [...members.values()];
}

/** Manager / receptionist notify a member or a coach; a coach notifies confirmed students of own classes. */
export default function NotificationCompose() {
  const { user, token } = useAuth();
  const [recipient, setRecipient] = useState('');
  const [member, setMember] = useState('');
  const [coach, setCoach] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  if (!user || !token || !canSendNotification(user.role)) return <AccessScreen denied />;
  const isCoach = user.role === 'COACH';

  async function send() {
    if (pending.current) return;
    // A coach picks a student (member profile id) and uses the coach endpoint; staff pick a user id.
    const target = isCoach ? member : recipient;
    if (!/^[a-f\d]{24}$/i.test(target) || !title.trim() || !message.trim()) { setError('Chọn người nhận, nhập tiêu đề và nội dung.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      if (isCoach) await notificationsApi.coach(token!, { memberId: member, title, message });
      else await notificationsApi.create(token!, { userId: recipient, title, message });
      router.replace('/notifications');
    }
    catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }

  return <Screen>
    <Link href="/notifications" style={ui.link}>← Thông báo</Link>
    <View style={{ gap: 6 }}>
      <Text style={ui.eyebrow}>GỬI THÔNG BÁO</Text>
      <Text style={ui.title}>Gửi tin nhắn</Text>
      <Text style={ui.body}>{isCoach ? 'Chọn học viên đã xác nhận trong lớp bạn phụ trách.' : 'Chọn hội viên hoặc huấn luyện viên nhận tin.'} Tin hiện trong ứng dụng, không gửi email.</Text>
    </View>
    <View style={ui.card}>
      <RelationField
        label={isCoach ? 'Học viên nhận tin' : 'Hội viên nhận tin'}
        path={isCoach ? '/api/coaches/my-students' : '/api/members'}
        transformItems={isCoach ? studentMembers : undefined}
        token={token} value={member} onChange={setMember} disabled={busy}
        onSelect={item => { setRecipient(referenceId(item.userId)); setCoach(''); }}
      />
      {!isCoach && <RelationField label="Huấn luyện viên nhận tin" path="/api/coaches" token={token} value={coach} onChange={setCoach} disabled={busy}
        onSelect={item => { setRecipient(referenceId(item.userId)); setMember(''); }} />}
      <Field label="Tiêu đề" value={title} onChangeText={setTitle} editable={!busy} maxLength={200} />
      <Field label="Nội dung" value={message} onChangeText={setMessage} editable={!busy} multiline style={{ minHeight: 110, padding: 14, textAlignVertical: 'top' }} />
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      <Button title={busy ? 'Đang gửi…' : 'Gửi thông báo'} disabled={busy || !(isCoach ? member : recipient)} onPress={send} />
    </View>
  </Screen>;
}
