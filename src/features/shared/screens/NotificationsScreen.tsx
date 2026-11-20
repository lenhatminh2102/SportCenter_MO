import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { canSendNotification, notificationsApi, ownNotifications } from '@/services/notifications';
import { entityId, type Entity } from '@/services/operations';
import { AccessScreen } from '@/components/sport/access';
import { ListPage } from '@/components/sport/list-page';
import { Button } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';

const when = (value: unknown) => (value ? new Date(String(value)).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }) : '');

/** My notifications: tap one to mark it read; unread first-class styling. */
export default function Notifications() {
  const { token, user } = useAuth();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const load = useCallback(async () => ownNotifications(await notificationsApi.my(token!), user!.id), [token, user]);
  const query = useApiQuery(load, !!token && !!user);
  useFocusEffect(useCallback(() => { query.reload(); }, [query.reload])); // eslint-disable-line react-hooks/exhaustive-deps
  if (!token || !user) return <AccessScreen />;

  async function toggle(item: Entity) {
    if (pending.current) return;
    pending.current = true; setBusy(entityId(item)); setError('');
    try { await notificationsApi.setRead(token!, entityId(item), !item.isRead); query.reload(); }
    catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(''); }
  }

  const items = (query.data || []).filter(item => !unreadOnly || !item.isRead);
  const unread = query.data?.filter(item => !item.isRead).length;
  return <ListPage
    title="Thông báo của tôi"
    description={unread === undefined ? 'Tin từ trung tâm và huấn luyện viên.' : unread ? `${unread} thông báo chưa đọc` : 'Bạn đã đọc hết thông báo.'}
    items={items}
    loading={query.loading}
    error={query.error}
    reload={query.reload}
    empty={unreadOnly ? 'Không có thông báo chưa đọc.' : 'Chưa có thông báo nào.'}
    controls={<View style={{ gap: 10 }}>
      <View style={ui.row}>
        <View style={{ flex: 1 }}><Button secondary title={unreadOnly ? 'Hiện tất cả' : 'Chỉ chưa đọc'} onPress={() => setUnreadOnly(value => !value)} /></View>
        {canSendNotification(user.role) && <View style={{ flex: 1 }}><Button title="+ Gửi thông báo" onPress={() => router.push('/notification-compose')} /></View>}
      </View>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    </View>}
    renderItem={item => {
      const read = !!item.isRead;
      return <Pressable accessibilityRole="button" accessibilityLabel={`${String(item.title || '')}${read ? '' : ', chưa đọc'}. Chạm để đánh dấu ${read ? 'chưa đọc' : 'đã đọc'}`} disabled={!!busy} onPress={() => toggle(item)}
        style={[ui.card, { borderLeftWidth: 4, borderLeftColor: read ? colors.border : colors.primary, backgroundColor: read ? '#fff' : '#fff8f3' }]}>
        <View style={ui.between}>
          <Text style={[ui.eyebrow, { color: read ? colors.muted : colors.primary }]}>{read ? 'ĐÃ ĐỌC' : '● CHƯA ĐỌC'}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{when(item.createdAt)}</Text>
        </View>
        <Text style={[ui.heading, { fontSize: 17 }]}>{String(item.title || '')}</Text>
        <Text style={ui.body}>{String(item.message || '')}</Text>
        <Text style={[ui.link, { fontSize: 13 }]}>{busy === entityId(item) ? 'Đang cập nhật…' : read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}</Text>
      </Pressable>;
    }}
  />;
}
