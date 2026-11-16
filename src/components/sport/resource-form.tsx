import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Field } from './ui';
import { RelationField } from './relation-field';
import { ui } from './styles';
import { colors } from '@/data/sport';
import { initialValues, resources, validateResource } from '@/utils/resources';
import { ApiError } from '@/services/api';
import { classesApi, coachesApi, lessonsApi, learningPathsApi, referenceId, referenceLabel, type Entity, type ResourceInput, type ResourceKey } from '@/services/operations';
import { useApiQuery } from '@/hooks/use-api-query';
import { QueryStatus } from './access';
import { loadTeachingScope } from '@/services/coach-teaching';
import { scopeTeachingResources } from '@/utils/coach-teaching';
import { assertCoachAssignment } from '@/utils/role-workflows';
import { CoachAttendanceForm } from './coach-attendance-form';
import { Redirect } from 'expo-router';
import { ClassCover } from './class-cover';
import { VideoEmbed } from './video-embed';
import { safeImageUrl } from '@/utils/image';
import { DateField, TimeField } from './date-time-fields';
import { ScheduleRepeat, defaultRepeat, plannedDates, repeatCount, type RepeatSettings } from './schedule-repeat';
import { addMinutes, cycleLessons, formatDateLabel } from '@/utils/schedule-time';
import { PlanSuggestion, PlanTargetPicker, ResultSessionPicker, withSessionNote, type PlanTarget } from './training-helpers';
type RepeatReport = { created: number; failed: { date: string; message: string }[] };
type ResourceFormProps = {
  resource: ResourceKey; initial?: Entity; token: string; userId: string; role?: string; actorId?: string; defaults?: Record<string, string>;
  onSave: (input: ResourceInput) => Promise<unknown>; onSaved: () => void;
};
export function ResourceForm(props: ResourceFormProps) {
  // New coach roll calls use /attendance (day) and /attendance/session; this form only edits a saved record.
  if (props.resource === 'attendances' && props.role === 'COACH' && !props.initial) return <Redirect href={props.defaults?.scheduleId ? { pathname: '/attendance/session', params: { scheduleId: props.defaults.scheduleId } } : '/attendance'} />;
  if (props.resource === 'attendances' && props.role === 'COACH') return <CoachAttendanceForm token={props.token} initial={props.initial} defaults={props.defaults} onSaved={props.onSaved} />;
  return <GenericResourceForm {...props} />;
}
function GenericResourceForm({ resource, initial, token, userId, role, actorId, defaults, onSave, onSaved }: ResourceFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...initialValues(resource, initial), ...defaults, ...(role === 'MEMBER' && actorId ? { memberId: actorId } : {}), ...(role === 'COACH' && resource === 'workout-plans' && actorId ? { coachId: actorId } : {}), ...(resource === 'activity-logs' ? { userId } : {}), ...(resource === 'workout-plans' ? { planTarget: initial && referenceId(initial.classId) && !referenceId(initial.memberId) ? 'class' : 'member' } : {}) }));
  const [sessionNote, setSessionNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const scopeLoad = useCallback(() => loadTeachingScope(token, actorId || ''), [token, actorId]);
  const teaching = useApiQuery(scopeLoad, role === 'COACH' && resource === 'lesson-progress');
  const [repeat, setRepeat] = useState<RepeatSettings>(defaultRepeat);
  const [report, setReport] = useState<RepeatReport | null>(null);
  const repeating = resource === 'schedules' && !initial && repeat.enabled;
  const result = validateResource(resource, values, !!initial);
  const change = (key: string, value: string) => setValues(current => {
    const next = { ...current, [key]: value };
    // Picking a start time proposes a 60-minute session unless a later end time is already set.
    if (resource === 'schedules' && key === 'startTime' && value && (!current.endTime || current.endTime <= value)) next.endTime = addMinutes(value, 60);
    return next;
  });
  // Creates one schedule per planned date; keeps going on errors (e.g. room conflicts) and reports them.
  async function saveRepeated() {
    const dates = plannedDates(values.date, repeat);
    if (!dates.length || !repeatCount(repeat)) throw new Error('Chọn ngày bắt đầu, các ngày trong tuần và số buổi (1–52).');
    const lessons = repeat.advanceLesson ? cycleLessons(await lessonsApi.byClass(token, values.classId), values.lessonId, dates.length) : dates.map(() => values.lessonId);
    const outcome: RepeatReport = { created: 0, failed: [] };
    for (const [index, date] of dates.entries()) {
      try { await onSave({ ...result.payload, date, lessonId: lessons[index] }); outcome.created++; }
      catch (e) { outcome.failed.push({ date, message: e instanceof Error ? e.message : 'Không lưu được.' }); }
    }
    if (!outcome.failed.length) { onSaved(); return; }
    setReport(outcome);
  }
  async function save() {
    if (pending.current || report) return;
    setSubmitted(true); setError('');
    if (Object.keys(result.errors).length) return;
    pending.current = true; setBusy(true);
    if (repeating) {
      try { await saveRepeated(); } catch (e) { setError(e instanceof Error ? e.message : 'Không lưu được lịch.'); }
      finally { pending.current = false; setBusy(false); }
      return;
    }
    try {
      if (role === 'COACH' && ['attendances', 'lesson-progress', 'workout-plans'].includes(resource) && (resource !== 'workout-plans' || !initial || values.memberId !== referenceId(initial.memberId) || values.classId !== referenceId(initial.classId))) {
        const [classes, students] = await Promise.all([classesApi.list(token), coachesApi.myStudents(token)]);
        assertCoachAssignment(values, actorId || '', classes, students);
        if (resource === 'lesson-progress') {
          const [lessons, paths] = await Promise.all([lessonsApi.list(token), learningPathsApi.list(token)]);
          const ownClasses = classes.filter(item => referenceId(item.coachId) === actorId);
          if (!scopeTeachingResources('lessons', lessons, ownClasses, paths).some(item => referenceId(item) === values.lessonId)) throw new Error('Chọn bài học thuộc khóa học bạn phụ trách.');
        }
      }
      await onSave(resource === 'workout-results' && !initial ? { ...result.payload, result: withSessionNote(String(result.payload.result || ''), sessionNote) } : result.payload); onSaved();
    }
    catch (e) {
      if (resource === 'coaches' && !initial && e instanceof ApiError && e.status === 404 && e.message === 'User not found') {
        setError('Không tìm thấy tài khoản đăng nhập theo User ID này. Kiểm tra lại ID của tài khoản COACH trên hệ thống đang dùng.');
      } else {
        setError(e instanceof Error ? e.message : 'Không lưu được dữ liệu.');
      }
    }
    finally { pending.current = false; setBusy(false); }
  }
  return <View style={ui.card}>{role === 'COACH' && resource === 'lesson-progress' && <QueryStatus loading={teaching.loading} error={teaching.error} retry={teaching.reload} />}{resource === 'workout-plans' && <PlanTargetPicker value={values.planTarget as PlanTarget} disabled={busy} onChange={value => setValues(current => ({ ...current, planTarget: value, memberId: value === 'class' ? '' : current.memberId, classId: value === 'member' ? '' : current.classId }))} />}{resources[resource].fields.filter(field => (!initial || !field.createOnly) && (initial || !field.updateOnly))
    // Plans target one member OR one class; members never edit the coach's comment.
    .filter(field => !(resource === 'workout-plans' && (values.planTarget === 'class' ? field.key === 'memberId' : field.key === 'classId')) && !(role === 'MEMBER' && field.key === 'coachComment')).map(field => {
    const fieldError = submitted ? result.errors[field.key] : undefined;
    const locked = role === 'MEMBER' && field.key === 'memberId' || role === 'COACH' && resource === 'workout-plans' && field.key === 'coachId' || resource === 'workout-results' && field.key === 'memberId';
    if (locked) return <View key={field.key} style={{ gap: 6 }}><Text style={ui.heading}>{field.label}</Text><Text style={ui.body}>{field.key === 'memberId' && resource === 'workout-results' ? 'Hội viên được lấy từ kế hoạch tập đã chọn.' : 'Hồ sơ của tài khoản đang đăng nhập.'}</Text>{!!fieldError && <Text style={ui.error}>{fieldError}</Text>}</View>;
    if (field.relation) return <RelationField key={field.key} label={field.label} path={role === 'COACH' && field.key === 'memberId' ? '/api/coaches/my-students' : field.relation} transformItems={role === 'COACH' && field.key === 'memberId' ? rows => { const students = rows.filter(row => !values.classId || referenceId(row.class) === values.classId).map(row => row.member).filter((item): item is Entity => !!item && typeof item === 'object'); return students.filter((item, index) => students.findIndex(other => referenceId(other) === referenceId(item)) === index); } : undefined} token={token} value={values[field.key]} initialLabel={initial?.[field.key] && typeof initial[field.key] === 'object' ? referenceLabel(initial[field.key]) : undefined} onChange={value => change(field.key, value)} disabled={busy || role === 'COACH' && field.key === 'lessonId' && !teaching.data} error={fieldError} optional={!field.required} filter={role === 'COACH' && field.key === 'lessonId' ? item => !!teaching.data && scopeTeachingResources('lessons', [item], teaching.data.classes, teaching.data.paths).length > 0 : role === 'COACH' && field.key === 'classId' ? item => referenceId(item.coachId) === actorId : field.key === 'roomId' ? item => item.status === 'ACTIVE' || referenceId(item) === values.roomId : field.key === 'workoutPlanId' ? item => !!referenceId(item.memberId) && (role === 'MEMBER' ? referenceId(item.memberId) === actorId : role === 'COACH' ? referenceId(item.coachId) === actorId : true) : undefined} onSelect={field.key === 'workoutPlanId' ? item => change('memberId', referenceId(item.memberId)) : resource === 'lesson-progress' && field.key === 'lessonId' ? item => setValues(current => ({ ...current, classId: referenceId(item.classId), memberId: role === 'MEMBER' ? current.memberId : '' })) : undefined} />;
    if (field.options) return <View key={field.key} style={{ gap: 8 }}><Text style={ui.heading}>{field.label}</Text><View style={{ gap: 8 }}>{field.options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: values[field.key] === option.value, disabled: busy }} disabled={busy} onPress={() => change(field.key, option.value)} style={{ padding: 13, minHeight: 46, borderRadius: 10, backgroundColor: values[field.key] === option.value ? colors.pale : colors.background }}><Text style={ui.body}>{values[field.key] === option.value ? '●' : '○'} {option.label}</Text></Pressable>)}</View>{!!fieldError && <Text style={ui.error}>{fieldError}</Text>}</View>;
    if (field.type === 'date') return <DateField key={field.key} label={field.label} value={values[field.key]} onChange={value => change(field.key, value)} error={fieldError} disabled={busy || !!report} />;
    if (field.type === 'time') return <TimeField key={field.key} label={field.label} value={values[field.key]} onChange={value => change(field.key, value)} error={fieldError} disabled={busy || !!report} from={field.key === 'endTime' ? values.startTime : undefined} />;
    if (field.type === 'url') return <View key={field.key} style={{ gap: 8 }}>
      <Field label={field.label} value={values[field.key]} onChangeText={value => change(field.key, value)} editable={!busy} error={fieldError} autoCapitalize="none" keyboardType="url" placeholder="https://…" />
      {field.key === 'imageUrl' && !!safeImageUrl(values.imageUrl) && <ClassCover imageUrl={values.imageUrl} subject="" style={{ height: 150, borderRadius: 12 }} />}
      {field.key === 'videoUrl' && !!values.videoUrl && !fieldError && <VideoEmbed url={values.videoUrl} />}
    </View>;
    return <Field key={field.key} label={field.label} value={values[field.key]} onChangeText={value => change(field.key, value)} editable={!busy} error={fieldError} multiline={field.type === 'multiline'} autoCapitalize={field.type === 'id' ? 'none' : 'sentences'} keyboardType={field.type === 'money' ? 'decimal-pad' : field.type === 'number' ? 'number-pad' : field.type === 'phone' ? 'phone-pad' : 'default'} />;
  })}
    {resource === 'workout-plans' && role === 'COACH' && <PlanSuggestion token={token} values={values} disabled={busy} onApply={patch => setValues(current => ({ ...current, ...patch }))} />}
    {resource === 'workout-results' && !initial && role === 'COACH' && <ResultSessionPicker token={token} memberId={values.memberId} value={sessionNote} onChange={setSessionNote} disabled={busy} />}
    {resource === 'workout-results' && !initial && <Text style={[ui.body, { fontSize: 12 }]}>Chỉ chọn được kế hoạch cá nhân: kết quả tập luôn ghi cho một học viên.</Text>}
    {resource === 'schedules' && !initial && <ScheduleRepeat date={values.date} value={repeat} onChange={setRepeat} disabled={busy || !!report} />}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {report ? <View style={{ gap: 8 }}>
      <Text accessibilityRole="alert" style={{ color: report.created ? '#15803d' : '#b91c1c', fontWeight: '700' }}>Đã tạo {report.created}/{report.created + report.failed.length} buổi.</Text>
      {report.failed.map(item => <Text key={item.date} style={ui.error}>{formatDateLabel(item.date)}: {item.message}</Text>)}
      <Text style={[ui.body, { fontSize: 13 }]}>Các buổi lỗi chưa được tạo. Sửa lại (ví dụ đổi phòng hoặc giờ) rồi thêm riêng từng buổi.</Text>
      <Button title="Về danh sách lịch" onPress={onSaved} />
    </View> : <Button disabled={busy} title={busy ? 'Đang lưu…' : repeating ? `Tạo ${plannedDates(values.date, repeat).length} buổi` : 'Lưu thông tin'} onPress={save} />}
  </View>;
}
