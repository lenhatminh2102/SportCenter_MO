import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useActorProfile } from '@/hooks/use-actor-profile';

const colors = { primary: '#F4511E', ink: '#20242D', muted: '#64748B', background: '#F7F8FA', white: '#FFFFFF', danger: '#DC2626' };
const glyphs = {
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  wallet: 'M4 6h16v13H4zM20 10h-6v5h6m-4-2h.1',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 4h.01',
  shield: 'M12 22s7-3.5 7-10V5l-7-3-7 3v7c0 6.5 7 10 7 10Z',
  edit: 'm14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-4-4L5 15l-1 5Z',
  chevron: 'm9 18 6-6-6-6',
  logout: 'M10 17l5-5-5-5m5 5H3m9-8h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7',
} as const;

function Icon({ name, color = '#AD3816' }: { name: keyof typeof glyphs; color?: string }) {
  return <Svg accessible={false} width={21} height={21} viewBox="0 0 24 24">
    <Path d={glyphs[name]} stroke={color} fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

type MenuItem = { title: string; detail: string; icon: keyof typeof glyphs; href: Href };
function MenuGroup({ title, items }: { title: string; items: MenuItem[] }) {
  return <View style={styles.group}>
    <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
    <View style={styles.card}>
      {items.map((item, index) => <Pressable key={item.title} accessibilityRole="link" onPress={() => router.push(item.href)}
        style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}>
        <View style={styles.tile}><Icon name={item.icon} /></View>
        <View style={styles.copy}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.detail}>{item.detail}</Text>
        </View>
        <Icon name="chevron" color={colors.muted} />
      </Pressable>)}
    </View>
  </View>;
}

export function MemberAccount({ name, email, status, unread, busy, message, onRefresh, onLogout }: {
  name: string; email: string; status: string; unread: number; busy: boolean; message: string;
  onRefresh: () => Promise<void>; onLogout: () => void;
}) {
  const { data, reload } = useActorProfile();
  const [confirming, setConfirming] = useState(false);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const fullName = typeof data?.fullName === 'string' && data.fullName.trim() ? data.fullName : name;
  const memberCode = typeof data?.memberCode === 'string' ? data.memberCode.trim() : '';

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.page}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.pageTitle}>Tài khoản</Text>
      <View style={styles.hero}>
        <View style={styles.identity}>
          <View style={styles.avatar}><Text style={styles.initial}>{fullName.trim().slice(0, 1).toLocaleUpperCase('vi-VN')}</Text></View>
          <View style={styles.copy}>
            <Text style={styles.name}>{fullName}</Text>
            <Text selectable style={styles.onDark}>{email}</Text>
          </View>
        </View>
        <Text style={status === 'ACTIVE' ? styles.active : styles.onDark}>
          Hội viên · {status === 'ACTIVE' ? 'Đang hoạt động' : status}
        </Text>
        {!!memberCode && <Text style={styles.onDark}>Mã hội viên {memberCode}</Text>}
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile')} style={({ pressed }) => [styles.edit, pressed && styles.dim]}>
          <Icon name="edit" color="#FFB29A" /><Text style={styles.editText}>Chỉnh sửa thông tin</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy}
          onPress={() => void onRefresh().finally(reload)} style={styles.refresh}>
          <Text style={styles.onDark}>{busy ? 'Đang cập nhật…' : 'Làm mới tài khoản'}</Text>
        </Pressable>
        {!!message && <Text accessibilityRole="alert" style={styles.onDark}>{message}</Text>}
      </View>

      <MenuGroup title="Tài khoản của tôi" items={[
        { title: 'Thông tin cá nhân', detail: 'Cập nhật họ tên và số điện thoại', icon: 'user', href: '/profile' },
        { title: 'Hồ sơ tập luyện', detail: 'Xem và cập nhật mục tiêu, trình độ tập luyện', icon: 'activity', href: '/profile' },
        { title: 'Đăng ký của tôi', detail: 'Xem các lớp và trạng thái đăng ký', icon: 'list', href: { pathname: '/workspace/[resource]', params: { resource: 'class-registrations' } } },
        { title: 'Thông báo', detail: unread ? `${unread} thông báo chưa đọc` : 'Xem thông báo từ trung tâm', icon: 'bell', href: '/notifications' },
        { title: 'Thanh toán', detail: 'Xem học phí và lịch sử giao dịch', icon: 'wallet', href: '/payments' },
      ]} />
      <MenuGroup title="Hỗ trợ" items={[
        { title: 'Trung tâm hỗ trợ', detail: 'Gửi yêu cầu và xem phản hồi', icon: 'help', href: '/support' },
        { title: 'Chính sách và bảo mật', detail: 'Xem thông tin sử dụng và tài khoản', icon: 'shield', href: '/terms' },
      ]} />

      <Pressable accessibilityRole="button" onPress={() => setConfirming(true)} style={({ pressed }) => [styles.logout, pressed && styles.dim]}>
        <Icon name="logout" color={colors.danger} /><Text style={styles.dangerText}>Đăng xuất</Text>
      </Pressable>
    </ScrollView>
    <Modal transparent visible={confirming} animationType="fade" onRequestClose={() => setConfirming(false)}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.heading}>Đăng xuất?</Text>
          <Text style={styles.detail}>Bạn sẽ cần đăng nhập lại để sử dụng tài khoản ActiveHub.</Text>
          <View style={styles.dialogActions}>
            <Pressable accessibilityRole="button" onPress={() => setConfirming(false)} style={styles.cancel}>
              <Text style={styles.title}>Ở lại</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setConfirming(false); onLogout(); }} style={styles.logout}>
              <Text style={styles.dangerText}>Đăng xuất</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16, paddingBottom: 24, gap: 20 },
  pageTitle: { color: colors.ink, fontSize: 27, fontWeight: '800' },
  hero: { backgroundColor: colors.ink, borderRadius: 16, padding: 16, gap: 9 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.ink, fontSize: 23, fontWeight: '800' },
  name: { color: colors.white, fontSize: 21, fontWeight: '800' },
  onDark: { color: '#DBE2EB', fontSize: 13 },
  active: { color: '#BBF7D0', fontSize: 13, fontWeight: '700' },
  edit: { backgroundColor: '#373D49', borderRadius: 12, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  editText: { color: colors.white, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  refresh: { minHeight: 44, justifyContent: 'center' },
  group: { gap: 8 },
  heading: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, padding: 12, gap: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0' },
  pressed: { backgroundColor: '#FFF5F0' },
  tile: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0E9' },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  detail: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 14, minHeight: 48, padding: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  dangerText: { color: '#B91C1C', fontSize: 15, fontWeight: '800' },
  dim: { opacity: 0.75 },
  overlay: { flex: 1, padding: 20, backgroundColor: '#10182899', justifyContent: 'center' },
  dialog: { width: '100%', maxWidth: 400, alignSelf: 'center', padding: 18, borderRadius: 16, gap: 12, backgroundColor: colors.white },
  dialogActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  cancel: { padding: 10, minHeight: 48, justifyContent: 'center' },
});
