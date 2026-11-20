import { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useMemberShell } from '@/context/member-shell';
import { useStaffShell } from '@/context/staff-shell';
import { roleHome } from '@/utils/staff-navigation';
import { useAuth } from '@/context/auth';
import { titleFor, detailFor } from '@/utils/resource-display';
import { entityId, referenceId, resourceApis, attendancesApi, schedulesApi, coachesApi, classesApi, type ResourceKey } from '@/services/operations';
import { resources, isResource } from '@/utils/resources';
import { canUseResource, isOwnRecord, personalResources } from '@/utils/resource-access';
import { teachingResources, scopeTeachingResources, dayOf } from '@/utils/coach-teaching';
import { bangkokDate } from '@/services/dashboard';
import { loadTeachingScope } from '@/services/coach-teaching';
import { canReadResource, scopeCoachRecords } from '@/utils/role-workflows';
import { useActorProfile } from '@/hooks/use-actor-profile';
import { useApiQuery } from '@/hooks/use-api-query';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button, Field, Screen } from '@/components/sport/ui';
import { DeleteResource } from '@/components/sport/delete-resource';
import { ui } from '@/components/sport/styles';
import { SubjectFilter } from '@/components/sport/subject-filter';
import { ActivityHistory } from '@/components/sport/activity-history';
import { loadSubjectIndex, SUBJECT_RESOURCES, subjectCounts, subjectOf, subjectTone, wantedSubject } from '@/utils/subject-filter';
function ResourceList({ resource, courseId, classId, date, initialSubject = '' }: { resource: ResourceKey; courseId?: string; classId?: string; date?: string; initialSubject?: string }) {
  const { user, token } = useAuth(); const inStaffShell = useStaffShell(); const memberShell = useMemberShell();
  const userRole = user?.role;
  const definition = resources[resource]; const api = resourceApis[resource];
  const needsActor = user?.role === 'MEMBER' && personalResources.includes(resource) || user?.role === 'COACH' && ['classes', 'schedules', 'attendances', 'lesson-progress', 'workout-plans', 'workout-results', ...teachingResources].includes(resource);
  const actor = useActorProfile(needsActor); const actorId = actor.data ? entityId(actor.data) : '';
  const [search, setSearch] = useState(''); const [allSchedules, setAllSchedules] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const bySubject = SUBJECT_RESOURCES.includes(resource);
  const loadIndex = useCallback(() => loadSubjectIndex(token!), [token]);
  const subjectIndex = useApiQuery(loadIndex, bySubject && !!token).data;
  const mine = resource === 'schedules' && user?.role === 'MEMBER' && !classId && !allSchedules;
  const load = useCallback(async () => {
    if (!token || !userRole) throw new Error('Phiên đăng nhập đã kết thúc.');
    const records = await (resource === 'attendances' && userRole === 'MEMBER' ? attendancesApi.my(token) : mine ? schedulesApi.my(token!) : resource === 'schedules' && userRole === 'COACH' ? schedulesApi.coachMy(token!) : resourceApis[resource].list(token!));
    if (!Array.isArray(records)) throw new Error('Danh sách từ máy chủ không hợp lệ.');
    const filtered = records.filter(item => (!courseId || resource !== 'classes' || referenceId(item.courseId) === courseId) && (!classId || resource !== 'schedules' || referenceId(item.classId) === classId) && (!date || resource !== 'schedules' || dayOf(item.date) === date));
    if (userRole === 'COACH' && teachingResources.includes(resource)) { const scope = await loadTeachingScope(token, actorId); return scopeTeachingResources(resource, filtered, scope.classes, scope.paths); }
    if (userRole === 'COACH' && ['attendances', 'lesson-progress'].includes(resource)) {
      const [classes, students] = await Promise.all([classesApi.list(token!), coachesApi.myStudents(token!)]);
      return scopeCoachRecords(resource, filtered, classes.filter(item => referenceId(item.coachId) === actorId), students);
    }
    return needsActor ? filtered.filter(item => isOwnRecord(resource, userRole, actorId, item)) : filtered;
  }, [resource, token, mine, needsActor, actorId, userRole, courseId, classId, date]);
  const query = useApiQuery(load, !!token && canReadResource(resource, user?.role) && (!needsActor || !!actorId), false); const { reload } = query;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const subjectOptions = useMemo(() => (bySubject && subjectIndex ? subjectCounts(resource, query.data || [], subjectIndex) : []), [bySubject, subjectIndex, resource, query.data]);
  // A member's own timetable reads best one sport at a time: group it when no sport is picked.
  const grouped = mine && !subject && subjectOptions.filter(option => option.id).length > 1;
  const subjectIds = subjectOptions.map(option => option.id);
  const items = useMemo(() => {
    const rows = (query.data || []).filter(item => `${titleFor(resource, item)} ${detailFor(resource, item)}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))
      && (!subject || !subjectIndex || subjectOf(resource, item, subjectIndex) === wantedSubject(subject)));
    if (!grouped) return rows;
    const rank = (item: typeof rows[number]) => subjectIds.indexOf(subjectOf(resource, item, subjectIndex));
    return rows.map((item, order) => ({ item, order })).sort((a, b) => rank(a.item) - rank(b.item) || a.order - b.order).map(entry => entry.item);
  }, [query.data, resource, search, subject, subjectIndex, grouped, subjectIds]);
  if (!user || !token) return <AccessScreen />;
  if (!canReadResource(resource, user.role)) return <AccessScreen denied />;
  const canEnroll = ['MEMBER', 'RECEPTIONIST', 'CENTER_MANAGER'].includes(user.role);
  const canCreate = resource === 'class-registrations' ? canEnroll : canUseResource(resource, user.role, 'create', undefined, actorId);
  const create = () => resource === 'class-registrations' ? router.push('/enroll') : router.push({ pathname: '/workspace/[resource]/edit', params: { resource } });
  return <SafeAreaView edges={inStaffShell ? ['left', 'right'] : memberShell ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']} style={ui.page}><FlatList contentContainerStyle={ui.content} data={items} keyExtractor={entityId} refreshing={query.loading} onRefresh={reload} keyboardShouldPersistTaps="handled"
    ListHeaderComponent={<View style={{ gap: 16, marginBottom: 20 }}>
      <Link href={roleHome(user.role)} style={ui.link}>← Trang chủ</Link>
      <Text style={ui.title}>{date && resource === 'schedules' ? `Lịch ngày ${date}` : classId && resource === 'schedules' ? 'Lịch của lớp' : mine ? 'Lịch tập của tôi' : user.role === 'COACH' && resource === 'schedules' ? 'Lịch dạy của tôi' : user.role === 'COACH' && resource === 'classes' ? 'Lớp của tôi' : resource === 'class-registrations' && user.role === 'MEMBER' ? 'Đăng ký của tôi' : definition.title}</Text>
      <Text style={ui.eyebrow}>{query.data ? `${items.length} KẾT QUẢ` : 'DỮ LIỆU TRUNG TÂM'}</Text>
      {resource === 'schedules' && !classId && user.role === 'MEMBER' && <Button secondary title={mine ? 'Khám phá lịch các lớp' : 'Về lịch tập của tôi'} onPress={() => setAllSchedules(value => !value)} />}
      {resource === 'schedules' && user.role === 'CENTER_MANAGER' && <Button secondary title="Import lịch từ Excel" onPress={() => router.push('/schedule-import')} />}{['courses', 'learning-paths', 'classes', 'lessons'].includes(resource) && user.role === 'CENTER_MANAGER' && <Button secondary title="Import khóa học · lớp · bài học từ Excel" onPress={() => router.push('/catalog-import')} />}{resource === 'coaches' && user.role === 'CENTER_MANAGER' && <Button title="+ Tạo tài khoản HLV mới" onPress={() => router.push({ pathname: '/staff-accounts', params: { create: '1' } })} />}{canCreate &&<Button title={resource === 'class-registrations' ? '+ Bắt đầu đăng ký lớp' : `+ Thêm ${definition.singular}`} onPress={create} />}
      <Field label="Tìm kiếm" value={search} onChangeText={setSearch} placeholder={`Tìm ${definition.singular}`} />
      <SubjectFilter options={subjectOptions} value={subject} onChange={setSubject} total={(query.data || []).length} />
      <QueryStatus loading={needsActor && actor.loading} error={needsActor ? actor.error : null} retry={actor.reload} />
      {needsActor && actor.error && user.role === 'MEMBER' && <Link href="/profile" style={ui.link}>Tạo hồ sơ hội viên →</Link>}
      <QueryStatus loading={query.loading} error={query.error} retry={reload} />
      {mine && query.missing && <Link href="/profile" style={ui.link}>Tạo hồ sơ hội viên để xem lịch →</Link>}
    </View>}
    ListEmptyComponent={!query.loading && !query.error && !actor.loading && !actor.error ? <View style={ui.card}><Text style={ui.body}>{search ? 'Không có kết quả phù hợp.' : mine ? 'Bạn chưa có lịch từ lớp đã xác nhận. Hoàn tất đăng ký và thanh toán trước.' : 'Chưa có dữ liệu.'}</Text>{user.role === 'MEMBER' && ['schedules', 'class-registrations'].includes(resource) && <Button title="Khám phá và đăng ký lớp →" onPress={() => router.push('/enroll')} />}</View> : undefined}
    ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
    renderItem={({ item, index }) => {
      const sport = grouped ? subjectOf(resource, item, subjectIndex) : '';
      const header = grouped && (index === 0 || subjectOf(resource, items[index - 1], subjectIndex) !== sport);
      const option = subjectOptions.find(entry => entry.id === sport);
      return <View style={{ gap: 10 }}>{header && option && <View style={[ui.between, { marginTop: index ? 10 : 0 }]}>
        <View style={ui.row}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: subjectTone(sport, subjectIds) }} /><Text style={ui.heading}>{option.name}</Text><Text style={ui.body}>{option.count} buổi</Text></View>
        <Text style={ui.link} onPress={() => setSubject(sport || '-')}>Chỉ xem môn này</Text>
      </View>}<View style={ui.card}>
      <Text style={ui.heading}>{titleFor(resource, item)}</Text><Text style={ui.body}>{detailFor(resource, item)}</Text>
      {resource === 'classes' && <Button secondary title="Chi tiết lớp học" onPress={() => router.push({ pathname: '/class-detail', params: { id: entityId(item) } })} />}
      {resource === 'classes' && user.role === 'COACH' && <Button secondary title="Lịch dạy hôm nay →" onPress={() => router.push({ pathname: '/workspace/[resource]', params: { resource: 'schedules', classId: entityId(item), date: bangkokDate(new Date()) } })} />}{resource === 'classes' && user.role === 'COACH' && <Button secondary title="Xem học viên đăng ký lớp →" onPress={() => router.push({ pathname: '/coach-students', params: { classId: entityId(item) } })} />}{resource === 'classes' && canEnroll && <Button title="Chọn lớp và xem lịch →" onPress={() => router.push({ pathname: '/enroll', params: { classId: entityId(item) } })} />}
      {resource === 'schedules' && <Button secondary={user.role !== 'MEMBER'} title="Chi tiết buổi" onPress={() => router.push({ pathname: '/session', params: { id: entityId(item) } })} />}
      {resource === 'schedules' && item.status === 'SCHEDULED' && ['COACH', 'RECEPTIONIST', 'CENTER_MANAGER'].includes(user.role) && <Button secondary title="Điểm danh buổi này →" onPress={() => (user.role === 'COACH' ? router.push({ pathname: '/attendance/session', params: { scheduleId: entityId(item) } }) : router.push({ pathname: '/workspace/[resource]/edit', params: { resource: 'attendances', scheduleId: entityId(item), classId: referenceId(item.classId), lessonId: referenceId(item.lessonId), date: String(item.date).slice(0, 10) } }))} />}
      {resource === 'class-registrations' && <><Button secondary title={item.status === 'CONFIRMED' ? 'Xem đăng ký và lịch học →' : 'Chi tiết đăng ký →'} onPress={() => router.push({ pathname: '/registration-detail', params: { id: entityId(item) } })} />{item.status === 'PENDING_PAYMENT' && canEnroll && <Button title="Tiếp tục thanh toán →" onPress={() => router.push({ pathname: '/payment-edit', params: { registrationId: entityId(item) } })} />}</>}
      {resource !== 'class-registrations' && canUseResource(resource, user.role, 'update', item, actorId) && 'update' in api && <Button secondary title="Chỉnh sửa" onPress={() => router.push({ pathname: '/workspace/[resource]/edit', params: { resource, id: entityId(item) } })} />}
      {canUseResource(resource, user.role, 'remove', item, actorId) && 'remove' in api && <DeleteResource title={titleFor(resource, item)} onDelete={() => api.remove(token, entityId(item))} onDeleted={reload} />}
    </View></View>;
    }}
  /></SafeAreaView>;
}
export default function ResourceRoute() {
  const { resource, courseId, classId, date, subject } = useLocalSearchParams<{ resource?: string; courseId?: string; classId?: string; date?: string; subject?: string }>();
  const { user, token } = useAuth();
  if (!isResource(resource)) return <Screen><Text style={ui.title}>Không tìm thấy chức năng</Text><Link href="/operations" style={ui.link}>Quay lại</Link></Screen>;
  // Members browse classes in the storefront, not the plain list.
  if (resource === 'classes' && user?.role === 'MEMBER' && !courseId) return <Redirect href="/explore" />;
  // The manager reads the log as a filtered timeline, like the web app.
  if (resource === 'activity-logs' && user?.role === 'CENTER_MANAGER' && token) return <ActivityHistory token={token} />;
  return <ResourceList key={`${resource}:${classId || ''}:${courseId || ''}:${date || ''}`} resource={resource} courseId={courseId} classId={classId} date={date} initialSubject={subject} />;
}
