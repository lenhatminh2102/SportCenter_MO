import { request } from './api';
import { referenceId, type Entity } from './operations';
export const supportApi = {
  list: (token: string) => request<Entity[]>('/api/support-requests', { token }),
  create: (token: string, memberId: string, message: string) => request<Entity>('/api/support-requests', { token, body: { memberId, message: message.trim() } }),
  update: (token: string, id: string, status: 'PENDING' | 'RESOLVED') => request<Entity>(`/api/support-requests/${encodeURIComponent(id)}/status`, { token, method: 'PUT', body: { status } }),
  /** Staff answer to the member (the BE stores who/when and notifies them); close=true also resolves the request. */
  reply: (token: string, id: string, response: string, close: boolean) => request<Entity>(`/api/support-requests/${encodeURIComponent(id)}/status`, {
    token, method: 'PUT', body: { response: response.trim(), ...(close ? { status: 'RESOLVED' } : {}) },
  }),
};
export const canResolveSupport = (role?: string) => ['CENTER_MANAGER', 'RECEPTIONIST'].includes(role || '');
export const ownSupport = (items: Entity[], memberId: string) => items.filter(item => !!memberId && referenceId(item.memberId) === memberId);

const roleOf = (value: unknown) => (value && typeof value === 'object' ? String((value as Entity).role || '') : '');
/** "Hội viên gửi qua app" / "Lễ tân ghi nhận tại quầy"; '' for older requests saved without createdBy. */
export function supportSource(item: Entity) {
  const role = roleOf(item.createdBy);
  if (!role) return '';
  return role === 'MEMBER' ? 'Hội viên gửi qua app' : role === 'CENTER_MANAGER' ? 'Quản lý ghi nhận tại quầy' : 'Lễ tân ghi nhận tại quầy';
}
/** Who answered the request, as shown above the answer. */
export function supportResponder(item: Entity) {
  const role = roleOf(item.respondedBy);
  return role === 'CENTER_MANAGER' ? 'Quản lý trung tâm' : role === 'RECEPTIONIST' ? 'Lễ tân' : 'Trung tâm';
}
