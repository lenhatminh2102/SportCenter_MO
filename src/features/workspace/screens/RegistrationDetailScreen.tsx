import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useActorProfile } from '@/hooks/use-actor-profile';
import { useApiQuery } from '@/hooks/use-api-query';
import { classRegistrationsApi, classesApi, entityId, referenceId, referenceLabel } from '@/services/operations';
import { paymentsApi, pendingPaymentForRegistration, currency, isVoidedPayment, paymentStatusLabel } from '@/services/payments';
import { enrollmentRoles, enrollmentSteps } from '@/utils/enrollment';
import { FlowSteps } from '@/components/sport/flow-steps';
import { colors } from '@/data/sport';
import { roleHome } from '@/utils/staff-navigation';
import { Screen, Button } from '@/components/sport/ui';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { CancelRegistration } from '@/components/sport/cancel-registration';
import { ReopenRegistration } from '@/components/sport/reopen-registration';
import { canReopenRegistration } from '@/services/registration-reopen';
import { canConfirmAtDesk } from '@/services/checkin';
import { DeskConfirmRegistration } from '@/components/sport/desk-confirm-registration';
import { ui } from '@/components/sport/styles';
export default function RegistrationDetail() {
  const { id, paid: paidParam } = useLocalSearchParams<{ id?: string; paid?: string }>(); const { user, token } = useAuth(); const member = user?.role === 'MEMBER';
  const actor = useActorProfile(member); const actorId = actor.data ? entityId(actor.data) : '';
  const load = useCallback(async () => {
    const [registrations, classes, payments] = await Promise.all([classRegistrationsApi.list(token!), classesApi.list(token!), paymentsApi.list(token!)]);
    const registration = registrations.find(item => entityId(item) === id && (!member || referenceId(item.memberId) === actorId));
    return { registration, classInfo: classes.find(item => entityId(item) === referenceId(registration?.classId)), payments: payments.filter(item => referenceId(item.classRegistrationId) === id) };
  }, [token, id, member, actorId]);
  const query = useApiQuery(load, !!token && enrollmentRoles.includes(user?.role || '') && (!member || !!actorId), false); const { reload } = query;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!user || !token) return <AccessScreen />;
  if (!enrollmentRoles.includes(user.role)) return <AccessScreen denied />;
  const item = query.data?.registration; const paid = query.data?.payments.some(record => record.status === 'SUCCESS'); const payment = pendingPaymentForRegistration(query.data?.payments || [], id);
  // Coming back from a finished online payment (?paid=): only trust it when the BE data agrees.
  const paidPayment = query.data?.payments.find(record => entityId(record) === paidParam && record.status === 'SUCCESS');
  const justEnrolled = !!paidPayment && item?.status === 'CONFIRMED';
  return <Screen><Link href={{ pathname: '/workspace/[resource]', params: { resource: 'class-registrations' } }} style={ui.link}>← {member ? 'Đăng ký của tôi' : 'Danh sách đăng ký'}</Link>{justEnrolled && <FlowSteps labels={enrollmentSteps} current={enrollmentSteps.length} />}<Text style={ui.title}>{justEnrolled ? 'Đăng ký thành công' : 'Thông tin đăng ký'}</Text>{justEnrolled && item && <View style={[ui.card, { alignItems: 'center', backgroundColor: '#f3fbf6', borderColor: '#cdebd8', paddingVertical: 24 }]}><View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#e2f4e8', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 32, color: colors.green, fontWeight: '800' }}>✓</Text></View><Text style={[ui.heading, { textAlign: 'center' }]}>Chúc mừng! Bạn đã đăng ký thành công</Text><Text style={[ui.body, { textAlign: 'center' }]}>Thanh toán {currency(paidPayment!.amount)} cho lớp {query.data?.classInfo ? String(query.data.classInfo.name) : referenceLabel(item.classId)} đã được xác nhận. Lịch học đã có trong mục Lịch của tôi.</Text><View style={{ alignSelf: 'stretch', gap: 10 }}><Button title="Xem lịch học của tôi" onPress={() => router.push({ pathname: '/workspace/[resource]', params: { resource: 'schedules' } })} /><Button secondary title="Xem hóa đơn" onPress={() => router.push({ pathname: '/payment-receipt', params: { id: entityId(paidPayment!) } })} /></View></View>}<QueryStatus loading={query.loading || member && actor.loading} error={query.error || (member ? actor.error : null)} retry={() => { actor.reload(); reload(); }} />{query.data && !item && <Text style={ui.error}>Không tìm thấy đăng ký trong phạm vi tài khoản.</Text>}{item && <>
    <View style={ui.card}><Text style={ui.eyebrow}>{item.status === 'CONFIRMED' ? '✓ ĐÃ XÁC NHẬN' : item.status === 'CANCELLED' ? 'ĐÃ HỦY' : 'CHỜ LỄ TÂN XÁC NHẬN'}</Text><Text style={ui.heading}>{query.data?.classInfo ? String(query.data.classInfo.name) : referenceLabel(item.classId)}</Text><Text style={ui.body}>Hội viên: {referenceLabel(item.memberId)}</Text><Text style={ui.body}>Đăng ký: {String(item.registeredAt || item.createdAt || '').slice(0, 10)}</Text>{payment && item.status === 'PENDING_PAYMENT' && <Text style={ui.heading}>Chờ thanh toán: {currency(payment.amount)}</Text>}</View>
    {item.status === 'PENDING_PAYMENT' && paid && <View style={ui.card}><Text style={ui.body}>Đã có giao dịch thành công. Đang chờ đồng bộ trạng thái đăng ký; không tạo thanh toán mới. Làm mới hoặc liên hệ trung tâm.</Text><Button secondary title="Kiểm tra lại" onPress={reload} /></View>}{item.status === 'PENDING_PAYMENT' && !paid && canConfirmAtDesk(user.role) && <DeskConfirmRegistration item={item} token={token} amount={payment?.amount ?? item.priceSnapshot} onConfirmed={reload} />}{item.status === 'PENDING_PAYMENT' && !paid && <><Text style={ui.body}>{member ? 'Đăng ký đang chờ lễ tân xác nhận. Thanh toán học phí tại quầy để lễ tân xác nhận, hoặc thanh toán online để được xác nhận ngay. Sau khi xác nhận, bạn có mã QR ra/vào trung tâm.' : 'Đăng ký đã lưu. Hội viên có thể thanh toán online, hoặc lễ tân thu tiền tại quầy và xác nhận ở trên.'}</Text><Button title={payment ? 'Tiếp tục thanh toán →' : 'Chọn phương thức thanh toán →'} onPress={() => router.push({ pathname: '/payment-edit', params: { registrationId: entityId(item) } })} /><CancelRegistration item={item} token={token} onCancelled={reload} /></>}
    {item.status === 'CONFIRMED' && <><Text style={ui.body}>Hội viên đã được xác nhận trong lớp. Xem lịch học và theo dõi buổi tập tiếp theo.</Text>{member && <Button title="Mã QR ra/vào" onPress={() => router.push('/checkin')} />}<Button secondary={member} title={member ? 'Xem lịch học của tôi →' : 'Xem lịch lớp →'} onPress={() => router.push({ pathname: '/workspace/[resource]', params: { resource: 'schedules', classId: referenceId(item.classId) } })} /><Text style={ui.body}>Muốn đổi hoặc hủy lớp đã thanh toán, liên hệ trung tâm để xử lý quyền lợi và học phí.</Text>{member && <Button secondary title="Gửi yêu cầu hỗ trợ" onPress={() => router.push('/support')} />}</>}
    {item.status === 'CANCELLED' && <>{canReopenRegistration(user.role) ? <><Text style={ui.body}>Đăng ký đã hủy. Mở lại để hội viên tiếp tục thanh toán và tham gia lớp.</Text><ReopenRegistration item={item} token={token} pendingAmount={payment?.amount} onReopened={reload} /></> : <Text style={ui.body}>Đăng ký đã hủy và không cần thanh toán. Muốn tham gia lại lớp này, vui lòng liên hệ trung tâm để được hỗ trợ.</Text>}<Button secondary title="Khám phá lớp khác" onPress={() => router.push('/enroll')} /></>}
    {!!query.data?.payments.length && <Text style={ui.heading}>Lịch sử thanh toán</Text>}{query.data?.payments.map(record => <View key={entityId(record)} style={[ui.card, isVoidedPayment(record, item) && { opacity: 0.6 }]}><Text style={[ui.heading, isVoidedPayment(record, item) && { textDecorationLine: 'line-through' }]}>{currency(record.amount)}</Text><Text style={ui.body}>{paymentStatusLabel(record, item)}</Text></View>)}
  </>}<Button secondary title="Về không gian của tôi" onPress={() => router.navigate(roleHome(user.role))} /></Screen>;
}
