import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { requestEnvelope } from '@/services/api';
import { membersApi } from '@/services/members';
import { paymentsApi } from '@/services/payments';
import { bangkokDate } from '@/services/dashboard';
import { classRegistrationsApi, classesApi, coachesApi, coursesApi, learningPathsApi, lessonsApi, resourceApis, schedulesApi, subjectsApi, type Entity } from '@/services/operations';
import { ACTIVITY_GROUPS, buildTargetIndex, dayHeading, matchesActivity, toActivityRows, type ActivityGroup, type ActivityRow } from '@/utils/activity-log';
import { addDays } from '@/utils/schedule-time';
import { QueryStatus } from './access';
import { Button, Field, Screen } from './ui';
import { ui } from './styles';
import { colors } from '@/data/sport';

const PAGE_SIZE = 200;
const RANGES = [['today', 'Hôm nay'], ['7', '7 ngày'], ['30', '30 ngày'], ['all', 'Tất cả']] as const;
type Range = typeof RANGES[number][0];
const settle = (promise: Promise<unknown>) => promise.then(items => (Array.isArray(items) ? items as Entity[] : [])).catch(() => [] as Entity[]);

/** Start of the chosen range as an instant in UTC+7 ('' = no lower bound). */
function rangeStart(range: Range, today: string) {
  if (range === 'all') return '';
  const day = range === 'today' ? today : addDays(today, -(Number(range) - 1));
  return `${day}T00:00:00+07:00`;
}

/** Pages 1..pages of the log, newest first; works with or without server pagination. */
async function loadLogs(token: string, from: string, pages: number) {
  const query = (page: number) => `/api/activity-logs?page=${page}&limit=${PAGE_SIZE}${from ? `&from=${encodeURIComponent(from)}` : ''}`;
  const first = await requestEnvelope<Entity[]>(query(1), { token }) as { data?: Entity[]; pagination?: { total?: number } };
  const total = first.pagination?.total ?? (first.data || []).length;
  const more = await Promise.all(Array.from({ length: Math.max(0, Math.min(pages, Math.ceil(total / PAGE_SIZE)) - 1) }, (_, index) => requestEnvelope<Entity[]>(query(index + 2), { token })));
  return { logs: [first, ...more].flatMap(result => result.data || []), total };
}

/** Lists that turn record ids into names; each may fail on its own. */
async function loadIndex(token: string) {
  const [courses, classes, subjects, rooms, lessons, paths, members, coaches, schedules, registrations, payments] = await Promise.all([
    settle(coursesApi.list(token)), settle(classesApi.list(token)), settle(subjectsApi.list(token)), settle(resourceApis.rooms.list(token)),
    settle(lessonsApi.list(token)), settle(learningPathsApi.list(token)), settle(membersApi.list(token)), settle(coachesApi.list(token)),
    settle(schedulesApi.list(token)), settle(classRegistrationsApi.list(token)), settle(paymentsApi.list(token)),
  ]);
  return buildTargetIndex({ courses, classes, subjects, rooms, lessons, paths, members, coaches, schedules, registrations, payments });
}

const timeOf = (value: string) => new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const fullTime = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });
const toneColor = { danger: '#b91c1c', success: colors.green, accent: '#1d4ed8', neutral: colors.muted } as const;

/** Manager's activity history (web ActivityHistory): who did what to which record, by day, with filters. Read-only. */
export function ActivityHistory({ token }: { token: string }) {
  const { user } = useAuth();
  const [today] = useState(() => bangkokDate(new Date()));
  const [range, setRange] = useState<Range>('7');
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [actor, setActor] = useState('');
  const [group, setGroup] = useState<ActivityGroup | ''>('');
  const [sensitiveOnly, setSensitiveOnly] = useState(false);
  const [open, setOpen] = useState('');

  const from = rangeStart(range, today);
  const logsLoader = useCallback(() => loadLogs(token, from, pages), [token, from, pages]);
  const logs = useApiQuery(logsLoader);
  const indexLoader = useCallback(() => loadIndex(token), [token]);
  const index = useApiQuery(indexLoader).data;

  const rows = toActivityRows(logs.data?.logs || [], index || {});
  const actors = [...new Map(rows.map(row => [row.actor.id, row.actor])).values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const shown = rows.filter(row => (!actor || row.actor.id === actor) && (!group || row.group === group) && (!sensitiveOnly || row.sensitive) && matchesActivity(row, search));
  const days: { day: string; rows: ActivityRow[] }[] = [];
  for (const row of shown) {
    if (days[days.length - 1]?.day !== row.day) days.push({ day: row.day, rows: [] });
    days[days.length - 1].rows.push(row);
  }
  const sensitiveCount = rows.filter(row => row.sensitive).length;
  const loaded = logs.data?.logs.length || 0;
  const chip = (key: string, label: string, active: boolean, onPress: () => void) => <Button key={key} secondary={!active} title={label} onPress={onPress} />;

  return <Screen>
    <Link href={user?.role === 'CENTER_MANAGER' ? '/manager' : '/account'} style={ui.link}>← Tổng quan</Link>
    <Text style={ui.title}>Lịch sử thao tác</Text>
    <Text style={ui.body}>Ai đã làm gì trên hệ thống, với khóa học, lớp, hội viên hay giao dịch nào.</Text>
    <View style={ui.card}>
      <Field label="Tìm trong lịch sử" value={search} onChangeText={setSearch} placeholder="Tên khóa học, lớp, hội viên, người thực hiện" />
      <Text style={ui.heading}>Khoảng thời gian</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {RANGES.map(([value, label]) => chip(value, label, range === value, () => { setRange(value); setPages(1); setOpen(''); }))}
      </View>
      <Text style={ui.heading}>Nhóm chức năng</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chip('all', 'Mọi chức năng', !group, () => setGroup(''))}
        {(Object.keys(ACTIVITY_GROUPS) as ActivityGroup[]).map(key => chip(key, ACTIVITY_GROUPS[key].label, group === key, () => setGroup(key)))}
      </View>
      {actors.length > 1 && <>
        <Text style={ui.heading}>Người thực hiện</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {chip('all', 'Mọi người', !actor, () => setActor(''))}
          {actors.map(item => chip(item.id || item.name, `${item.name}${item.roleLabel ? ` · ${item.roleLabel}` : ''}`, actor === item.id, () => setActor(item.id)))}
        </View>
      </>}
      {chip('flag', `⚠ Cần chú ý${sensitiveCount ? ` (${sensitiveCount})` : ''}`, sensitiveOnly, () => setSensitiveOnly(value => !value))}
    </View>

    <QueryStatus loading={logs.loading} error={logs.error} retry={logs.reload} />
    {logs.data && <>
      {days.map(({ day, rows: dayRows }) => <View key={day || 'unknown'} style={{ gap: 8 }}>
        <Text style={ui.eyebrow}>{dayHeading(day, today).toUpperCase()}</Text>
        {dayRows.map(row => <Pressable key={row.id} accessibilityRole="button" accessibilityState={{ expanded: open === row.id }}
          onPress={() => setOpen(current => (current === row.id ? '' : row.id))}
          style={[ui.card, { padding: 14, gap: 4, borderLeftWidth: 4, borderLeftColor: toneColor[row.tone] }]}>
          <View style={ui.between}>
            <Text style={[ui.heading, { fontSize: 15, flex: 1 }]}>{row.sentence}{row.target ? ` · ${row.target}` : ''}{row.count > 1 ? ` (${row.count} lần)` : ''}</Text>
            <Text style={[ui.body, { fontSize: 12 }]}>{row.at ? timeOf(row.at) : ''}</Text>
          </View>
          <Text style={[ui.body, { fontSize: 13 }]}>{row.actor.name}{row.actor.roleLabel ? ` · ${row.actor.roleLabel}` : ''}{row.sensitive ? ' · Cần chú ý' : ''}</Text>
          {open === row.id && row.technical && <View style={{ gap: 2, paddingTop: 4 }}>
            <Text selectable style={[ui.body, { fontSize: 12 }]}>Thời điểm: {fullTime(row.at)}{row.count > 1 ? ` (lần đầu ${timeOf(row.oldestAt)})` : ''}</Text>
            {!!row.actor.email && <Text selectable style={[ui.body, { fontSize: 12 }]}>Tài khoản: {row.actor.email}</Text>}
            <Text selectable style={[ui.body, { fontSize: 12 }]}>Chi tiết kỹ thuật: {row.technical.method} {row.technical.path}{row.technical.statusCode ? ` · HTTP ${row.technical.statusCode}` : ''}{row.technical.ip ? ` · IP ${row.technical.ip}` : ''}</Text>
          </View>}
        </Pressable>)}
      </View>)}
      {!shown.length && <View style={ui.card}>
        <Text style={ui.heading}>{rows.length ? 'Không có thao tác phù hợp' : 'Chưa có thao tác nào trong khoảng này'}</Text>
        <Text style={ui.body}>{rows.length ? 'Thử bỏ bớt bộ lọc hoặc đổi từ khóa.' : 'Chọn khoảng thời gian dài hơn để xem thêm.'}</Text>
      </View>}
      <Text style={ui.body}>Đang hiện {loaded} / {logs.data.total} thao tác</Text>
      {loaded < logs.data.total && <Button secondary title="Xem thêm" onPress={() => setPages(value => value + 1)} />}
    </>}
  </Screen>;
}
