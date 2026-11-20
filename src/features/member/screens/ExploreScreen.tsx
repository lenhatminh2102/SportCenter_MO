import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useActorProfile } from '@/hooks/use-actor-profile';
import { useApiQuery } from '@/hooks/use-api-query';
import { entityId } from '@/services/operations';
import { currency } from '@/services/payments';
import { buildCatalog, DAYPARTS, featuredClass, loadCatalog, matches, sortCatalog, SORTS, timelineLabel, type CatalogEntry } from '@/utils/class-catalog';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { ClassCover } from '@/components/sport/class-cover';
import { VideoEmbed } from '@/components/sport/video-embed';
import { Button, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress}
    style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : '#fff' }}>
    <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : colors.muted }}>{label}</Text>
  </Pressable>;
}

function Tag({ text, tone = 'light' }: { text: string; tone?: 'light' | 'green' | 'amber' | 'dark' }) {
  const palette = { light: ['#ffffffe6', colors.muted], green: ['#e2f4e8', '#2c7a4f'], amber: ['#fff1d6', '#9a6510'], dark: ['#2b211acc', '#fff'] }[tone];
  return <Text style={{ backgroundColor: palette[0], color: palette[1], fontSize: 11, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' }}>{text}</Text>;
}

/** Primary action of a card, from the member's own registration. */
function cardAction(entry: CatalogEntry) {
  if (entry.enrolled) return { label: 'Xem lịch học', secondary: true, go: () => router.push({ pathname: '/registration-detail', params: { id: entityId(entry.registration!) } }) };
  if (entry.pending) return { label: 'Thanh toán', secondary: false, go: () => router.push({ pathname: '/payment-edit', params: { registrationId: entityId(entry.registration!) } }) };
  return { label: 'Đăng ký', secondary: false, go: () => router.push({ pathname: '/enroll', params: { classId: entry.id } }) };
}

function ClassCard({ entry }: { entry: CatalogEntry }) {
  const action = cardAction(entry);
  const open = () => router.push({ pathname: '/class-detail', params: { id: entry.id } });
  return <View style={{ backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Xem lớp ${entry.name}`} onPress={open}>
      <ClassCover imageUrl={entry.imageUrl} subject={entry.subjectName} style={{ height: 140 }} />
      <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
        {entry.previewLesson ? <Tag text="▶ Có video" tone="dark" /> : <View />}
        {entry.enrolled ? <Tag text="✓ Đã đăng ký" tone="green" /> : entry.pending ? <Tag text="Chờ thanh toán" tone="amber" /> : <Tag text={timelineLabel(entry)} />}
      </View>
      <View style={{ position: 'absolute', left: 10, bottom: 10 }}><Tag text={entry.subjectName} /></View>
    </Pressable>
    <View style={{ padding: 14, gap: 6 }}>
      <Pressable onPress={open}><Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>{entry.name}</Text></Pressable>
      <Text style={{ fontSize: 13, color: colors.muted }}>🗓 {entry.weekdayLabel ? `${entry.weekdayLabel}${entry.timeRange ? ` · ${entry.timeRange}` : ''}` : 'Đang cập nhật lịch'}</Text>
      <Text style={{ fontSize: 13, color: colors.muted }}>{entry.sessions.length ? `${entry.sessions.length} buổi` : 'Chưa xếp buổi'}{entry.lessons.length ? ` · ${entry.lessons.length} bài học` : ''} · {entry.coachLabel}</Text>
      <View style={[ui.between, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 4 }]}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>{typeof entry.price === 'number' ? currency(entry.price) : 'Liên hệ'}</Text>
          {!!entry.perSession && <Text style={{ fontSize: 12, color: colors.muted }}>≈ {currency(entry.perSession)}/buổi</Text>}
        </View>
        <Pressable accessibilityRole="button" onPress={action.go} style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.primary, backgroundColor: action.secondary ? '#fff' : colors.primary }}>
          <Text style={{ fontWeight: '800', color: action.secondary ? colors.primary : '#fff' }}>{action.label}</Text>
        </Pressable>
      </View>
    </View>
  </View>;
}

/** Member "Khám phá lớp học": a storefront for classes instead of a plain list. */
export default function Explore() {
  const { user, token } = useAuth();
  const params = useLocalSearchParams<{ q?: string }>();
  const actor = useActorProfile(user?.role === 'MEMBER');
  const memberId = actor.data ? entityId(actor.data) : '';
  const load = useCallback(() => loadCatalog(token!), [token]);
  const query = useApiQuery(load, !!token);
  useFocusEffect(useCallback(() => { query.reload(); }, [query.reload])); // eslint-disable-line react-hooks/exhaustive-deps
  const [now] = useState(() => Date.now());
  const [search, setSearch] = useState(params.q || '');
  const [sport, setSport] = useState('');
  const [daypart, setDaypart] = useState('');
  const [sort, setSort] = useState('soon');
  const [preview, setPreview] = useState(false);

  const catalog = useMemo(() => (query.data ? buildCatalog(query.data, { memberId, now }) : []), [query.data, memberId, now]);
  const sports = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>();
    for (const entry of catalog) {
      const item = counts.get(entry.subjectId) || { id: entry.subjectId, name: entry.subjectId ? entry.subjectName : 'Khác', count: 0 };
      item.count += 1; counts.set(entry.subjectId, item);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));
  }, [catalog]);
  if (!user || !token) return <AccessScreen />;

  const visible = sortCatalog(catalog.filter(entry => (!sport || (entry.subjectId || '-') === sport)
    && (!daypart || (daypart === 'weekend' ? entry.weekend : entry.dayparts.has(daypart as never)))
    && matches(search, entry.name, entry.subjectName, entry.coachName, entry.courseName, entry.description)), sort);
  const featured = !search && !sport && !daypart ? featuredClass(catalog) : null;

  return <Screen>
    <View style={{ backgroundColor: '#fff6ee', borderColor: '#f7e5d3', borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 }}>
      <Text style={ui.eyebrow}>KHÁM PHÁ LỚP HỌC</Text>
      <Text style={[ui.title, { fontSize: 28 }]}>Tìm lớp hợp với bạn</Text>
      <Text style={ui.body}>{query.data ? `${catalog.length} lớp · ${sports.filter(item => item.id).length} môn · khai giảng liên tục` : 'Lớp học, lịch tập và huấn luyện viên của trung tâm.'}</Text>
      <TextInput value={search} onChangeText={setSearch} placeholder="Yoga buổi tối, boxing cho người mới…" placeholderTextColor="#b49a82" accessibilityLabel="Tìm lớp học"
        style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#ecdccc', backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 15, color: colors.ink }} />
      {sports.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={`Tất cả ${catalog.length}`} active={!sport} onPress={() => setSport('')} />
        {sports.map(item => <Chip key={item.id || '-'} label={`${item.name} ${item.count}`} active={sport === (item.id || '-')} onPress={() => setSport(sport === (item.id || '-') ? '' : item.id || '-')} />)}
      </ScrollView>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {DAYPARTS.map(part => <Chip key={part.id} label={part.label} active={daypart === part.id} onPress={() => setDaypart(daypart === part.id ? '' : part.id)} />)}
        <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />
        {SORTS.map(item => <Chip key={item.value} label={item.label} active={sort === item.value} onPress={() => setSort(item.value)} />)}
      </ScrollView>
    </View>

    <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />

    {featured && <View style={{ backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      {preview && featured.previewLesson
        ? <View style={{ padding: 12 }}><VideoEmbed url={featured.previewLesson.videoUrl} /></View>
        : <View>
          <ClassCover imageUrl={featured.imageUrl} subject={featured.subjectName} style={{ height: 180 }} />
          <View style={{ position: 'absolute', top: 12, left: 12 }}><Tag text={timelineLabel(featured)} /></View>
          {featured.previewLesson && <Pressable accessibilityRole="button" onPress={() => setPreview(true)} style={{ position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#ffffffe6', borderRadius: 10, padding: 10 }}>
            <Text style={{ textAlign: 'center', fontWeight: '700', color: colors.ink }}>▶ Xem bài mẫu: {String(featured.previewLesson.title || '')}</Text>
          </Pressable>}
        </View>}
      <View style={{ padding: 16, gap: 8 }}>
        <Text style={ui.eyebrow}>{featured.startsOn ? 'SẮP KHAI GIẢNG' : 'LỚP NỔI BẬT'}</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>{featured.name}</Text>
        <Text style={ui.body} numberOfLines={3}>{featured.description || `Khóa ${featured.courseName} cùng ${featured.coachLabel}.`}</Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>{[featured.timeRange, featured.weekdayLabel, `${featured.sessions.length} buổi`, featured.coachLabel].filter(Boolean).join(' · ')}</Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>{typeof featured.price === 'number' ? currency(featured.price) : 'Liên hệ'}<Text style={{ fontSize: 12, fontWeight: '400', color: colors.muted }}> / khóa{featured.perSession ? ` · ≈ ${currency(featured.perSession)}/buổi` : ''}</Text></Text>
        <View style={ui.row}>
          <View style={{ flex: 1 }}><Button secondary title="Xem chi tiết" onPress={() => router.push({ pathname: '/class-detail', params: { id: featured.id } })} /></View>
          <View style={{ flex: 1 }}><Button title="Đăng ký ngay" onPress={() => router.push({ pathname: '/enroll', params: { classId: featured.id } })} /></View>
        </View>
      </View>
    </View>}

    {query.data && <>
      <Text style={{ color: colors.muted, fontSize: 13 }}>{visible.length} lớp phù hợp</Text>
      {visible.map(entry => <ClassCard key={entry.id} entry={entry} />)}
      {!visible.length && <View style={[ui.card, { alignItems: 'center' }]}>
        <Text style={ui.heading}>Chưa thấy lớp phù hợp</Text>
        <Text style={[ui.body, { textAlign: 'center' }]}>Thử bỏ bớt bộ lọc, hoặc nhờ trung tâm tư vấn lớp cho bạn.</Text>
        <Button secondary title="Nhờ trung tâm tư vấn" onPress={() => router.push({ pathname: '/support', params: { topic: 'tư vấn chọn lớp' } })} />
      </View>}
    </>}
  </Screen>;
}
