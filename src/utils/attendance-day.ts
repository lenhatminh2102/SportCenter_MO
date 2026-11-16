// Coach roll call by day (same rules as the web app): when a session can be marked,
// how far it is marked, and each student's recent record in the class.
import { referenceId, type Entity } from '@/services/operations';
import { dayOf } from './coach-teaching';
import { addDays } from './schedule-time';

export const OPEN_BEFORE_MINUTES = 15;
export const EDITABLE_DAYS = 7;

/** Bangkok wall clock "YYYY-MM-DD" + "HH:mm" → epoch ms. */
export const at = (day: string, time: string) => Date.parse(`${day}T${time}:00+07:00`);
const hhmm = (ms: number) => new Date(ms + 7 * 3600000).toISOString().slice(11, 16);
/** Today in Bangkok as "YYYY-MM-DD". */
export const bangkokToday = (now = Date.now()) => new Date(now + 7 * 3600000).toISOString().slice(0, 10);

export type SessionPhase = 'cancelled' | 'upcoming' | 'live' | 'ended' | 'expired';
export type SessionWindow = { phase: SessionPhase; editable: boolean; label: string; opensAt?: string; progress?: number };

/** Marking opens 15 minutes before the start and stays editable for 7 days after the session day. */
export function sessionWindow(session: Entity, now: number): SessionWindow {
  const day = dayOf(session.date);
  const start = at(day, String(session.startTime));
  const end = at(day, String(session.endTime));
  const opens = start - OPEN_BEFORE_MINUTES * 60000;
  const closes = at(addDays(day, EDITABLE_DAYS), '23:59');
  if (session.status === 'CANCELLED') return { phase: 'cancelled', editable: false, label: 'Buổi học đã hủy' };
  if (now < opens) return { phase: 'upcoming', editable: false, opensAt: hhmm(opens), label: `Mở điểm danh lúc ${hhmm(opens)}` };
  if (now < end) {
    const left = Math.max(0, Math.ceil((end - now) / 60000));
    return { phase: 'live', editable: true, progress: Math.min(1, Math.max(0, (now - start) / (end - start))), label: now < start ? `Sắp bắt đầu lúc ${String(session.startTime)}` : `Đang diễn ra · còn ${left} phút` };
  }
  if (now <= closes) return { phase: 'ended', editable: true, label: 'Đã kết thúc' };
  return { phase: 'expired', editable: false, label: `Quá ${EDITABLE_DAYS} ngày, chỉ xem` };
}

/** Attendance of one session (same class, lesson and day) → memberId → status. */
export function sessionMarks(session: Entity, attendances: Entity[]) {
  const classId = referenceId(session.classId);
  const lessonId = referenceId(session.lessonId);
  const day = dayOf(session.date);
  const marks = new Map<string, string>();
  for (const item of attendances) {
    if (referenceId(item.classId) === classId && referenceId(item.lessonId) === lessonId && dayOf(item.date) === day) marks.set(referenceId(item.memberId), String(item.status));
  }
  return marks;
}

export function sessionProgress(session: Entity, attendances: Entity[], studentIds: string[]) {
  const marks = sessionMarks(session, attendances);
  const marked = studentIds.filter(id => marks.has(id));
  return {
    total: studentIds.length,
    marked: marked.length,
    present: marked.filter(id => marks.get(id) === 'PRESENT').length,
    absent: marked.filter(id => marks.get(id) === 'ABSENT').length,
    complete: studentIds.length > 0 && marked.length === studentIds.length,
  };
}

export type MemberHistory = { recent: string[]; presentStreak: number; absentStreak: number; total: number; present: number };

/** A student's sessions in this class before `day` (oldest → newest) plus streaks. */
export function memberHistory(memberId: string, classId: string, attendances: Entity[], day: string): MemberHistory {
  const rows = attendances
    .filter(item => referenceId(item.memberId) === memberId && referenceId(item.classId) === classId && dayOf(item.date) < day)
    .sort((a, b) => dayOf(a.date).localeCompare(dayOf(b.date)))
    .map(item => String(item.status));
  const streak = (status: string) => {
    let count = 0;
    for (let index = rows.length - 1; index >= 0 && rows[index] === status; index -= 1) count += 1;
    return count;
  };
  return { recent: rows.slice(-5), presentStreak: streak('PRESENT'), absentStreak: streak('ABSENT'), total: rows.length, present: rows.filter(status => status === 'PRESENT').length };
}

/** Short note under a student's name. tone: blue | red | green | muted */
export function historyNote(history: MemberHistory) {
  if (history.total === 0) return { tone: 'blue', text: 'Buổi đầu tiên' };
  if (history.absentStreak >= 2) return { tone: 'red', text: `Vắng ${history.absentStreak} buổi liền` };
  if (history.presentStreak >= 3) return { tone: 'green', text: `${history.presentStreak} buổi liên tiếp` };
  return { tone: 'muted', text: `Đi ${history.present}/${history.total} buổi` };
}

/** Monday of the week containing `day`. */
export const weekStart = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
