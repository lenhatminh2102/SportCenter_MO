import { request } from './api';
import type { Entity } from './operations';
export type HomeworkInput = { classId?: string; memberId?: string; title: string; description: string; dueDate?: string; attachments?: string[] };
export const homeworksApi = {
  my: (token: string) => request<Entity[]>('/api/homeworks/my', { token }),
  create: (token: string, input: HomeworkInput) => request<{ homework: Entity; recipientCount: number; notificationCount: number }>('/api/homeworks', { token, body: input }),
};
