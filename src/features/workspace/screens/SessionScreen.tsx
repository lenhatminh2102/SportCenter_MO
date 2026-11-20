import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { attendancesApi, entityId, lessonProgressApi, lessonsApi, referenceId, referenceLabel, schedulesApi, type Entity } from '@/services/operations';
import { dayOf } from '@/utils/coach-teaching';
import { at } from '@/utils/attendance-day';
import { formatDateLabel } from '@/utils/schedule-time';
import { statusLabels } from '@/utils/resource-display';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { VideoEmbed } from '@/components/sport/video-embed';
import { Button, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';

function timing(schedule: Entity, now: number) {
  if (schedule.status === 'CANCELLED') return { tone: '#b91c1c', bg: '#fdeceb', text: 'Buổi học đã bị hủy', finished: false };
  const day = dayOf(schedule.date);
  const start = at(day, String(schedule.startTime));
  const end = at(day, String(schedule.endTime));
  if (now >= end) return { tone: colors.green, bg: '#e7f6ec', text: 'Buổi học đã diễn ra', finished: true };
  if (now >= start) return { tone: colors.primary, bg: colors.pale, text: `Đang diễn ra · còn ${Math.ceil((end - now) / 60000)} phút`, finished: false };
  const minutes = Math.ceil((start - now) / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return { tone: '#2f66a8', bg: '#eef4fc', text: `Còn ${days ? `${days} ngày ` : ''}${hours ? `${hours} giờ ` : ''}${days ? '' : `${minutes % 60} phút `}nữa bắt đầu`, finished: false };
}

const object = (value: unknown) => (value && typeof value === 'object' ? value as Entity : null);

/**
 * The schedule list may not carry the lesson's video (the team backend populates only title,
 * description and order). Fill it in from the class's lessons; on failure keep the schedule as is.
 */
async function withLessonVideo(token: string, schedule: Entity): Promise<Entity> {
  const lesson = object(schedule.lessonId);
  if (lesson?.videoUrl) return schedule;
  const classId = referenceId(schedule.classId);
  const lessonId = referenceId(schedule.lessonId);
  if (!classId || !lessonId) return schedule;
  const full = await lessonsApi.byClass(token, classId)
    .then(items => (Array.isArray(items) ? items.find(item => entityId(item) === lessonId) : undefined))
    .catch(() => undefined);
  if (!full?.videoUrl) return schedule;
  return { ...schedule, lessonId: { ...(lesson || {}), ...full, videoUrl: full.videoUrl } };
}

/** Session ("buổi tập") detail: schedule info, today's lesson with its guide video, and the member's own result. */
export default function SessionDetail() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const { user, token } = useAuth();
  const member = user?.role === 'MEMBER';
  const [now] = useState(() => Date.now());
  const load = useCallback(async () => {
    const schedules = await (member ? schedulesApi.my(token!) : user?.role === 'COACH' ? schedulesApi.coachMy(token!) : schedulesApi.list(token!));
    const found = schedules.find(item => entityId(item) === id) || null;
    const schedule = found && await withLessonVideo(token!, found);
    if (!schedule || !member) return { schedule, attendance: null, progress: null };
    const lessonId = referenceId(schedule.lessonId);
    const [attendance, progress] = await Promise.all([
      attendancesApi.my(token!).then(items => items.find(item => referenceId(item.lessonId) === lessonId && dayOf(item.date) === dayOf(schedule.date)) || null).catch(() => null),
      lessonProgressApi.list(token!).then(items => items.find(item => referenceId(item.lessonId) === lessonId) || null).catch(() => null),
    ]);
    return { schedule, attendance, progress };
  }, [token, id, member, user?.role]);
  const query = useApiQuery(load, !!token && !!id);
  if (!user || !token) return <AccessScreen />;

  const schedule = query.data?.schedule;
  const lesson = object(schedule?.lessonId);
  const classInfo = object(schedule?.classId);
  const room = object(schedule?.roomId);
  const when = schedule ? timing(schedule, now) : null;
  const attendance = query.data?.attendance;
  const progress = query.data?.progress;
  const day = schedule ? dayOf(schedule.date) : '';

  return <Screen>
    <Text style={ui.link} onPress={() => router.back()}>← Quay lại</Text>
    <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />
    {query.data && !schedule && <View style={ui.card}><Text style={ui.heading}>Không tìm thấy buổi tập</Text><Text style={ui.body}>{member ? 'Buổi này không thuộc lớp bạn đã đăng ký và thanh toán.' : 'Buổi tập có thể đã bị xóa.'}</Text></View>}
    {schedule && when && <>
      <View style={{ gap: 4 }}>
        <Text style={ui.eyebrow}>BUỔI TẬP</Text>
        <Text style={[ui.title, { fontSize: 26 }]}>{classInfo ? String(classInfo.name || '') : referenceLabel(schedule.classId)}</Text>
        <Text style={ui.body}>{formatDateLabel(day)} · {String(schedule.startTime)}–{String(schedule.endTime)}</Text>
      </View>
      <View style={{ backgroundColor: when.bg, borderRadius: 12, padding: 12 }}><Text style={{ color: when.tone, fontWeight: '800' }}>{when.text}</Text></View>

      <View style={ui.card}>
        <Text style={ui.heading}>{lesson ? `Bài ${String(lesson.order)}: ${String(lesson.title || '')}` : 'Bài học của buổi'}</Text>
        <VideoEmbed url={lesson?.videoUrl} fallback={<View style={{ aspectRatio: 16 / 9, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', padding: 16 }}><Text style={[ui.body, { textAlign: 'center' }]}>Huấn luyện viên chưa thêm video cho bài này.</Text></View>} />
        {!!lesson?.videoUrl && <Text style={[ui.body, { fontSize: 13 }]}>{when.finished ? 'Xem lại động tác của buổi để tự luyện ở nhà.' : 'Xem trước động tác để buổi tập hiệu quả hơn.'}</Text>}
        <Text style={[ui.heading, { fontSize: 15 }]}>Nội dung bài học</Text>
        <Text style={ui.body}>{String(lesson?.description || 'Chưa có mô tả cho bài học này.')}</Text>
      </View>

      <View style={ui.card}>
        <Text style={ui.heading}>Thông tin buổi</Text>
        {[
          ['Ngày', formatDateLabel(day)],
          ['Giờ', `${String(schedule.startTime)} – ${String(schedule.endTime)}`],
          ['Phòng tập', room ? `${String(room.name || '')}${room.roomNumber ? ` · ${String(room.roomNumber)}` : ''}` : referenceLabel(schedule.roomId)],
          ['Huấn luyện viên', classInfo?.coachId ? referenceLabel(classInfo.coachId) : '—'],
          ['Môn', classInfo?.subjectId ? referenceLabel(classInfo.subjectId) : '—'],
          ['Trạng thái', statusLabels[String(schedule.status)] || String(schedule.status || '')],
        ].map(([label, value]) => <View key={label} style={ui.between}><Text style={ui.body}>{label}</Text><Text style={{ color: colors.ink, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{value}</Text></View>)}
      </View>

      {member && <View style={ui.card}>
        <Text style={ui.heading}>Kết quả của bạn</Text>
        <Text style={ui.body}>{attendance ? `Điểm danh: ${attendance.status === 'PRESENT' ? '✓ Có mặt' : '✗ Vắng'}` : when.finished ? 'Chưa có điểm danh cho buổi này.' : 'Điểm danh sẽ có sau buổi học.'}</Text>
        {progress && <Text style={ui.body}>Tiến độ bài: {statusLabels[String(progress.status)] || String(progress.status || '')}</Text>}
        {!!progress?.coachComment && <View style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, backgroundColor: '#fff6ee', padding: 12 }}><Text style={{ color: colors.muted, lineHeight: 21 }}><Text style={{ fontWeight: '800', color: colors.ink }}>Nhận xét của HLV: </Text>{String(progress.coachComment)}</Text></View>}
        <Button secondary title="Hỏi trung tâm về buổi này" onPress={() => router.push({ pathname: '/support', params: { topic: `Buổi ${day} ${String(schedule.startTime)} – ${classInfo ? String(classInfo.name || '') : ''}` } })} />
      </View>}
      {user.role === 'COACH' && schedule.status === 'SCHEDULED' && <Button title="Điểm danh buổi này" onPress={() => router.push({ pathname: '/attendance/session', params: { scheduleId: id } })} />}
    </>}
  </Screen>;
}
