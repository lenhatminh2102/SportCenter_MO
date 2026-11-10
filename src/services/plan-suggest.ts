import { membersApi } from './members';
import { attendancesApi, classesApi, coachesApi, entityId, referenceId, referenceLabel, workoutResultsApi, type Entity } from './operations';
import { suggestExercises } from '@/utils/exercise-suggest';
const newestFirst = (items: Entity[]) => [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
/**
 * Gathers goal, level, sport and history for a plan target, then builds a suggestion.
 * Returns the member's saved goal/level too, so the form can prefill empty fields.
 */
export async function loadPlanSuggestion(token: string, input: { memberId?: string; classId?: string; goal?: string; level?: string }) {
  const settled = await Promise.allSettled([classesApi.list(token), coachesApi.myStudents(token), input.memberId ? membersApi.list(token) : Promise.resolve([]), input.memberId ? workoutResultsApi.list(token) : Promise.resolve([]), input.memberId ? attendancesApi.list(token) : Promise.resolve([])]);
  const value = <T,>(index: number, fallback: T): T => settled[index].status === 'fulfilled' ? (settled[index] as PromiseFulfilledResult<T>).value : fallback;
  const classes = value<Entity[]>(0, []); const students = value<Entity[]>(1, []); const members = value<Entity[]>(2, []);
  const results = newestFirst(value<Entity[]>(3, []).filter(item => referenceId(item.memberId) === input.memberId));
  const attendance = value<Entity[]>(4, []).filter(item => referenceId(item.memberId) === input.memberId);
  const member = members.find(item => entityId(item) === input.memberId);
  const classId = input.classId || referenceId(students.find(row => referenceId(row.member) === input.memberId)?.class);
  const classInfo = classes.find(item => entityId(item) === classId);
  const goal = input.goal?.trim() || String(member?.goal || '');
  // The member's saved level wins over the form default; the coach can still change it afterwards.
  const level = String(member?.level || '') || input.level || '';
  const suggestion = suggestExercises({
    subject: classInfo ? referenceLabel(classInfo.subjectId) : '', goal, level, forClass: !input.memberId,
    history: { results: results.length, lastResult: results[0] ? String(results[0].result || '') : undefined, lastComment: results[0]?.comment ? String(results[0].comment) : undefined, sessions: attendance.length, absences: attendance.filter(item => item.status === 'ABSENT').length },
  });
  return { ...suggestion, memberGoal: String(member?.goal || ''), memberLevel: String(member?.level || '') };
}
