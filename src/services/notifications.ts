import { request } from './api';
import { referenceId, type Entity } from './operations';
export const notificationsApi = {
  my: (token: string) => request<Entity[]>('/api/notifications/my', { token }),
  create: (token: string, input: { userId: string; title: string; message: string }) => request<Entity>('/api/notifications', { token, body: { userId: input.userId, title: input.title.trim(), message: input.message.trim() } }),
};
export const ownNotifications = (items: Entity[], userId: string) => items.filter(item => !!userId && referenceId(item.userId) === userId);
