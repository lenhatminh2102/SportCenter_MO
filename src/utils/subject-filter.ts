// Sport (môn) of any record, for filter chips and grouped lists (same rules as the web app).
import { classesApi, coursesApi, entityId, learningPathsApi, referenceId, subjectsApi, type Entity } from '@/services/operations';

/** Lists whose records belong to one sport, so they can be filtered by it. */
export const SUBJECT_RESOURCES = [
  'courses', 'learning-paths', 'lessons', 'classes', 'schedules', 'class-registrations',
  'attendances', 'lesson-progress', 'workout-plans', 'workout-results', 'coaches',
];

export type SubjectIndex = {
  names: Map<string, string>; courseSubject: Map<string, string>; classSubject: Map<string, string>;
  coachSubject: Map<string, string>; pathSubject: Map<string, string>;
};
export type SubjectOption = { id: string; name: string; count: number };

const settle = (promise: Promise<Entity[]>) => promise.then(items => (Array.isArray(items) ? items : [])).catch(() => [] as Entity[]);

/** Lookup tables; a list the role cannot read just leaves its links empty ("Chưa rõ môn"). */
export async function loadSubjectIndex(token: string): Promise<SubjectIndex> {
  const [subjects, classes, courses, paths] = await Promise.all([
    settle(subjectsApi.list(token)), settle(classesApi.list(token)), settle(coursesApi.list(token)), settle(learningPathsApi.list(token)),
  ]);
  return buildSubjectIndex({ subjects, classes, courses, paths });
}

export function buildSubjectIndex({ subjects = [], classes = [], courses = [], paths = [] }: { subjects?: Entity[]; classes?: Entity[]; courses?: Entity[]; paths?: Entity[] }): SubjectIndex {
  const courseSubject = new Map(courses.map(item => [entityId(item), referenceId(item.subjectId)]));
  const classSubject = new Map(classes.map(item => [entityId(item), referenceId(item.subjectId) || courseSubject.get(referenceId(item.courseId)) || '']));
  const coachSubject = new Map(classes.map(item => [referenceId(item.coachId), classSubject.get(entityId(item)) || '']));
  const pathSubject = new Map(paths.map(item => [entityId(item), courseSubject.get(referenceId(item.courseId)) || '']));
  const names = new Map(subjects.map(item => [entityId(item), String(item.name || '')]));
  // Populated references carry the name even when the subjects list is not readable.
  for (const item of [...classes, ...courses]) {
    const subject = item.subjectId;
    if (subject && typeof subject === 'object' && !names.has(referenceId(subject))) names.set(referenceId(subject), String((subject as Entity).name || ''));
  }
  return { names, courseSubject, classSubject, coachSubject, pathSubject };
}

const object = (value: unknown) => (value && typeof value === 'object' ? value as Entity : null);

/** Sport id of a record ('' when unknown). Works with populated or plain id references. */
export function subjectOf(resource: string, item: Entity | null | undefined, index: SubjectIndex | null | undefined): string {
  if (!item || !index) return '';
  const fromClass = (value: unknown) => {
    const populated = object(value);
    if (populated?.subjectId) return referenceId(populated.subjectId);
    return index.classSubject.get(referenceId(value)) || '';
  };
  switch (resource) {
    case 'courses':
    case 'coaches': return referenceId(item.subjectId);
    case 'classes': return referenceId(item.subjectId) || index.courseSubject.get(referenceId(item.courseId)) || '';
    case 'learning-paths': return index.courseSubject.get(referenceId(item.courseId)) || '';
    case 'lessons': return fromClass(item.classId) || index.pathSubject.get(referenceId(item.learningPathId)) || '';
    case 'workout-plans': return fromClass(item.classId) || index.coachSubject.get(referenceId(item.coachId)) || '';
    case 'workout-results': {
      const plan = object(item.workoutPlanId);
      return plan ? fromClass(plan.classId) || index.coachSubject.get(referenceId(plan.coachId)) || '' : '';
    }
    default: return fromClass(item.classId);
  }
}

/** Sports present in `records`, most used first; '' collects the unknown ones. */
export function subjectCounts(resource: string, records: Entity[], index: SubjectIndex): SubjectOption[] {
  const counts = new Map<string, number>();
  for (const item of records) {
    const id = subjectOf(resource, item, index);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count, name: id ? index.names.get(id) || 'Môn khác' : 'Chưa rõ môn' }))
    .sort((a, b) => Number(a.id === '') - Number(b.id === '') || b.count - a.count || a.name.localeCompare(b.name, 'vi'));
}

/** Chip value → subject id ('-' is the "unknown sport" chip). */
export const wantedSubject = (value: string) => (value === '-' ? '' : value);

const TONES = ['#f05a28', '#7c4dcc', '#15803d', '#2f66a8'];
/** Stable colour per sport, used by chips and grouped sections. */
export const subjectTone = (id: string, ids: string[]) => TONES[Math.max(0, ids.indexOf(id)) % TONES.length];
