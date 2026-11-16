import { request, requestHtml } from './api';
import { entityId, referenceId, type Entity } from './operations';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'ONLINE';
export const paymentMethods: { value: PaymentMethod; label: string }[] = [{ value: 'CASH', label: 'Tiền mặt tại trung tâm' }, { value: 'BANK_TRANSFER', label: 'Chuyển khoản' }, { value: 'ONLINE', label: 'Trực tuyến (payOS)' }];
export const paymentsApi = {
  status: (token: string, id: string) => request<{ paymentId: string; status: string; paymentDate: string | null; registrationStatus: string }>(`/api/payments/${encodeURIComponent(id)}/status`, { token }),
  record: (token: string, id: string) => request<Entity>(`/api/payments/${encodeURIComponent(id)}/record-payment`, { token, body: {} }),
  receipt: (token: string, id: string) => requestHtml(`/api/payments/${encodeURIComponent(id)}/receipt`, token),
  list: (token: string) => request<Entity[]>('/api/payments', { token }),
  create: (token: string, classRegistrationId: string, paymentMethod: PaymentMethod) => request<Entity>('/api/payments', { token, body: { classRegistrationId, paymentMethod } }),
  update: (token: string, id: string, paymentMethod: PaymentMethod) => request<Entity>(`/api/payments/${encodeURIComponent(id)}`, { token, method: 'PUT', body: { paymentMethod } }),
  vnpay: (token: string, id: string) => request<{ paymentUrl: string }>(`/api/payments/${encodeURIComponent(id)}/vnpay`, { token, body: {} }),
  /** returnTo: app deep link payOS should come back to (BE accepts only the app schemes). */
  checkout: (token: string, id: string, returnTo?: string) => request<{ paymentUrl: string }>(`/api/payments/${encodeURIComponent(id)}/checkout`, { token, body: returnTo ? { returnTo } : {} }),
  simulate: (token: string, id: string, status: 'SUCCESS' | 'FAILED') => request<Entity>(`/api/payments/${encodeURIComponent(id)}/simulate`, { token, body: { status } }),
};
export const canManagePayments = (role?: string) => ['MEMBER', 'CENTER_MANAGER', 'RECEPTIONIST'].includes(role || '');
export function registrationFor(payment: Entity, registrations: Entity[]): Entity | undefined {
  const id = referenceId(payment.classRegistrationId);
  return registrations.find(item => entityId(item) === id) || (payment.classRegistrationId && typeof payment.classRegistrationId === 'object' ? payment.classRegistrationId as Entity : undefined);
}
export const ownPayments = (items: Entity[], registrations: Entity[], memberId: string) => items.filter(item => !!memberId && referenceId(registrationFor(item, registrations)?.memberId) === memberId);
export function pendingPaymentForRegistration(items: Entity[], registrationId?: string) {
  return registrationId ? items.find(item => item.status === 'PENDING' && referenceId(item.classRegistrationId) === registrationId) : undefined;
}
export function payableRegistrations(registrations: Entity[], payments: Entity[]) {
  return registrations.filter(item => item.status === 'PENDING_PAYMENT' && !payments.some(payment => referenceId(payment.classRegistrationId) === entityId(item) && ['PENDING', 'SUCCESS'].includes(String(payment.status))));
}
export const currency = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('vi-VN')} ₫` : 'Chưa có học phí';
export function validatePaymentUrl(value: string): string {
  if (typeof value !== 'string' || !value) throw new Error('Máy chủ chưa trả về địa chỉ thanh toán.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['sandbox.vnpayment.vn', 'pay.vnpay.vn', 'pay.payos.vn'].includes(url.hostname) || url.username || url.password || url.port) throw new Error('Địa chỉ thanh toán từ máy chủ không hợp lệ.');
  return url.toString();
}
// The BE does not cancel a PENDING payment when its registration is cancelled.
export const isVoidedPayment = (payment: Entity, registration?: Entity) => payment.status === 'PENDING' && registration?.status === 'CANCELLED';
export function paymentStatusLabel(payment: Entity, registration?: Entity) {
  if (isVoidedPayment(payment, registration)) return 'Không còn hiệu lực · đăng ký đã hủy';
  return payment.status === 'SUCCESS' ? 'Thanh toán thành công' : payment.status === 'FAILED' ? 'Thanh toán thất bại' : 'Chờ thanh toán';
}
