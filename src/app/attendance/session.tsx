import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { useScheduleAttendances } from '@/hooks/use-schedule-attendances';
import { attendancesApi, entityId, referenceId, referenceLabel, type Entity } from '@/services/operations';
import { coachAttendanceApi, loadCoachAttendanceContext } from '@/services/coach-teaching';
import { attendanceMembers, dayOf } from '@/utils/coach-teaching';
import { currentStatus, rollCallChanges, rollCallCounts, savedAttendance, type AttendanceStatus } from '@/utils/roll-call';
import { EDITABLE_DAYS, historyNote, memberHistory, sessionWindow, type MemberHistory } from '@/utils/attendance-day';
import { formatDateLabel } from '@/utils/schedule-time';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';

const NOTE_COLORS: Record<string, string> = { blue: '#2f66a8', red: '#c4574a', green: '#2c7a4f', muted: colors.muted };
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(part => part[0] || '').join('').toUpperCase() || '?';
const FILTERS: [string, string][] = [['ALL', 'Tất cả'], ['PRESENT', 'Có mặt'], ['ABSENT', 'Vắng'], ['UNMARKED', 'Chưa điểm danh']];

function StudentRow({ index, student, status, history, disabled, onMark }: {
  index: number; student: Entity; status: string; history: MemberHistory; disabled: boolean; onMark: (status: AttendanceStatus) => void;
}) {
  const name = String(student.fullName || 'Chưa có tên');
  const note = historyNote(history);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: status === 'ABSENT' ? '#fff6f5' : '#fff' }}>
    <Text style={{ width: 20, textAlign: 'center', color: colors.muted, fontSize: 12 }}>{index + 1}</Text>
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>{initials(name)}</Text></View>
    <View style={{ flex: 1, gap: 3 }}>
      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 3 }} accessibilityLabel="5 buổi gần nhất">
          {Array.from({ length: 5 }, (_, slot) => {
            const value = history.recent[history.recent.length - 5 + slot];
            return <View key={slot} style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: value === 'PRESENT' ? '#16a34a' : value === 'ABSENT' ? '#dc2626' : '#efe5da' }} />;
          })}
        </View>
        <Text numberOfLines={1} style={{ fontSize: 11, color: NOTE_COLORS[note.tone] }}>{note.text}</Text>
      </View>
    </View>
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' }}>
      {(['PRESENT', 'ABSENT'] as AttendanceStatus[]).map(value => {
        const on = status === value;
        return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: on, disabled }} accessibilityLabel={`${name}: ${value === 'PRESENT' ? 'có mặt' : 'vắng'}`} disabled={disabled} onPress={() => onMark(value)}
          style={{ paddingVertical: 8, paddingHorizontal: 10, backgroundColor: on ? (value === 'PRESENT' ? '#e2f4e8' : '#fdeceb') : '#fff', borderLeftWidth: value === 'ABSENT' ? 1 : 0, borderLeftColor: colors.border, opacity: disabled ? 0.6 : 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: on ? (value === 'PRESENT' ? '#2c7a4f' : '#c4574a') : colors.muted }}>{value === 'PRESENT' ? 'Có mặt' : 'Vắng'}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

/** Roll call for ONE session: a single compact list, everyone present by default for a new session. */
export default function RollCall() {
  const { scheduleId = '' } = useLocalSearchParams<{ scheduleId?: string }>();
  const { user, token } = useAuth();
  const [now] = useState(() => Date.now());
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ present: number; absent: number; unmarked: number; atRisk: Entity[] } | null>(null);
  const pending = useRef(false);

  const load = useCallback(async () => {
    const [context, attendances] = await Promise.all([loadCoachAttendanceContext(token!), attendancesApi.list(token!)]);
    return { ...context, attendances: Array.isArray(attendances) ? attendances : [] };
  }, [token]);
  const query = useApiQuery(load, !!token && user?.role === 'COACH');
  const data = query.data;
  const session = data?.schedules.find(item => entityId(item) === scheduleId) || null;
  const classId = session ? referenceId(session.classId) : '';
  const day = session ? dayOf(session.date) : '';
  const students = session && data ? attendanceMembers(data.students, classId) : [];
  const records = useScheduleAttendances(token || '', session ? scheduleId : '');
  const saved = savedAttendance(records.data || []);
  const slot = session ? sessionWindow(session, now) : null;
  // A session nobody has marked yet starts with the whole class present: the coach only picks who is absent.
  const startsPresent = !!slot?.editable && Array.isArray(records.data) && records.data.length === 0;
  const effective: Record<string, AttendanceStatus> = startsPresent ? { ...Object.fromEntries(students.map(student => [entityId(student), 'PRESENT' as AttendanceStatus])), ...marks } : marks;
  const changes = rollCallChanges(students, records.data || [], effective);
  const counts = rollCallCounts(students, records.data || [], effective);
  const editable = !!slot?.editable && !records.loading && !records.error;
  const lesson = session && session.lessonId && typeof session.lessonId === 'object' ? session.lessonId as Entity : null;

  if (!user || !token) return <AccessScreen />;
  if (user.role !== 'COACH') return <AccessScreen denied />;
  const back = () => router.replace({ pathname: '/attendance', params: day ? { date: day } : {} });

  async function save() {
    if (pending.current || !session || !data) return;
    setError('');
    if (!changes.length) { setError('Chưa có thay đổi để lưu.'); return; }
    pending.current = true; setBusy(true);
    try {
      // Fresh check before writing: the session is still scheduled and the students still confirmed.
      const fresh = await loadCoachAttendanceContext(token!);
      const current = fresh.schedules.find(item => entityId(item) === scheduleId && item.status !== 'CANCELLED');
      if (!current) throw new Error('Buổi học đã thay đổi hoặc bị hủy. Vui lòng tải lại.');
      const confirmed = new Set(attendanceMembers(fresh.students, classId).map(entityId));
      const failed: { memberId: string; message: string }[] = [];
      for (const change of changes) {
        try {
          if (!confirmed.has(change.memberId)) throw new Error('không còn trong danh sách đã xác nhận');
          if (change.recordId) await attendancesApi.update(token!, change.recordId, { memberId: change.memberId, classId, lessonId: referenceId(current.lessonId), date: dayOf(current.date), status: change.status });
          else await coachAttendanceApi.create(token!, change.memberId, entityId(current), change.status);
        } catch (e) { failed.push({ memberId: change.memberId, message: `${change.name || change.memberId}: ${(e as Error).message}` }); }
      }
      const failedIds = new Set(failed.map(item => item.memberId));
      const final = students.map(student => ({ student, status: failedIds.has(entityId(student)) ? saved[entityId(student)]?.status : currentStatus(entityId(student), saved, effective) }));
      records.reload(); query.reload();
      setMarks(currentMarks => Object.fromEntries(Object.entries(currentMarks).filter(([memberId]) => failedIds.has(memberId))) as Record<string, AttendanceStatus>);
      if (failed.length) setError(`Lưu được ${changes.length - failed.length}/${changes.length} học viên. Chưa lưu: ${failed.map(item => item.message).join('; ')}`);
      else setDone({
        present: final.filter(item => item.status === 'PRESENT').length,
        absent: final.filter(item => item.status === 'ABSENT').length,
        unmarked: final.filter(item => !item.status).length,
        // Absent again after missing the previous session: worth a call.
        atRisk: final.filter(item => item.status === 'ABSENT' && memberHistory(entityId(item.student), classId, data.attendances, day).absentStreak >= 1).map(item => item.student),
      });
    } catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }

  if (done) {
    const total = done.present + done.absent;
    return <Screen>
      <Pressable accessibilityRole="link" onPress={back}><Text style={ui.link}>← Điểm danh theo ngày</Text></Pressable>
      <View style={[ui.card, { alignItems: 'center', paddingVertical: 24 }]}>
        <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 9, borderColor: '#16a34a', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>{total ? `${Math.round((done.present / total) * 100)}%` : '—'}</Text></View>
        <Text style={ui.heading}>Đã lưu điểm danh</Text>
        <Text style={ui.body}>{done.present} có mặt · {done.absent} vắng{done.unmarked ? ` · ${done.unmarked} chưa điểm danh` : ''}</Text>
      </View>
      <Text style={ui.eyebrow}>VIỆC TIẾP THEO CỦA BUỔI</Text>
      <Button title={`Cập nhật tiến độ ${lesson ? `bài ${String(lesson.order)}` : 'bài học'}`} onPress={() => router.push({ pathname: '/workspace/[resource]', params: { resource: 'lesson-progress' } })} />
      <Button secondary title="Nhận xét buổi học" onPress={() => router.push('/feedbacks')} />
      {done.atRisk.map(student => <Pressable key={entityId(student)} accessibilityRole="button" onPress={() => router.push({ pathname: '/coach-students', params: { classId } })}
        style={[ui.card, { backgroundColor: '#fdeceb', borderColor: '#f6cbc6' }]}>
        <Text style={{ color: '#a2382d', fontWeight: '800' }}>⚠ Liên hệ {String(student.fullName || '')}</Text>
        <Text style={{ color: '#a2382d', fontSize: 13 }}>Vắng nhiều buổi liền{student.phone ? ` · ${String(student.phone)}` : ''}</Text>
      </Pressable>)}
      <Button secondary title="Về điểm danh theo ngày" onPress={back} />
      <Button secondary title="Sửa điểm danh" onPress={() => setDone(null)} />
    </Screen>;
  }

  const visible = students.filter(student => {
    const status = currentStatus(entityId(student), saved, effective);
    const text = `${String(student.fullName || '')} ${String(student.phone || '')}`.toLocaleLowerCase('vi');
    return (filter === 'ALL' || (filter === 'UNMARKED' ? !status : status === filter)) && text.includes(search.trim().toLocaleLowerCase('vi'));
  });

  return <Screen>
    <Pressable accessibilityRole="link" onPress={back}><Text style={ui.link}>← Điểm danh theo ngày</Text></Pressable>
    <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />
    {data && !session && <View style={ui.card}><Text style={ui.heading}>Không tìm thấy buổi học</Text><Text style={ui.body}>Buổi có thể đã bị hủy, hoặc không thuộc lớp bạn phụ trách.</Text><Button secondary title="Về điểm danh hôm nay" onPress={() => router.replace('/attendance')} /></View>}
    {session && slot && <>
      <View style={{ gap: 4 }}>
        <Text style={ui.eyebrow}>ĐIỂM DANH BUỔI HỌC</Text>
        <Text style={[ui.title, { fontSize: 26 }]}>{referenceLabel(session.classId)}</Text>
        <Text style={ui.body}>{formatDateLabel(day)} · {String(session.startTime)}–{String(session.endTime)}{lesson ? ` · Bài ${String(lesson.order)}: ${String(lesson.title || '')}` : ''}</Text>
        <Text style={{ color: slot.phase === 'live' ? colors.primary : colors.muted, fontWeight: '700', fontSize: 13 }}>● {slot.label}</Text>
      </View>

      {!slot.editable && <View style={[ui.card, { backgroundColor: '#eef4fc', borderColor: '#cfe0f6' }]}><Text style={{ color: '#2f66a8' }}>{slot.phase === 'upcoming' ? `${slot.label}. Bạn có thể xem trước danh sách học viên.` : slot.phase === 'cancelled' ? 'Buổi học đã hủy nên không điểm danh.' : `Buổi học đã quá ${EDITABLE_DAYS} ngày nên chỉ xem được. Liên hệ quản lý nếu cần sửa.`}</Text></View>}
      {startsPresent && <View style={[ui.card, { backgroundColor: '#eef4fc', borderColor: '#cfe0f6' }]}><Text style={{ color: '#2f66a8', lineHeight: 21 }}>Buổi chưa điểm danh: cả lớp đang được đánh <Text style={{ fontWeight: '800' }}>có mặt</Text>. Chỉ cần chọn <Text style={{ fontWeight: '800' }}>Vắng</Text> cho người không đến rồi bấm Lưu.</Text></View>}
      <QueryStatus loading={records.loading} error={records.error} retry={records.reload} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {FILTERS.map(([key, label]) => {
          const count = key === 'ALL' ? students.length : key === 'UNMARKED' ? counts.unmarked : key === 'PRESENT' ? counts.present : counts.absent;
          const on = filter === key;
          return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFilter(key)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : '#fff' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: on ? '#fff' : colors.muted }}>{label} {count}</Text>
          </Pressable>;
        })}
      </View>
      {students.length > 6 && <TextInput value={search} onChangeText={setSearch} placeholder="Tìm học viên…" placeholderTextColor="#94a3b8" accessibilityLabel="Tìm học viên" style={{ minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#fff', color: colors.ink }} />}
      {editable && students.length > 0 && <Button secondary title="Tất cả có mặt" disabled={busy} onPress={() => setMarks(Object.fromEntries(students.map(student => [entityId(student), 'PRESENT' as AttendanceStatus])))} />}

      {students.length ? <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff' }}>
        {visible.map(student => {
          const memberId = entityId(student);
          return <StudentRow key={memberId} index={students.indexOf(student)} student={student} status={currentStatus(memberId, saved, effective)}
            history={memberHistory(memberId, classId, data!.attendances, day)} disabled={!editable || busy}
            onMark={value => setMarks(current => ({ ...current, [memberId]: value }))} />;
        })}
        {!visible.length && <Text style={[ui.body, { padding: 14 }]}>Không có học viên ở bộ lọc này.</Text>}
      </View> : <View style={ui.card}><Text style={ui.heading}>Lớp chưa có học viên đã xác nhận</Text><Text style={ui.body}>Học viên xuất hiện sau khi đăng ký và thanh toán học phí.</Text></View>}

      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      {editable && students.length > 0 && <View style={[ui.card, { gap: 10 }]}>
        <Text style={ui.body}><Text style={{ fontWeight: '800', color: colors.ink }}>{counts.present}</Text> có mặt · <Text style={{ fontWeight: '800', color: colors.ink }}>{counts.absent}</Text> vắng{counts.unmarked ? ` · ${counts.unmarked} chưa điểm danh` : ''}</Text>
        <Button title={busy ? 'Đang lưu…' : changes.length ? `Lưu điểm danh (${changes.length})` : 'Chưa có thay đổi'} disabled={busy || !changes.length} onPress={() => void save()} />
      </View>}
    </>}
  </Screen>;
}
