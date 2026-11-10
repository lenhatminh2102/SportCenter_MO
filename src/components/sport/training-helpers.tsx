import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useApiQuery } from '@/hooks/use-api-query';
import { coachesApi, entityId, referenceId, referenceLabel, schedulesApi, type Entity } from '@/services/operations';
import { loadPlanSuggestion } from '@/services/plan-suggest';
import { bangkokDate } from '@/services/dashboard';
import { dayOf } from '@/utils/coach-teaching';
import { colors } from '@/data/sport';
import { Button } from './ui';
import { Chip } from './date-time-fields';
import { QueryStatus } from './access';
import { ui } from './styles';
export type PlanTarget = 'member' | 'class';
/** Workout plan for one student or the whole class (the BE accepts exactly one of them). */
export function PlanTargetPicker({ value, onChange, disabled }: { value: PlanTarget; onChange: (value: PlanTarget) => void; disabled?: boolean }) {
  return <View style={{ gap: 8 }}><Text style={ui.heading}>Kế hoạch cho</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    <Chip label="Một học viên" selected={value === 'member'} disabled={disabled} onPress={() => onChange('member')} />
    <Chip label="Cả lớp" selected={value === 'class'} disabled={disabled} onPress={() => onChange('class')} />
  </View></View>;
}
/** Builds an exercise plan from goal, level, sport and history; the coach reviews it before saving. */
export function PlanSuggestion({ token, values, disabled, onApply }: { token: string; values: Record<string, string>; disabled?: boolean; onApply: (patch: Record<string, string>) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [note, setNote] = useState('');
  const target = values.planTarget === 'class' ? { classId: values.classId } : { memberId: values.memberId };
  const ready = values.planTarget === 'class' ? !!values.classId : !!values.memberId;
  async function suggest() {
    setBusy(true); setError(''); setNote('');
    try {
      const result = await loadPlanSuggestion(token, { ...target, goal: values.goal, level: values.level });
      onApply({ plan: values.plan?.trim() ? `${values.plan.trim()}\n\n--- Gợi ý ---\n${result.text}` : result.text, ...(!values.goal?.trim() && result.memberGoal ? { goal: result.memberGoal } : {}), ...(result.memberLevel ? { level: result.memberLevel } : {}) });
      setNote(`Đã điền gợi ý (trọng tâm: ${result.focus.join(', ')}). Xem lại và chỉnh trước khi lưu.`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <View style={{ gap: 8, padding: 14, borderRadius: 14, backgroundColor: colors.pale }}>
    <Text style={ui.heading}>Gợi ý bài tập</Text>
    <Text style={[ui.body, { fontSize: 13 }]}>Dựa trên mục tiêu, trình độ, môn của lớp và lịch sử tập (kết quả, điểm danh) của học viên. Gợi ý được tạo theo quy tắc ngay trên máy.</Text>
    <Button secondary disabled={disabled || busy || !ready} title={busy ? 'Đang tạo gợi ý…' : ready ? 'Gợi ý bài tập →' : values.planTarget === 'class' ? 'Chọn lớp để gợi ý' : 'Chọn học viên để gợi ý'} onPress={() => void suggest()} />
    {!!note && <Text style={{ color: colors.green, lineHeight: 21 }}>{note}</Text>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </View>;
}
/** Past sessions (≤ today) of the member's classes, to tag a workout result with the session it belongs to. */
export function ResultSessionPicker({ token, memberId, value, onChange, disabled }: { token: string; memberId: string; value: string; onChange: (label: string) => void; disabled?: boolean }) {
  const load = useCallback(async () => {
    const [schedules, students] = await Promise.all([schedulesApi.coachMy(token), coachesApi.myStudents(token)]);
    const classIds = new Set(students.filter(row => referenceId(row.member) === memberId).map(row => referenceId(row.class)));
    const today = bangkokDate(new Date());
    return schedules.filter((item: Entity) => classIds.has(referenceId(item.classId)) && item.status !== 'CANCELLED' && dayOf(item.date) <= today)
      .sort((a: Entity, b: Entity) => `${dayOf(b.date)} ${b.startTime}`.localeCompare(`${dayOf(a.date)} ${a.startTime}`)).slice(0, 6);
  }, [token, memberId]);
  const query = useApiQuery(load, !!memberId);
  if (!memberId) return null;
  const labelOf = (item: Entity) => `Buổi ${dayOf(item.date).split('-').reverse().join('/')} ${String(item.startTime)}–${String(item.endTime)} · ${referenceLabel(item.lessonId)}`;
  return <View style={{ gap: 8 }}>
    <Text style={ui.heading}>Buổi tập (tùy chọn)</Text>
    <Text style={[ui.body, { fontSize: 13 }]}>Chọn buổi vừa dạy để kết quả ghi rõ thuộc buổi nào.</Text>
    <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {query.data?.map(item => { const label = labelOf(item); return <Chip key={entityId(item)} label={`${dayOf(item.date).slice(8, 10)}/${dayOf(item.date).slice(5, 7)} ${String(item.startTime)}`} sublabel={referenceLabel(item.lessonId).slice(0, 24)} selected={value === label} disabled={disabled} onPress={() => onChange(value === label ? '' : label)} />; })}
    </View>
    {query.data?.length === 0 && <Text style={ui.body}>Chưa có buổi đã dạy của học viên này.</Text>}
  </View>;
}
export { withSessionNote } from '@/utils/exercise-suggest';
