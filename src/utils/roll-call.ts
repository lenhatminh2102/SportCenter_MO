// Roll call for one scheduled session: merge saved attendance with the coach's new marks.
import { entityId, referenceId, type Entity } from '@/services/operations';
export type AttendanceStatus = 'PRESENT' | 'ABSENT';
export type SavedAttendance = { id: string; status: string };
export type RollCallChange = { memberId: string; name: string; status: AttendanceStatus; recordId?: string };
/** memberId → saved attendance record of this session. */
export function savedAttendance(records: Entity[]): Record<string, SavedAttendance> {
  return Object.fromEntries(records.map(item => [referenceId(item.memberId), { id: entityId(item), status: String(item.status) }]).filter(([memberId]) => !!memberId));
}
/** Status shown for a student: the coach's new mark, else what is already saved. */
export const currentStatus = (memberId: string, saved: Record<string, SavedAttendance>, marks: Record<string, AttendanceStatus>) => marks[memberId] || saved[memberId]?.status || '';
/** Only students whose mark differs from what is saved: new records are created, saved ones updated. */
export function rollCallChanges(students: Entity[], records: Entity[], marks: Record<string, AttendanceStatus>): RollCallChange[] {
  const saved = savedAttendance(records);
  return students.flatMap(student => {
    const memberId = entityId(student); const status = marks[memberId];
    if (!memberId || !status || saved[memberId]?.status === status) return [];
    return [{ memberId, name: String(student.fullName || ''), status, ...(saved[memberId] ? { recordId: saved[memberId].id } : {}) }];
  });
}
export function rollCallCounts(students: Entity[], records: Entity[], marks: Record<string, AttendanceStatus>) {
  const saved = savedAttendance(records);
  const statuses = students.map(student => currentStatus(entityId(student), saved, marks));
  return { present: statuses.filter(status => status === 'PRESENT').length, absent: statuses.filter(status => status === 'ABSENT').length, unmarked: statuses.filter(status => !status).length };
}
