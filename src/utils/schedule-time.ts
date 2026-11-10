// Pure date/time helpers for schedule forms. Dates are ISO "YYYY-MM-DD" calendar days
// (no timezone math), times are 24h "HH:mm".
import { entityId, type Entity } from '@/services/operations';
const pad = (value: number) => String(value).padStart(2, '0');
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAY_LONG = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
/** Monday-first order used by the weekday picker (0 = Sunday). */
export const weekdayOptions = [1, 2, 3, 4, 5, 6, 0].map(day => ({ day, label: WEEKDAY_SHORT[day] }));
function isoFromParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year}-${pad(month)}-${pad(day)}`;
}
export const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && isoFromParts(Number(value.slice(0, 4)), Number(value.slice(5, 7)), Number(value.slice(8, 10))) === value;
/** Accepts YYYY-MM-DD, D/M/YYYY, D-M-YYYY, D.M.YYYY or D/M (year of `today`). Returns ISO or ''. */
export function parseDateInput(text: string, today: string): string {
  const value = text.trim();
  if (isIsoDate(value)) return value;
  const match = value.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/);
  if (!match) return '';
  const year = match[3] ? (match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])) : Number(today.slice(0, 4));
  return isoFromParts(year, Number(match[2]), Number(match[1]));
}
export const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
export const shortWeekday = (iso: string) => WEEKDAY_SHORT[weekdayOf(iso)];
export const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const formatDateLabel = (iso: string) => isIsoDate(iso) ? `${WEEKDAY_LONG[weekdayOf(iso)]}, ${dayMonth(iso)}/${iso.slice(0, 4)}` : '';
export function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export const upcomingDays = (today: string, count = 14) => Array.from({ length: count }, (_, index) => addDays(today, index));
/** "1830", "18h30", "18.30", "18", "9:5" → "18:30" / "18:00" / "09:05"; '' when not a valid time. */
export function normalizeTime(text: string): string {
  const value = text.trim().toLowerCase().replace(/\s/g, '');
  let match = value.match(/^(\d{1,2})[:h.](\d{1,2})?$/) || value.match(/^(\d{1,2})$/);
  let hours: number; let minutes: number;
  if (match) { hours = Number(match[1]); minutes = Number(match[2] || 0); }
  else if ((match = value.match(/^(\d{1,2})(\d{2})$/))) { hours = Number(match[1]); minutes = Number(match[2]); }
  else return '';
  return hours > 23 || minutes > 59 ? '' : `${pad(hours)}:${pad(minutes)}`;
}
export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
/** Adds minutes within the same day (clamped to 00:00–23:59). */
export function addMinutes(time: string, minutes: number) {
  if (!normalizeTime(time)) return '';
  const total = Math.min(23 * 60 + 59, Math.max(0, toMinutes(time) + minutes));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
export const commonStartTimes = ['06:00', '07:00', '08:00', '09:00', '14:00', '16:00', '17:00', '17:30', '18:00', '18:30', '19:00', '20:00'];
export const sessionLengths = [45, 60, 90, 120];
export function durationLabel(start: string, end: string) {
  if (!normalizeTime(start) || !normalizeTime(end) || end <= start) return '';
  const minutes = toMinutes(end) - toMinutes(start);
  return minutes % 60 === 0 ? `${minutes / 60} giờ` : minutes > 60 ? `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút` : `${minutes} phút`;
}
/** First `count` dates on/after `start` whose weekday is in `weekdays` (0 = Sunday). */
export function repeatDates(start: string, weekdays: number[], count: number) {
  if (!isIsoDate(start) || !weekdays.length || count < 1) return [];
  const dates: string[] = [];
  for (let day = start; dates.length < count; day = addDays(day, 1)) if (weekdays.includes(weekdayOf(day))) dates.push(day);
  return dates;
}
/** Lesson ids for `count` sessions starting at `firstLessonId`, in lesson order, cycling back to the first. */
export function cycleLessons(lessons: Entity[], firstLessonId: string, count: number) {
  const ordered = [...lessons].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).map(entityId).filter(Boolean);
  const start = ordered.indexOf(firstLessonId);
  if (start < 0) return Array.from({ length: count }, () => firstLessonId);
  return Array.from({ length: count }, (_, index) => ordered[(start + index) % ordered.length]);
}
export const MAX_REPEAT = 52;
