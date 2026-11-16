// Class storefront data (same rules as the web app): price, coach, timetable summary,
// lessons with videos and the member's own registration, one entry per open class.
import { classesApi, classRegistrationsApi, coursePrice, coursesApi, entityId, lessonsApi, referenceId, referenceLabel, schedulesApi, type Entity } from '@/services/operations';
import { dayOf } from './coach-teaching';
import { shortWeekday, weekdayOf } from './schedule-time';
import { videoEmbed } from './video';

const settle = (promise: Promise<Entity[]>) => promise.then(items => (Array.isArray(items) ? items : [])).catch(() => [] as Entity[]);
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

export type Daypart = 'morning' | 'afternoon' | 'evening';
export const daypartOf = (time: string): Daypart => (time < '12:00' ? 'morning' : time < '17:00' ? 'afternoon' : 'evening');
export const DAYPARTS: { id: Daypart | 'weekend'; label: string }[] = [
  { id: 'morning', label: 'Sáng' }, { id: 'afternoon', label: 'Chiều' }, { id: 'evening', label: 'Tối' }, { id: 'weekend', label: 'Cuối tuần' },
];

export type CatalogData = { classes: Entity[]; courses: Entity[]; schedules: Entity[]; lessons: Entity[]; registrations: Entity[] };
export async function loadCatalog(token: string): Promise<CatalogData> {
  const [classes, courses, schedules, lessons, registrations] = await Promise.all([
    classesApi.list(token), settle(coursesApi.list(token)), settle(schedulesApi.list(token)), settle(lessonsApi.list(token)), settle(classRegistrationsApi.list(token)),
  ]);
  return { classes: Array.isArray(classes) ? classes : [], courses, schedules, lessons, registrations };
}

export type CatalogEntry = {
  id: string; raw: Entity; name: string; subjectId: string; subjectName: string; courseName: string; description: string; imageUrl: string;
  price?: number; perSession?: number; coachName: string; coachLabel: string; sessions: Entity[]; upcoming: Entity[]; nextSession: Entity | null;
  startsOn: string; finished: boolean; weekdays: number[]; weekdayLabel: string; timeRange: string; dayparts: Set<Daypart>; weekend: boolean;
  lessons: Entity[]; previewLesson: Entity | null; registration: Entity | null; enrolled: boolean; pending: boolean;
};

export function buildCatalog(data: CatalogData, { memberId = '', now = Date.now() } = {}): CatalogEntry[] {
  const today = new Date(now + 7 * 3600000).toISOString().slice(0, 10);
  const courseById = new Map(data.courses.map(item => [entityId(item), item]));
  const sessionsByClass = new Map<string, Entity[]>();
  for (const item of data.schedules) {
    if (item.status === 'CANCELLED') continue;
    const key = referenceId(item.classId);
    sessionsByClass.set(key, [...(sessionsByClass.get(key) || []), item]);
  }
  const lessonsByClass = new Map<string, Entity[]>();
  for (const item of data.lessons) {
    const key = referenceId(item.classId);
    if (key) lessonsByClass.set(key, [...(lessonsByClass.get(key) || []), item]);
  }
  const mine = new Map<string, Entity>();
  for (const item of data.registrations) {
    if (memberId && referenceId(item.memberId) !== memberId) continue;
    if (!['CONFIRMED', 'PENDING_PAYMENT'].includes(String(item.status))) continue;
    const key = referenceId(item.classId);
    if (!mine.has(key) || item.status === 'CONFIRMED') mine.set(key, item);
  }
  return data.classes.flatMap(item => {
    const id = entityId(item);
    const course = courseById.get(referenceId(item.courseId)) || (item.courseId && typeof item.courseId === 'object' ? item.courseId as Entity : undefined);
    if (course?.status === 'INACTIVE') return [];
    const sessions = (sessionsByClass.get(id) || []).sort((a, b) => `${dayOf(a.date)} ${a.startTime}`.localeCompare(`${dayOf(b.date)} ${b.startTime}`));
    const upcoming = sessions.filter(session => dayOf(session.date) >= today);
    const counts = new Map<string, number>();
    for (const session of sessions) { const key = `${String(session.startTime)}–${String(session.endTime)}`; counts.set(key, (counts.get(key) || 0) + 1); }
    const timeRange = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const weekdays = MONDAY_FIRST.filter(day => sessions.some(session => weekdayOf(dayOf(session.date)) === day));
    const lessons = (lessonsByClass.get(id) || []).sort((a, b) => Number(a.order) - Number(b.order));
    const price = coursePrice(course);
    const registration = mine.get(id) || null;
    const first = sessions[0];
    const coachName = referenceLabel(item.coachId);
    return [{
      id, raw: item, name: String(item.name || ''), subjectId: referenceId(item.subjectId), subjectName: referenceLabel(item.subjectId),
      courseName: course ? String(course.name || '') : referenceLabel(item.courseId), description: String(course?.description || '').trim(), imageUrl: String(course?.imageUrl || ''),
      price, perSession: typeof price === 'number' && sessions.length && price / sessions.length >= 1000 ? Math.round(price / sessions.length / 1000) * 1000 : undefined,
      coachName, coachLabel: /^hlv(\s|\d|$)/i.test(coachName) ? coachName : `HLV ${coachName}`,
      sessions, upcoming, nextSession: upcoming[0] || null, startsOn: first && dayOf(first.date) > today ? dayOf(first.date) : '',
      finished: sessions.length > 0 && upcoming.length === 0, weekdays,
      weekdayLabel: weekdays.map(day => shortWeekday(`2024-01-0${day === 0 ? 7 : day}`)).join(' · '), timeRange,
      dayparts: new Set(sessions.map(session => daypartOf(String(session.startTime)))), weekend: weekdays.includes(6) || weekdays.includes(0),
      lessons, previewLesson: lessons.find(lesson => videoEmbed(lesson.videoUrl)) || null,
      registration, enrolled: registration?.status === 'CONFIRMED', pending: registration?.status === 'PENDING_PAYMENT',
    }];
  });
}

/** Next class to start that the member has not joined (priced, more than one session first). */
export function featuredClass(entries: CatalogEntry[]) {
  const all = entries.filter(entry => !entry.registration && entry.upcoming.length);
  const showcase = all.filter(entry => typeof entry.price === 'number' && entry.price > 0 && entry.sessions.length > 1);
  const open = showcase.length ? showcase : all;
  const starting = open.filter(entry => entry.startsOn).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  if (starting[0]) return starting[0];
  return [...open].sort((a, b) => `${dayOf(a.nextSession!.date)} ${a.nextSession!.startTime}`.localeCompare(`${dayOf(b.nextSession!.date)} ${b.nextSession!.startTime}`))[0] || null;
}

export const SORTS = [
  { value: 'soon', label: 'Sắp diễn ra' }, { value: 'price-asc', label: 'Giá thấp' }, { value: 'price-desc', label: 'Giá cao' }, { value: 'sessions', label: 'Nhiều buổi' },
];
export function sortCatalog(entries: CatalogEntry[], sort: string) {
  const next = (entry: CatalogEntry) => (entry.nextSession ? `${dayOf(entry.nextSession.date)} ${entry.nextSession.startTime}` : '9999');
  const price = (entry: CatalogEntry) => (typeof entry.price === 'number' ? entry.price : Number.MAX_SAFE_INTEGER);
  const sorted = [...entries];
  if (sort === 'price-asc') sorted.sort((a, b) => price(a) - price(b));
  else if (sort === 'price-desc') sorted.sort((a, b) => price(b) - price(a));
  else if (sort === 'sessions') sorted.sort((a, b) => b.sessions.length - a.sessions.length);
  else sorted.sort((a, b) => next(a).localeCompare(next(b)));
  return sorted;
}

/** "Khai giảng 14/11", "Đang diễn ra", "Đã kết thúc", "Chưa có lịch". */
export function timelineLabel(entry: CatalogEntry) {
  if (!entry.sessions.length) return 'Chưa có lịch';
  if (entry.startsOn) return `Khai giảng ${entry.startsOn.slice(8, 10)}/${entry.startsOn.slice(5, 7)}`;
  if (entry.finished) return 'Đã kết thúc';
  return 'Đang diễn ra';
}

/** Accent-insensitive text match. */
export function matches(query: string, ...values: unknown[]) {
  const fold = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const needle = fold(query.trim());
  return !needle || fold(values.join(' ')).includes(needle);
}
