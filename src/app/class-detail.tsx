import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useActorProfile } from '@/hooks/use-actor-profile';
import { useApiQuery } from '@/hooks/use-api-query';
import { entityId, type Entity } from '@/services/operations';
import { currency } from '@/services/payments';
import { buildCatalog, loadCatalog, timelineLabel } from '@/utils/class-catalog';
import { dayOf } from '@/utils/coach-teaching';
import { dayMonth, shortWeekday } from '@/utils/schedule-time';
import { videoEmbed } from '@/utils/video';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { ClassCover } from '@/components/sport/class-cover';
import { VideoEmbed } from '@/components/sport/video-embed';
import { Button, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';

const LESSONS_SHOWN = 6;

/** Class landing page: what you learn, when, with whom, for how much, and one clear action. */
export default function ClassDetail() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const { user, token } = useAuth();
  const member = user?.role === 'MEMBER';
  const actor = useActorProfile(member);
  const memberId = actor.data ? entityId(actor.data) : '';
  const load = useCallback(() => loadCatalog(token!), [token]);
  const query = useApiQuery(load, !!token);
  const [now] = useState(() => Date.now());
  const [openLesson, setOpenLesson] = useState('');
  const [allLessons, setAllLessons] = useState(false);
  // Staff see the class without anyone's registration attached.
  const entry = useMemo(() => (query.data ? buildCatalog({ ...query.data, classes: query.data.classes.filter(item => entityId(item) === id) }, { memberId: member ? memberId : '__staff__', now })[0] || null : null), [query.data, id, member, memberId, now]);
  if (!user || !token) return <AccessScreen />;

  const canEnroll = ['MEMBER', 'RECEPTIONIST', 'CENTER_MANAGER'].includes(user.role);
  const playing: Entity | null = entry ? entry.lessons.find(lesson => entityId(lesson) === openLesson) || entry.previewLesson : null;
  const cta = !entry ? null
    : member && entry.enrolled ? { label: 'Xem lịch học của tôi', go: () => router.push({ pathname: '/registration-detail', params: { id: entityId(entry.registration!) } }) }
      : member && entry.pending ? { label: 'Tiếp tục thanh toán', go: () => router.push({ pathname: '/payment-edit', params: { registrationId: entityId(entry.registration!) } }) }
        : canEnroll ? { label: member ? 'Đăng ký lớp này' : 'Đăng ký cho hội viên', go: () => router.push({ pathname: '/enroll', params: { classId: entry.id } }) }
          : null;

  return <Screen>
    {member ? <Link href="/explore" style={ui.link}>← Khám phá lớp học</Link> : <Link href={{ pathname: '/workspace/[resource]', params: { resource: 'classes' } }} style={ui.link}>← Lớp học</Link>}
    <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />
    {query.data && !entry && <View style={ui.card}><Text style={ui.heading}>Không tìm thấy lớp học</Text><Text style={ui.body}>Lớp có thể đã đóng hoặc bị xóa.</Text></View>}
    {entry && <>
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        <ClassCover imageUrl={entry.imageUrl} subject={entry.subjectName} style={{ height: 190 }} />
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#ffffffeb', borderRadius: 14, padding: 12, gap: 4 }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>{entry.subjectName} · {entry.courseName}</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>{entry.name}</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>{[timelineLabel(entry), entry.sessions.length ? `${entry.sessions.length} buổi` : '', entry.lessons.length ? `${entry.lessons.length} bài học` : '', entry.enrolled ? '✓ Bạn đã đăng ký' : ''].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>

      <View style={ui.card}>
        <View style={ui.row}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '800' }}>{entry.coachName.split(/\s+/).slice(-2).map(part => part[0] || '').join('').toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.ink, fontSize: 15 }}>{entry.coachName}</Text><Text style={{ fontSize: 12, color: colors.muted }}>Huấn luyện viên {entry.subjectName.toLowerCase()}</Text></View>
        </View>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.ink }}>{typeof entry.price === 'number' ? currency(entry.price) : 'Liên hệ'}</Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>{entry.sessions.length ? `Trọn khóa ${entry.sessions.length} buổi${entry.perSession ? ` · ≈ ${currency(entry.perSession)}/buổi` : ''}` : 'Học phí trọn khóa'}</Text>
        {cta && <Button title={cta.label} onPress={cta.go} />}
        {!member && <Button secondary title="Xem toàn bộ lịch lớp" onPress={() => router.push({ pathname: '/workspace/[resource]', params: { resource: 'schedules', classId: entry.id } })} />}
        <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 21 }}>✓ Thanh toán online qua payOS, xác nhận ngay{'\n'}✓ Điểm danh và nhận xét của HLV sau mỗi buổi{'\n'}✓ Kế hoạch tập theo mục tiêu của bạn</Text>
      </View>

      {playing && videoEmbed(playing.videoUrl) && <View style={ui.card}>
        <Text style={ui.heading}>Bài mẫu · {String(playing.title || '')}</Text>
        <VideoEmbed url={playing.videoUrl} />
      </View>}

      <View style={ui.card}>
        <Text style={ui.heading}>Giới thiệu khóa học</Text>
        <Text style={ui.body}>{entry.description || `Khóa ${entry.courseName} do ${entry.coachLabel} phụ trách. Lộ trình được thiết kế theo từng bài, mỗi buổi có điểm danh và nhận xét để bạn theo dõi tiến bộ.`}</Text>
      </View>

      <View style={ui.card}>
        <Text style={ui.heading}>Bạn sẽ học được gì</Text>
        {entry.lessons.length ? (allLessons ? entry.lessons : entry.lessons.slice(0, LESSONS_SHOWN)).map(lesson => {
          const lessonId = entityId(lesson);
          const active = playing && entityId(playing) === lessonId;
          return <View key={lessonId} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>{String(lesson.order)}</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>{String(lesson.title || '')}</Text>
              {!!lesson.description && <Text numberOfLines={2} style={{ fontSize: 12.5, color: colors.muted }}>{String(lesson.description)}</Text>}
            </View>
            {!!videoEmbed(lesson.videoUrl) && <Pressable accessibilityRole="button" onPress={() => setOpenLesson(lessonId)} style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : '#fff' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.primary }}>▶ Video</Text>
            </Pressable>}
          </View>;
        }) : <Text style={ui.body}>Lộ trình bài học đang được cập nhật.</Text>}
        {entry.lessons.length > LESSONS_SHOWN && <Pressable onPress={() => setAllLessons(value => !value)}><Text style={ui.link}>{allLessons ? 'Thu gọn' : `Xem thêm ${entry.lessons.length - LESSONS_SHOWN} bài`}</Text></Pressable>}
      </View>

      <View style={ui.card}>
        <Text style={ui.heading}>Lịch học sắp tới</Text>
        {entry.weekdayLabel ? <Text style={{ fontSize: 13, color: colors.muted }}>{entry.weekdayLabel}{entry.timeRange ? ` · ${entry.timeRange}` : ''}</Text> : null}
        {entry.upcoming.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {entry.upcoming.slice(0, 6).map(session => <View key={entityId(session)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#fffaf5', borderWidth: 1, borderColor: '#f0dfcf' }}>
            <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 13 }}>{shortWeekday(dayOf(session.date))} {dayMonth(dayOf(session.date))}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>{String(session.startTime)}–{String(session.endTime)}</Text>
          </View>)}
          {entry.upcoming.length > 6 && <Text style={{ alignSelf: 'center', color: colors.primary, fontWeight: '700' }}>+{entry.upcoming.length - 6} buổi</Text>}
        </View> : <Text style={ui.body}>{entry.finished ? 'Lớp đã học xong các buổi đã xếp.' : 'Trung tâm đang xếp lịch cho lớp này.'}</Text>}
      </View>
    </>}
  </Screen>;
}
