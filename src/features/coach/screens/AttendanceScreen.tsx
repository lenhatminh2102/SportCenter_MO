import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { attendancesApi, entityId, referenceId, referenceLabel, type Entity } from '@/services/operations';
import { loadCoachAttendanceContext } from '@/services/coach-teaching';
import { attendanceMembers, dayOf } from '@/utils/coach-teaching';
import { bangkokToday, EDITABLE_DAYS, sessionProgress, sessionWindow, weekStart } from '@/utils/attendance-day';
import { addDays, dayMonth, formatDateLabel, shortWeekday } from '@/utils/schedule-time';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';

const openSession = (session: Entity) => router.push({ pathname: '/attendance/session', params: { scheduleId: entityId(session) } });
const DAY_COLORS = { done: '#16a34a', partial: '#d97706', todo: '#cbb8a6', none: 'transparent' } as const;

/** Coach "Điểm danh": the chosen day's sessions first, then the one to mark. */
export default function AttendanceDay() {
  const { user, token } = useAuth();
  const params = useLocalSearchParams<{ date?: string }>();
  const today = bangkokToday();
  const [day, setDay] = useState(/^\d{4}-\d{2}-\d{2}$/.test(params.date || '') ? params.date! : today);
  const [now, setNow] = useState(() => Date.now());
  const load = useCallback(async () => {
    const [context, attendances] = await Promise.all([loadCoachAttendanceContext(token!), attendancesApi.list(token!)]);
    return { ...context, attendances: Array.isArray(attendances) ? attendances : [] };
  }, [token]);
  const query = useApiQuery(load, !!token && user?.role === 'COACH');
  // Coming back from a roll call: refresh counts and the clock.
  useFocusEffect(useCallback(() => { setNow(Date.now()); query.reload(); }, [query.reload])); // eslint-disable-line react-hooks/exhaustive-deps
  const data = query.data;

  const view = useMemo(() => {
    if (!data) return null;
    const studentIds = (classId: string) => attendanceMembers(data.students, classId).map(entityId);
    const sessions = data.schedules
      .filter(item => item.status !== 'CANCELLED')
      .map(session => ({ session, slot: sessionWindow(session, now), progress: sessionProgress(session, data.attendances, studentIds(referenceId(session.classId))) }))
      .sort((a, b) => `${dayOf(a.session.date)} ${a.session.startTime}`.localeCompare(`${dayOf(b.session.date)} ${b.session.startTime}`));
    const overdue = sessions.filter(item => item.slot.phase === 'ended' && item.progress.total > 0 && !item.progress.complete);
    const monday = weekStart(day);
    const week = Array.from({ length: 7 }, (_, index) => {
      const value = addDays(monday, index);
      const ofDay = sessions.filter(item => dayOf(item.session.date) === value);
      const due = ofDay.filter(item => ['live', 'ended', 'expired'].includes(item.slot.phase) && item.progress.total > 0);
      const done = due.filter(item => item.progress.complete).length;
      const state: keyof typeof DAY_COLORS = !ofDay.length ? 'none' : !due.length ? 'todo' : done === due.length ? 'done' : 'partial';
      return { value, state };
    });
    return { day: sessions.filter(item => dayOf(item.session.date) === day), overdue, week };
  }, [data, day, now]);

  if (!user || !token) return <AccessScreen />;
  if (user.role !== 'COACH') return <AccessScreen denied />;
  const featured = view?.day.find(item => item.slot.phase === 'live') || view?.day.find(item => item.slot.phase === 'upcoming');
  const others = view?.day.filter(item => item !== featured) || [];

  return <Screen>
    <View style={{ gap: 4 }}>
      <Text style={ui.eyebrow}>ĐIỂM DANH</Text>
      <Text style={ui.title}>{day === today ? 'Điểm danh hôm nay' : `Điểm danh ${shortWeekday(day)} ${dayMonth(day)}`}</Text>
      <Text style={ui.body}>{formatDateLabel(day)}{view ? ` · ${view.day.length ? `${view.day.length} buổi dạy` : 'không có buổi dạy'}` : ''}</Text>
    </View>
    <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />

    {view && <>
      <View style={[ui.card, { paddingVertical: 10, gap: 8 }]}>
        <View style={ui.between}>
          <Pressable accessibilityRole="button" accessibilityLabel="Tuần trước" onPress={() => setDay(addDays(weekStart(day), -7))} style={{ padding: 6 }}><Text style={ui.link}>‹ Tuần trước</Text></Pressable>
          {day !== today && <Pressable accessibilityRole="button" onPress={() => setDay(today)} style={{ padding: 6 }}><Text style={ui.link}>Hôm nay</Text></Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel="Tuần sau" onPress={() => setDay(addDays(weekStart(day), 7))} style={{ padding: 6 }}><Text style={ui.link}>Tuần sau ›</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {view.week.map(item => {
            const active = item.value === day;
            return <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={formatDateLabel(item.value)} onPress={() => setDay(item.value)}
              style={{ alignItems: 'center', gap: 4, paddingVertical: 6, width: 42, borderRadius: 12, backgroundColor: active ? colors.pale : 'transparent' }}>
              <Text style={{ fontSize: 11, color: active ? colors.primary : colors.muted }}>{shortWeekday(item.value)}</Text>
              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: DAY_COLORS[item.state], borderStyle: item.state === 'todo' ? 'dashed' : 'solid' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: active ? colors.primary : colors.ink }}>{item.value.slice(8, 10)}</Text>
              </View>
            </Pressable>;
          })}
        </View>
      </View>

      {featured ? <View style={{ backgroundColor: '#fff0e1', borderColor: '#f7dcc3', borderWidth: 1, borderRadius: 18, padding: 18, gap: 8 }}>
        <View style={ui.between}>
          <Text style={{ backgroundColor: '#fbd9bf', color: '#7a3d1c', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: '700', overflow: 'hidden' }}>● {featured.slot.label}</Text>
          <Text style={{ color: '#9a5a33', fontSize: 13 }}>{String(featured.session.startTime)} – {String(featured.session.endTime)}</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#4a2410' }}>{referenceLabel(featured.session.classId)}</Text>
        <Text style={{ color: '#9a5a33', fontSize: 13 }}>{referenceLabel(featured.session.lessonId)} · {referenceLabel(featured.session.roomId)}</Text>
        {featured.slot.phase === 'live' && <View style={{ height: 6, borderRadius: 999, backgroundColor: '#fbd9bf', overflow: 'hidden' }}><View style={{ height: '100%', width: `${Math.round((featured.slot.progress || 0) * 100)}%`, backgroundColor: colors.primary }} /></View>}
        <Text style={{ color: '#9a5a33', fontSize: 13 }}>{featured.progress.total} học viên{featured.progress.marked ? ` · đã điểm danh ${featured.progress.marked}` : ''}</Text>
        <Button secondary={!featured.slot.editable} title={featured.slot.editable ? featured.progress.marked ? 'Tiếp tục điểm danh' : 'Điểm danh ngay' : 'Xem trước danh sách'} onPress={() => openSession(featured.session)} />
      </View> : !view.day.length && <View style={[ui.card, { alignItems: 'center' }]}>
        <Text style={ui.heading}>{day === today ? 'Hôm nay bạn không có buổi dạy' : 'Ngày này không có buổi dạy'}</Text>
        <Text style={[ui.body, { textAlign: 'center' }]}>Chọn ngày khác trên thanh tuần, hoặc xem toàn bộ lịch dạy.</Text>
        <Button secondary title="Xem lịch dạy" onPress={() => router.push({ pathname: '/workspace/[resource]', params: { resource: 'schedules' } })} />
      </View>}

      {others.length > 0 && <View style={ui.card}>
        <Text style={ui.heading}>{featured ? 'Các buổi khác trong ngày' : 'Buổi dạy trong ngày'}</Text>
        {others.map(({ session, slot, progress }) => <Pressable key={entityId(session)} accessibilityRole="button" onPress={() => openSession(session)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ width: 52 }}><Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>{String(session.startTime)}</Text><Text style={{ fontSize: 11, color: colors.muted }}>{String(session.endTime)}</Text></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{referenceLabel(session.classId)}</Text><Text style={{ fontSize: 12, color: colors.muted }}>{referenceLabel(session.lessonId)}</Text></View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: progress.complete ? colors.green : slot.phase === 'upcoming' || slot.phase === 'expired' ? colors.muted : '#b45309' }}>
            {progress.complete ? `✓ ${progress.present}/${progress.total}` : slot.phase === 'upcoming' ? `Mở ${slot.opensAt}` : slot.phase === 'expired' ? 'Quá hạn' : progress.marked ? `Còn ${progress.total - progress.marked}` : 'Chưa điểm danh'}
          </Text>
        </Pressable>)}
      </View>}

      <View style={[ui.card, view.overdue.length ? { backgroundColor: '#fff8eb', borderColor: '#f5dfb4' } : null]}>
        <Text style={[ui.heading, { fontSize: 16, color: view.overdue.length ? '#9a6510' : colors.green }]}>{view.overdue.length ? `⚠ ${view.overdue.length} buổi chưa điểm danh xong` : '✓ Không có buổi bị sót'}</Text>
        {view.overdue.slice(0, 4).map(({ session, progress }) => <Pressable key={entityId(session)} accessibilityRole="button" onPress={() => openSession(session)} style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#f0dcb6', backgroundColor: '#fff' }}>
          <Text style={{ color: '#7a5310', fontSize: 13 }}>{shortWeekday(dayOf(session.date))} {dayMonth(dayOf(session.date))} · {String(session.startTime)} · {progress.marked}/{progress.total} học viên</Text>
        </Pressable>)}
        <Text style={[ui.body, { fontSize: 12 }]}>Điểm danh mở trước giờ học 15 phút và sửa được trong {EDITABLE_DAYS} ngày.</Text>
      </View>
    </>}
  </Screen>;
}
