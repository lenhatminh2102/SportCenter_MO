import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useFocusEffect, type Href } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { loadMemberHome, upcomingMemberSessions } from '@/services/member-home';
import { coursesApi, entityId, referenceId, referenceLabel, schedulesApi, type Entity } from '@/services/operations';
import { isVoidedPayment, registrationFor } from '@/services/payments';
import { roleHome } from '@/utils/staff-navigation';
import { ClassCover } from '@/components/sport/class-cover';
import { QueryStatus } from '@/components/sport/access';

const tone = { orange: '#F4511E', dark: '#20242D', bg: '#F7F8FA', white: '#FFFFFF', muted: '#64748B', green: '#16A34A', warning: '#F59E0B', red: '#B91C1C' };
const scheduleLink = { pathname: '/workspace/[resource]', params: { resource: 'schedules' } } as const;
const iconPaths = {
  bolt: 'm13 2-9 12h7l-1 8 10-12h-7l1-8Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  qr: 'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3v3h3m-6 3h3m3-6v1',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 5 5',
  layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  calendar: 'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',
  check: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-4 9 3 3 5-6',
  wallet: 'M4 6h16v13H4zM20 10h-6v5h6m-4-2h.1',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  user: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2',
} as const;

function Icon({ name, color }: { name: keyof typeof iconPaths; color: string }) {
  return <Svg width={21} height={21} viewBox="0 0 24 24" accessible={false}>
    <Path d={iconPaths[name]} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

function Action({ label, href, icon = 'arrow', primary = false, alert }: {
  label: string; href: Href; icon?: keyof typeof iconPaths; primary?: boolean; alert?: 'warning' | 'urgent';
}) {
  return <Pressable accessibilityRole="button" onPress={() => router.push(href)}
    style={({ pressed }) => [styles.action, primary && styles.primary, alert && styles[alert], pressed && styles.pressed]}>
    <Icon name={icon} color={primary ? tone.white : tone.dark} />
    <Text style={[styles.strong, primary && styles.white]}>{label}</Text>
  </Pressable>;
}

function SectionTitle({ title, link }: { title: string; link?: Href }) {
  return <View style={styles.headingRow}>
    <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
    {link && <Pressable accessibilityRole="link" onPress={() => router.push(link)} style={styles.linkTarget}>
      <Text style={styles.link}>Xem tất cả</Text>
    </Pressable>}
  </View>;
}

function dateAndTime(item: Entity) {
  const day = String(item.date ?? '').slice(0, 10).split('-').reverse().join('/');
  return [day, [item.startTime, item.endTime].filter(Boolean).join(' – ')].filter(Boolean).join(' · ');
}

function embedded(value: unknown): Entity | undefined {
  return value && typeof value === 'object' ? value as Entity : undefined;
}

export default function MemberHome() {
  const { user, token } = useAuth();
  const { width, fontScale } = useWindowDimensions();
  const userId = user?.id;
  const load = useCallback(async () => {
    if (!token || !userId) throw new Error('Phiên đăng nhập đã kết thúc.');
    const [home, courses, catalogSchedules] = await Promise.all([
      loadMemberHome(token, userId),
      coursesApi.list(token).catch(() => []),
      schedulesApi.list(token).catch(() => []),
    ]);
    return { ...home, courses, catalogSchedules };
  }, [token, userId]);
  const query = useApiQuery(load, !!token && user?.role === 'MEMBER', false);
  const { reload } = query;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!user || !token) return <Redirect href="/login" />;
  if (user.role !== 'MEMBER') return <Redirect href={roleHome(user.role)} />;

  const data = query.data;
  const name = data?.profile?.fullName || user.name;
  const upcoming = upcomingMemberSessions(data?.schedules ?? []);
  const pending = data?.payments?.filter(item => item.status === 'PENDING' &&
    !isVoidedPayment(item, registrationFor(item, data.registrations ?? []))).length;
  const confirmed = data?.registrations?.filter(item => item.status === 'CONFIRMED');
  const ongoingClasses = data?.schedules && confirmed
    ? new Set(data.schedules.filter(item => item.status === 'SCHEDULED').map(item => referenceId(item.classId))) : null;
  const metrics = [
    { label: 'Lớp đang tham gia', value: ongoingClasses && confirmed ? new Set(confirmed.map(item => referenceId(item.classId)).filter(id => ongoingClasses.has(id))).size : undefined, icon: 'layers', href: { pathname: '/workspace/[resource]', params: { resource: 'class-registrations' } }, color: '#6D28D9', fill: '#F2EAFF' },
    { label: 'Buổi tập sắp tới', value: data?.schedules ? upcoming.length : undefined, icon: 'calendar', href: scheduleLink, color: '#1D4ED8', fill: '#EAF1FF' },
    { label: 'Buổi đã hoàn thành', value: data?.schedules?.filter(item => item.status === 'COMPLETED').length, icon: 'check', href: scheduleLink, color: tone.green, fill: '#EAF8EE' },
    { label: 'Khoản phí chờ', value: pending, icon: 'wallet', href: '/payments', color: '#A3430C', fill: '#FFF0E4' },
  ] satisfies { label: string; value: number | undefined; icon: keyof typeof iconPaths; href: Href; color: string; fill: string }[];
  const classes = data?.classes ?? [];
  const courseFor = (item: Entity) => data?.courses.find(course => entityId(course) === referenceId(item.courseId)) ?? embedded(item.courseId);
  const publicUpcoming = upcomingMemberSessions(data?.catalogSchedules ?? []);
  const classCardWidth = Math.min(280, Math.max(170, width - 92));

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.page}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.brand}>
            <View style={styles.brandIcon}><Icon name="bolt" color={tone.white} /></View>
            <Text style={styles.brandText}>ActiveHub</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={data?.unread ? `Thông báo, ${data.unread} chưa đọc` : 'Thông báo'}
            onPress={() => router.push('/notifications')} style={styles.heroButton}>
            <Icon name="bell" color={tone.white} />
            {!!data?.unread && <View style={styles.dot} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Tài khoản" onPress={() => router.push('/account')} style={styles.heroButton}>
            {name ? <Text style={styles.avatar}>{name.trim().slice(0, 1).toLocaleUpperCase('vi-VN')}</Text> : <Icon name="user" color={tone.white} />}
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={styles.welcome}>{name ? `Xin chào, ${name}` : 'Xin chào'}</Text>
        <Text style={styles.subtitle}>Sẵn sàng bứt phá giới hạn hôm nay?</Text>
      </View>

      <View style={styles.section}>
        <Action primary label="Check-in bằng mã QR" icon="qr" href="/checkin" />
        <Action label="Tìm kiếm lớp học" icon="search" href="/explore" />
      </View>

      {!data && <QueryStatus loading={query.loading} error={query.error} retry={reload} />}
      {!!data?.errors.length && <Pressable accessibilityRole="button" onPress={reload} style={styles.card}>
        <Text style={styles.error}>Một phần dữ liệu chưa tải được. Bấm để thử lại.</Text>
      </Pressable>}

      {data && <View style={styles.section}>
        <SectionTitle title="Tổng quan hoạt động" />
        <View style={styles.metricGrid}>
          {metrics.map(item => <Pressable key={item.label} accessibilityRole="button"
            accessibilityLabel={`${item.label}, ${item.value ?? 'chưa có dữ liệu'}`}
            onPress={() => router.push(item.href)}
            style={({ pressed }) => [styles.card, styles.metric, { flexBasis: width < 340 || fontScale >= 1.6 ? '100%' : '47%' }, pressed && styles.pressed]}>
            <View style={[styles.metricIcon, { backgroundColor: item.fill }]}><Icon name={item.icon} color={item.color} /></View>
            <Text style={styles.value}>{item.value ?? '—'}</Text>
            <Text style={styles.muted}>{item.label}</Text>
          </Pressable>)}
        </View>
      </View>}

      {data && <View style={styles.section}>
        <SectionTitle title="Lịch tập sắp tới" link={scheduleLink} />
        {!upcoming.length && <Text style={[styles.card, styles.muted]}>
          {data.schedules || data.profileMissing ? 'Bạn chưa có buổi tập sắp tới.' : 'Chưa tải được lịch tập.'}
        </Text>}
        {upcoming.slice(0, 3).map(item => {
          const classId = referenceId(item.classId);
          const entry = classes.find(value => entityId(value) === classId) ?? embedded(item.classId);
          const registration = confirmed?.find(value => referenceId(value.classId) === classId);
          const coach = embedded(entry?.coachId);
          return <View key={entityId(item)} style={styles.card}>
            {entry && <ClassCover imageUrl={courseFor(entry)?.imageUrl} subject={referenceLabel(entry.subjectId)} style={styles.sessionCover} />}
            <Text style={styles.strong}>{entry ? referenceLabel(entry) : 'Buổi tập'}</Text>
            <Text style={styles.muted}>{dateAndTime(item)}</Text>
            {coach && <Text style={styles.muted}>HLV {referenceLabel(coach)}</Text>}
            {item.roomId != null && <Text style={styles.muted}>{referenceLabel(item.roomId)}</Text>}
            {registration && <Text style={styles.success}>Đã xác nhận đăng ký</Text>}
            <Action label="Xem chi tiết" href={{ pathname: '/session', params: { id: entityId(item) } }} />
          </View>;
        })}
      </View>}

      {data && <View style={styles.section}>
        <SectionTitle title="Khám phá bộ môn" link="/explore" />
        {classes.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {classes.slice(0, 4).map(item => {
            const next = publicUpcoming.find(session => referenceId(session.classId) === entityId(item));
            const coach = embedded(item.coachId);
            const spots = typeof item.remainingSlots === 'number' ? item.remainingSlots : undefined;
            return <View key={entityId(item)} style={[styles.card, { width: classCardWidth }]}>
              <ClassCover imageUrl={courseFor(item)?.imageUrl} subject={referenceLabel(item.subjectId)} style={styles.classCover} />
              <Text style={styles.strong}>{referenceLabel(item)}</Text>
              {coach && <Text style={styles.muted}>HLV {referenceLabel(coach)}</Text>}
              {next && <Text style={styles.muted}>{dateAndTime(next)}</Text>}
              {spots !== undefined && <Text style={styles.muted}>Còn {spots} chỗ</Text>}
              <Action label="Xem lớp" href={{ pathname: '/class-detail', params: { id: entityId(item) } }} />
            </View>;
          })}
        </ScrollView> : <Text style={[styles.card, styles.muted]}>{data.classes ? 'Chưa có lớp để khám phá.' : 'Chưa tải được danh sách lớp.'}</Text>}
      </View>}

      {data && <View style={styles.section}>
        <SectionTitle title="Thông báo quan trọng" link="/notifications" />
        {data.profileMissing && <Action alert="warning" label="Hoàn thiện hồ sơ hội viên" icon="user" href="/profile" />}
        {!!pending && <Action alert="urgent" label={`${pending} khoản phí cần thanh toán`} icon="wallet" href="/payments" />}
        {!!data.unread && <Action label={`${data.unread} thông báo chưa đọc`} icon="bell" href="/notifications" />}
        {!!upcoming[0] && <Action label={`Buổi tiếp theo · ${dateAndTime(upcoming[0])}`} icon="calendar"
          href={{ pathname: '/session', params: { id: entityId(upcoming[0]) } }} />}
        {!data.profileMissing && !pending && !data.unread && !upcoming.length && <Text style={styles.muted}>Không có mục cần chú ý lúc này.</Text>}
      </View>}

      {data && <View style={styles.section}>
        <SectionTitle title="Kế hoạch tập luyện" />
        <Action label="Xem kế hoạch" href={{ pathname: '/workspace/[resource]', params: { resource: 'workout-plans' } }} />
        <Action label="Bài tập về nhà" href="/homeworks" />
      </View>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tone.bg },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16, paddingBottom: 24, gap: 22 },
  section: { gap: 10 },
  hero: { gap: 8, borderRadius: 18, padding: 17, backgroundColor: tone.dark },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: tone.orange, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: tone.white, fontSize: 17, fontWeight: '800' },
  heroButton: { height: 44, width: 44, borderRadius: 22, backgroundColor: '#363B47', alignItems: 'center', justifyContent: 'center' },
  avatar: { color: tone.white, fontSize: 17, fontWeight: '800' },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, top: 9, right: 9, backgroundColor: tone.orange },
  welcome: { color: tone.white, fontSize: 27, fontWeight: '800' },
  subtitle: { color: '#D4DAE4', fontSize: 14, lineHeight: 20 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12, minHeight: 48, backgroundColor: tone.white, borderWidth: 1, borderColor: '#E2E8F0' },
  primary: { backgroundColor: '#BB3A11', borderColor: tone.orange, minHeight: 58 },
  warning: { backgroundColor: '#FFFAEB', borderColor: tone.warning },
  urgent: { backgroundColor: '#FFF1F2', borderColor: '#FCA5A5' },
  pressed: { opacity: 0.75 },
  white: { color: tone.white },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heading: { color: tone.dark, fontSize: 20, fontWeight: '800', flexShrink: 1 },
  link: { color: '#A73612', fontSize: 13, fontWeight: '700' },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
  card: { gap: 8, padding: 14, borderRadius: 16, backgroundColor: tone.white, borderWidth: 1, borderColor: '#E2E8F0' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexGrow: 1 },
  metricIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  value: { color: tone.dark, fontSize: 27, fontWeight: '800' },
  strong: { color: tone.dark, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  muted: { color: tone.muted, fontSize: 13, lineHeight: 19 },
  error: { color: tone.red, fontSize: 13, fontWeight: '700' },
  success: { color: '#16733A', fontSize: 13, fontWeight: '700' },
  sessionCover: { height: 85, borderRadius: 12 },
  classCover: { height: 116, borderRadius: 12 },
  carousel: { gap: 10 },
});
