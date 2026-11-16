import { request } from './api';
import { referenceId, type Entity } from './operations';
export const notificationsApi = {
  my: (token: string) => request<Entity[]>('/api/notifications/my', { token }),
  /** CENTER_MANAGER / RECEPTIONIST only: notify any user. */
  create: (token: string, input: { userId: string; title: string; message: string }) => request<Entity>('/api/notifications', { token, body: { userId: input.userId, title: input.title.trim(), message: input.message.trim() } }),
  /**
   * COACH only: notify a whole class they teach (classId) or one confirmed student (memberId, a
   * member profile id). The BE checks both belong to the coach and signs the message.
   */
  coach: (token: string, input: { classId?: string; memberId?: string; title: string; message: string }) => request<{ recipients?: number }>('/api/notifications/coach', {
    token, body: { ...(input.classId ? { classId: input.classId } : { memberId: input.memberId }), title: input.title.trim(), message: input.message.trim() },
  }),
  /** Mark one of my notifications read / unread. */
  setRead: (token: string, id: string, isRead: boolean) => request<Entity>(`/api/notifications/${encodeURIComponent(id)}`, { token, method: 'PUT', body: { isRead } }),
};
export const ownNotifications = (items: Entity[], userId: string) => items.filter(item => !!userId && referenceId(item.userId) === userId);
/** Manager / receptionist notify anyone; a coach only confirmed students of own classes (BE enforces it). */
export const canSendNotification = (role?: string) => ['CENTER_MANAGER', 'COACH', 'RECEPTIONIST'].includes(role || '');
