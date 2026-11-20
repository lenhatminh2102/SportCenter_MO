import { coursePrice, referenceLabel, type Entity, type ResourceKey } from '@/services/operations';
import { resources } from './resources';
import { actorLabel, describeLog } from './activity-log';
export function titleFor(resource: ResourceKey, item: Entity) {
  if (resource === 'schedules') return `${String(item.date || '').slice(0, 10)} · ${String(item.startTime || '')} – ${String(item.endTime || '')}`;
  if (resource === 'attendances') return `${referenceLabel(item.memberId)} · ${String(item.date || '').slice(0, 10)}`;
  if (resource === 'activity-logs') { const { sentence, sensitive } = describeLog(item); return `${sentence}${sensitive ? ' · Cần chú ý' : ''}`; }
  const value = item[resources[resource].titleKey];
  return typeof value === 'object' ? referenceLabel(value) : String(value || 'Chưa có tên');
}
export const statusLabels: Record<string, string> = { SCHEDULED: 'Đã lên lịch', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', PENDING_PAYMENT: 'Chờ lễ tân xác nhận', CONFIRMED: 'Đã xác nhận', PRESENT: 'Có mặt', ABSENT: 'Vắng mặt', NOT_STARTED: 'Chưa bắt đầu', IN_PROGRESS: 'Đang học', DRAFT: 'Bản nháp', APPROVED: 'Đã duyệt', ACTIVE: 'Hoạt động', INACTIVE: 'Tạm dừng' };
const tuition = (price?: number) => price === undefined ? 'Chưa có học phí' : price.toLocaleString('vi-VN') + ' ₫';
const statuses = statusLabels;
export function detailFor(resource: ResourceKey, item: Entity): string {
  const status = statuses[String(item.status)] || String(item.status || '');
  switch (resource) {
    case 'rooms': return `Phòng ${String(item.roomNumber || '')} · ${String(item.capacity || '')} người\n${status}`;
    case 'coaches': return String(item.phone || '');
    case 'subjects': return 'Môn thể thao trên hệ thống';
    case 'courses': return `Học phí: ${tuition(coursePrice(item))} / suất\n${status} · ${String(item.description || '')}`;
    case 'lessons': return `Bài ${String(item.order)} · ${referenceLabel(item.learningPathId)}${item.videoUrl ? ' · ▶ Có video' : ''}\n${String(item.description || '')}`;
    case 'schedules': return `${referenceLabel(item.classId)} · ${referenceLabel(item.lessonId)}\nPhòng: ${referenceLabel(item.roomId)} · ${status}`;
    case 'activity-logs': return [actorLabel(item), item.createdAt ? new Date(String(item.createdAt)).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' }) : ''].filter(Boolean).join('\n');
    case 'classes': return `${referenceLabel(item.subjectId)} · ${referenceLabel(item.courseId)}\nHLV: ${referenceLabel(item.coachId)}`;
    case 'class-registrations': return `${referenceLabel(item.memberId)}\n${status}`;
    case 'attendances': return `${referenceLabel(item.classId)} · ${referenceLabel(item.lessonId)}\n${status}`;
    case 'learning-paths': return `${referenceLabel(item.courseId)}\n${String(item.description || '')}`;
    case 'lesson-progress': return `${referenceLabel(item.memberId)}\n${status}`;
    case 'workout-plans': return `${item.memberId ? referenceLabel(item.memberId) : `Cả lớp ${referenceLabel(item.classId)}`} · HLV ${referenceLabel(item.coachId)}\n${String(item.plan || '')}\n${status}`;
    case 'workout-results': return `${referenceLabel(item.memberId)} · ${referenceLabel(item.workoutPlanId)}\n${String(item.comment || '')}`;
  }
}
