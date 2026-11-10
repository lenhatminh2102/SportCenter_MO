import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { loadCoachAttendanceContext, coachAttendanceApi } from '@/services/coach-teaching';
import { attendancesApi, entityId, referenceId, referenceLabel, type Entity } from '@/services/operations';
import { useApiQuery } from '@/hooks/use-api-query';
import { useScheduleAttendances } from '@/hooks/use-schedule-attendances';
import { classSessions, attendanceMembers, dayOf } from '@/utils/coach-teaching';
import { currentStatus, rollCallChanges, rollCallCounts, savedAttendance, type AttendanceStatus } from '@/utils/roll-call';
import { bangkokDate } from '@/services/dashboard';
import { colors } from '@/data/sport';
import { Button } from './ui';
import { Chip, DateField } from './date-time-fields';
import { QueryStatus } from './access';
import { ui } from './styles';
const statusText: Record<string, string> = { PRESENT: 'Có mặt', ABSENT: 'Vắng mặt' };
/**
 * Coach attendance. New: pick class → day → session, then mark the whole class as a list and save once.
 * Editing an existing record (`initial`) keeps the single-student flow.
 */
export function CoachAttendanceForm({ token, initial, defaults, onSaved }: { token: string; initial?: Entity; defaults?: Record<string, string>; onSaved: () => void }) {
  const [classId, setClassId] = useState(referenceId(initial?.classId) || defaults?.classId || '');
  const [day, setDay] = useState(dayOf(initial?.date) || defaults?.date || bangkokDate(new Date()));
  const [scheduleId, setScheduleId] = useState(defaults?.scheduleId || '');
  const [status, setStatus] = useState<AttendanceStatus>(initial?.status === 'ABSENT' ? 'ABSENT' : 'PRESENT');
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const pending = useRef(false);
  const load = useCallback(() => loadCoachAttendanceContext(token), [token]); const query = useApiQuery(load);
  const data = query.data; const selectedClass = data?.classes.find(item => entityId(item) === classId);
  const sessions = selectedClass ? classSessions(data?.schedules || [], classId, day) : [];
  const selected = initial ? sessions.find(item => referenceId(item.lessonId) === referenceId(initial.lessonId)) : sessions.find(item => entityId(item) === scheduleId) || (!scheduleId && sessions.length === 1 ? sessions[0] : undefined);
  const students = selectedClass ? attendanceMembers(data?.students || [], classId) : [];
  const records = useScheduleAttendances(token, selected ? entityId(selected) : '');
  const saved = savedAttendance(records.data || []);
  const changes = rollCallChanges(students, records.data || [], marks);
  const counts = rollCallCounts(students, records.data || [], marks);
  const resetSession = () => { setScheduleId(''); setMarks({}); setError(''); };
  /** Fresh check: the session is still scheduled and these students are still confirmed in the class. */
  async function freshSession() {
    const fresh = await loadCoachAttendanceContext(token);
    const current = fresh.schedules.find(item => entityId(item) === entityId(selected!) && item.status !== 'CANCELLED' && dayOf(item.date) === day && referenceId(item.classId) === classId && referenceId(item.lessonId) === referenceId(selected!.lessonId));
    if (!current) throw new Error('Buổi học đã thay đổi hoặc bị hủy. Vui lòng tải lại buổi học.');
    return { current, confirmed: new Set(attendanceMembers(fresh.students, classId).map(entityId)) };
  }
  async function saveRollCall() {
    if (pending.current) return; setError('');
    if (!selectedClass || !selected) { setError('Chọn lớp và buổi học.'); return; }
    if (!changes.length) { setError('Chưa có thay đổi để lưu. Chọn Có mặt hoặc Vắng cho học viên.'); return; }
    pending.current = true; setBusy(true);
    try {
      const { current, confirmed } = await freshSession();
      const failed: { memberId: string; message: string }[] = [];
      for (const change of changes) {
        try {
          if (!confirmed.has(change.memberId)) throw new Error('không còn trong danh sách đã xác nhận');
          if (change.recordId) await attendancesApi.update(token, change.recordId, { memberId: change.memberId, classId, lessonId: referenceId(current.lessonId), date: dayOf(current.date), status: change.status });
          else await coachAttendanceApi.create(token, change.memberId, entityId(current), change.status);
        } catch (e) { failed.push({ memberId: change.memberId, message: `${change.name || change.memberId}: ${(e as Error).message}` }); }
      }
      if (!failed.length) { onSaved(); return; }
      // Keep only the marks that failed so the coach can retry them; saved ones now come from the server.
      const failedIds = new Set(failed.map(item => item.memberId));
      records.reload(); setMarks(current => Object.fromEntries(Object.entries(current).filter(([memberId]) => failedIds.has(memberId))));
      setError(`Lưu được ${changes.length - failed.length}/${changes.length} học viên. Chưa lưu: ${failed.map(item => item.message).join('; ')}`);
    } catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  async function saveSingle() {
    if (pending.current || !initial) return; setError('');
    const memberId = referenceId(initial.memberId);
    if (!selectedClass || !selected) { setError('Không tìm thấy buổi học của bản điểm danh này.'); return; }
    pending.current = true; setBusy(true);
    try {
      const { current, confirmed } = await freshSession();
      if (!confirmed.has(memberId)) throw new Error('Học viên không còn trong danh sách đã xác nhận của lớp.');
      await attendancesApi.update(token, entityId(initial), { memberId, classId, lessonId: referenceId(current.lessonId), date: dayOf(current.date), status });
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { pending.current = false; setBusy(false); }
  }
  const locked = busy || !!initial;
  return <View style={{ gap: 18 }}><Text style={ui.body}>Chọn lớp và ngày để xem lịch dạy, rồi điểm danh cả lớp trong một lần lưu.</Text><QueryStatus loading={query.loading} error={query.error} retry={query.reload} />{data && <>
    <View style={ui.card}><Text style={ui.heading}>Lớp tôi phụ trách</Text>{data.classes.map(item => <Button key={entityId(item)} secondary={classId !== entityId(item)} disabled={locked} title={`${String(item.name)} · ${referenceLabel(item.subjectId)}`} onPress={() => { setClassId(entityId(item)); setDay(bangkokDate(new Date())); resetSession(); }} />)}{!data.classes.length && <Text style={ui.body}>Bạn chưa được phân công lớp.</Text>}</View>
    {selectedClass && <View style={ui.card}>
      <DateField label="Ngày học" value={day} disabled={locked} onChange={value => { setDay(value); resetSession(); }} />
      {(() => { const days = [...new Set(classSessions(data.schedules, classId).map(item => dayOf(item.date)))]; return days.length > 0 && <View style={{ gap: 6 }}><Text style={[ui.body, { fontSize: 13 }]}>Ngày có lịch của lớp</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{days.map(value => <Chip key={value} label={`${value.slice(8, 10)}/${value.slice(5, 7)}`} selected={value === day} disabled={locked} onPress={() => { setDay(value); resetSession(); }} />)}</View></View>; })()}
      {sessions.map(item => <View key={entityId(item)} style={{ gap: 6 }}><Button secondary={!selected || entityId(selected) !== entityId(item)} disabled={locked} title={`${String(item.startTime)}–${String(item.endTime)} · ${referenceLabel(item.lessonId)}`} onPress={() => { setScheduleId(entityId(item)); setMarks({}); }} /><Text style={ui.body}>Phòng: {referenceLabel(item.roomId)}</Text></View>)}
      {!sessions.length && <Text style={ui.body}>Không có lịch dạy của lớp này vào ngày đã chọn.</Text>}
    </View>}
    {selected && <View style={ui.card}>
      <Text style={ui.heading}>Danh sách học viên</Text>
      <Text style={ui.body}>{referenceLabel(selected.lessonId)} · {dayOf(selected.date)} · {String(selected.startTime)}–{String(selected.endTime)} · Phòng {referenceLabel(selected.roomId)}</Text>
      <QueryStatus loading={records.loading} error={records.error} retry={records.reload} />
      {initial ? <>
        {students.filter(item => entityId(item) === referenceId(initial.memberId)).map(item => <StudentRow key={entityId(item)} student={item} index={0} saved={saved[entityId(item)]?.status} value={status} disabled={busy} onMark={setStatus} />)}
        <Button disabled={busy} title={busy ? 'Đang lưu…' : 'Lưu điểm danh'} onPress={() => void saveSingle()} />
      </> : <>
        {students.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Text style={[ui.body, { flex: 1, minWidth: 180 }]}>{students.length} học viên · {counts.present} có mặt · {counts.absent} vắng · {counts.unmarked} chưa điểm danh</Text>
          <Chip label="Tất cả có mặt" disabled={busy || records.loading} onPress={() => setMarks(Object.fromEntries(students.map(item => [entityId(item), 'PRESENT' as const])))} />
        </View>}
        {students.map((item, index) => <StudentRow key={entityId(item)} student={item} index={index} saved={saved[entityId(item)]?.status} value={currentStatus(entityId(item), saved, marks)} changed={changes.some(change => change.memberId === entityId(item))} disabled={busy || records.loading || !!records.error} onMark={value => setMarks(current => ({ ...current, [entityId(item)]: value }))} />)}
        {!students.length && <Text style={ui.body}>Chưa có học viên đã xác nhận (đã thanh toán) trong lớp.</Text>}
        {students.length > 0 && <Button disabled={busy || records.loading || !!records.error || !changes.length} title={busy ? 'Đang lưu…' : changes.length ? `Lưu điểm danh (${changes.length} học viên)` : 'Chưa có thay đổi'} onPress={() => void saveRollCall()} />}
      </>}
    </View>}
  </>}{!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}</View>;
}
function StudentRow({ student, index, saved, value, changed = false, disabled, onMark }: { student: Entity; index: number; saved?: string; value: string; changed?: boolean; disabled: boolean; onMark: (status: AttendanceStatus) => void }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: colors.border }}>
    <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '700' }}>{index + 1}. {String(student.fullName || 'Chưa có tên')}</Text>
      <Text style={[ui.body, { fontSize: 12 }]}>{student.phone ? String(student.phone) : 'Chưa có số điện thoại'}{saved ? ` · Đã lưu: ${statusText[saved] || saved}` : ' · Chưa điểm danh'}{changed ? ' · chưa lưu thay đổi' : ''}</Text>
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Chip label="Có mặt" selected={value === 'PRESENT'} disabled={disabled} accessibilityLabel={`${String(student.fullName || '')} có mặt`} onPress={() => onMark('PRESENT')} />
      <Chip label="Vắng" selected={value === 'ABSENT'} disabled={disabled} accessibilityLabel={`${String(student.fullName || '')} vắng mặt`} onPress={() => onMark('ABSENT')} />
    </View>
  </View>;
}
