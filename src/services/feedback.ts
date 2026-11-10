import { notificationsApi } from './notifications';
import { entityId, referenceId, type Entity } from './operations';
// Coach feedback is delivered as in-app notifications (no dedicated BE model).
// The BE only lets a coach notify confirmed students of their own classes.
export const FEEDBACK_TITLE = 'Nhận xét từ HLV';
export type FeedbackTarget = 'class' | 'member';
export type FeedbackInput = { target: FeedbackTarget; classId: string; className: string; memberId?: string; content: string; rating?: number };
export type FeedbackRecipient = { memberId: string; userId: string; fullName: string };
/** Confirmed students of a class (or one of them) from /api/coaches/my-students rows. */
export function feedbackRecipients(rows: Entity[], target: FeedbackTarget, classId: string, memberId = ''): FeedbackRecipient[] {
  const seen = new Set<string>();
  return rows.flatMap(row => {
    const member = row.member && typeof row.member === 'object' ? row.member as Entity : undefined;
    const id = member ? entityId(member) : '';
    const userId = member ? referenceId(member.userId) : '';
    if (!member || !id || !userId || referenceId(row.class) !== classId || seen.has(id) || (target === 'member' && id !== memberId)) return [];
    seen.add(id);
    return [{ memberId: id, userId, fullName: String(member.fullName || '') }];
  });
}
export function feedbackTitle(input: Pick<FeedbackInput, 'target' | 'className'>) {
  return `${FEEDBACK_TITLE} · ${input.target === 'class' ? 'Cả lớp' : 'Cá nhân'} · ${input.className}`.slice(0, 200);
}
export function feedbackMessage(input: Pick<FeedbackInput, 'content' | 'rating'>) {
  return `${input.content.trim()}${input.rating ? `\nĐánh giá: ${input.rating}/5` : ''}`;
}
export function validateFeedback(input: FeedbackInput) {
  if (!input.classId) return 'Chọn lớp bạn phụ trách.';
  if (input.target === 'member' && !input.memberId) return 'Chọn học viên nhận xét.';
  if (input.content.trim().length < 5) return 'Nhập nội dung nhận xét (ít nhất 5 ký tự).';
  if (input.rating !== undefined && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) return 'Điểm đánh giá từ 1 đến 5.';
  return '';
}
/** Sends one notification per recipient; reports how many succeeded. */
export async function sendFeedback(token: string, recipients: FeedbackRecipient[], input: FeedbackInput) {
  const title = feedbackTitle(input); const message = feedbackMessage(input);
  const results = await Promise.allSettled(recipients.map(item => notificationsApi.create(token, { userId: item.userId, title, message })));
  const failed = recipients.filter((_, index) => results[index].status === 'rejected');
  const firstError = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')?.reason;
  return { sent: recipients.length - failed.length, failed, error: firstError instanceof Error ? firstError.message : '' };
}
export const isFeedback = (item: Entity) => String(item.title || '').startsWith(FEEDBACK_TITLE);
