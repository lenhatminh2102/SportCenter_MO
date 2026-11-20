import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { useActorProfile } from '@/hooks/use-actor-profile';
import { canManagePayments, currency, isVoidedPayment, matchesPayment, ownPayments, paymentMethods, paymentsApi, paymentSummary, registrationFor } from '@/services/payments';
import { classRegistrationsApi, entityId, referenceLabel, type Entity } from '@/services/operations';
import { ListPage } from '@/components/sport/list-page';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button, Field } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { SubjectFilter } from '@/components/sport/subject-filter';
import { loadSubjectIndex, subjectCounts, subjectOf, wantedSubject } from '@/utils/subject-filter';
import { colors } from '@/data/sport';

const FILTERS = [['ALL', 'Tất cả'], ['PENDING', 'Chờ thanh toán'], ['SUCCESS', 'Thành công'], ['FAILED', 'Thất bại']] as const;
const methodLabel = (value: unknown) => paymentMethods.find(method => method.value === value)?.label || String(value || '');

export default function Payments() {
  const { user, token } = useAuth(); const member = user?.role === 'MEMBER'; const actor = useActorProfile(member); const actorId = actor.data ? entityId(actor.data) : '';
  const [filter, setFilter] = useState<typeof FILTERS[number][0]>('ALL'); const [subject, setSubject] = useState(''); const [search, setSearch] = useState('');
  const loadIndex = useCallback(() => loadSubjectIndex(token!), [token]);
  const subjectIndex = useApiQuery(loadIndex, !!token).data;
  const load = useCallback(async () => { const [items, registrations] = await Promise.all([paymentsApi.list(token!), classRegistrationsApi.list(token!)]); return { items: member ? ownPayments(items, registrations, actorId) : items, registrations }; }, [token, member, actorId]);
  const query = useApiQuery(load, !!token && canManagePayments(user?.role) && (!member || !!actorId), false);
  const { reload } = query;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!user || !token) return <AccessScreen />;
  if (!canManagePayments(user.role)) return <AccessScreen denied />;
  const all = query.data?.items || []; const registrations = query.data?.registrations || [];
  // A payment belongs to the sport of the class it pays for.
  const sportOf = (item: Entity) => subjectOf('class-registrations', registrationFor(item, registrations), subjectIndex);
  const subjectOptions = subjectIndex ? subjectCounts('payments', all.map(item => ({ _id: entityId(item), classId: registrationFor(item, registrations)?.classId || null })), subjectIndex) : [];
  const summary = paymentSummary(all, registrations);
  const rows = all.filter(item => {
    const registration = registrationFor(item, registrations);
    return (filter === 'ALL' || item.status === filter)
      && (!subject || !subjectIndex || sportOf(item) === wantedSubject(subject))
      && matchesPayment(search, referenceLabel(registration?.classId), member ? '' : referenceLabel(registration?.memberId), methodLabel(item.paymentMethod), item.amount);
  });
  const stat = (label: string, value: string, color: string = colors.ink) => <View key={label} style={[ui.card, { flexBasis: '47%', flexGrow: 1, padding: 12, gap: 2 }]}>
    <Text style={[ui.body, { fontSize: 12 }]}>{label}</Text>
    <Text adjustsFontSizeToFit numberOfLines={1} style={{ color, fontSize: 18, fontWeight: '800' }}>{query.data ? value : '—'}</Text>
  </View>;

  return <ListPage title={member ? 'Thanh toán của tôi' : 'Quản lý thanh toán'} description="Học phí tính theo lớp học. Trạng thái chỉ cập nhật khi hệ thống xác nhận kết quả."
    items={rows} loading={query.loading || member && actor.loading} error={query.error} reload={query.reload}
    controls={<View style={{ gap: 12 }}>
      <QueryStatus loading={member && actor.loading} error={member ? actor.error : null} retry={actor.reload} />
      <Button title="+ Tạo yêu cầu thanh toán" disabled={member && !actorId} onPress={() => router.push('/payment-edit')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {stat('Tổng giao dịch', String(summary.total))}
        {stat(member ? 'Đã thanh toán' : 'Đã thu', currency(summary.collected), colors.green)}
        {stat('Chờ thanh toán', String(summary.pendingCount), '#b45309')}
        {stat('Số tiền chờ', currency(summary.pendingAmount))}
      </View>
      <Field label="Tìm giao dịch" value={search} onChangeText={setSearch} placeholder={member ? 'Tìm lớp hoặc phương thức…' : 'Tìm hội viên, lớp hoặc phương thức…'} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map(([key, label]) => <Button key={key} secondary={filter !== key} title={query.data ? `${label} (${all.filter(item => key === 'ALL' || item.status === key).length})` : label} onPress={() => setFilter(key)} />)}
      </View>
      <SubjectFilter options={subjectOptions} value={subject} onChange={setSubject} total={all.length} />
      {query.data && !rows.length && <Text style={ui.body}>{all.length ? 'Không có giao dịch phù hợp. Thử từ khóa hoặc bộ lọc khác.' : 'Chưa có giao dịch. Giao dịch xuất hiện khi có yêu cầu thanh toán học phí.'}</Text>}
    </View>}
    renderItem={item => {
      const registration = registrationFor(item, registrations);
      return <View style={ui.card}>
        <Text style={ui.eyebrow}>{isVoidedPayment(item, registration) ? 'KHÔNG CÒN HIỆU LỰC · ĐĂNG KÝ ĐÃ HỦY' : item.status === 'SUCCESS' ? '✓ ĐÃ THANH TOÁN' : item.status === 'FAILED' ? 'THANH TOÁN THẤT BẠI' : '◷ CHỜ THANH TOÁN'}</Text>
        <Text style={ui.title}>{currency(item.amount)}</Text>
        <Text style={ui.heading}>{referenceLabel(registration?.classId)}</Text>
        {!member && <Text style={ui.body}>{registration && !registration.memberId ? 'Hồ sơ hội viên đã bị xóa' : referenceLabel(registration?.memberId)}</Text>}
        <Text style={ui.body}>{methodLabel(item.paymentMethod)}</Text>
        <Text style={ui.body}>{item.paymentDate || item.createdAt ? new Date(String(item.paymentDate || item.createdAt)).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' }) : ''}</Text>
        {registration && <Button secondary title="Xem đăng ký và bước tiếp theo →" onPress={() => router.push({ pathname: '/registration-detail', params: { id: entityId(registration) } })} />}
        {item.status === 'SUCCESS' && <Button secondary title="Xem biên nhận" onPress={() => router.push({ pathname: '/payment-receipt', params: { id: entityId(item) } })} />}
        {item.status === 'PENDING' && registration?.status !== 'CANCELLED' && <Button secondary title={member ? 'Chi tiết & thanh toán →' : 'Xử lý thanh toán →'} onPress={() => router.push({ pathname: '/payment-edit', params: { id: entityId(item) } })} />}
      </View>;
    }} />;
}
