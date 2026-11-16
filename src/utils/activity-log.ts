// Turns raw activity-log rows ("PUT /api/courses/<id>", or the older "Update /api/courses/<id>")
// into sentences a manager can read. Same rules as the web app (src/utils/activity-log.js there).
import type { Entity } from '@/services/operations';

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const id = (value: unknown) => (typeof value === 'string' ? value : value && typeof value === 'object' ? String((value as Entity)._id || (value as Entity).id || '') : '');

/** /api/<resource> → noun used in the sentence. */
const NOUNS: Record<string, string> = {
  subjects: 'môn thể thao', courses: 'khóa học', 'learning-paths': 'lộ trình', lessons: 'bài học', classes: 'lớp học', rooms: 'phòng tập',
  schedules: 'lịch học', attendances: 'điểm danh', 'lesson-progress': 'tiến độ bài học', homeworks: 'bài tập về nhà', 'workout-plans': 'kế hoạch tập',
  'workout-results': 'kết quả tập', 'class-registrations': 'đăng ký lớp', payments: 'thanh toán', 'membership-orders': 'đơn gói tập', 'check-ins': 'check-in',
  members: 'hội viên', coaches: 'huấn luyện viên', staff: 'tài khoản nhân sự', auth: 'tài khoản', manager: 'quản lý', notifications: 'thông báo',
  'support-requests': 'yêu cầu hỗ trợ', ai: 'trợ lý AI', 'activity-logs': 'nhật ký',
};
const VERBS: Record<string, string> = { POST: 'Tạo', PUT: 'Cập nhật', PATCH: 'Cập nhật', DELETE: 'Xóa' };
const OLD_VERBS: Record<string, string> = { Create: 'POST', Update: 'PUT', Delete: 'DELETE' };
export const ROLE_LABELS: Record<string, string> = { CENTER_MANAGER: 'Quản lý', RECEPTIONIST: 'Lễ tân', COACH: 'Huấn luyện viên', MEMBER: 'Hội viên' };

/** [method, resource, path after /api/<resource> with ids as ":id", sentence, sensitive?] */
const RULES: [string, string, string, string, boolean?][] = [
  ['POST', 'schedules', 'import', 'Import lịch học từ Excel'],
  ['POST', 'manager', 'catalog-import', 'Nhập danh mục khóa học từ Excel'],
  ['POST', 'payments', ':id/record-payment', 'Ghi nhận thanh toán tại quầy', true],
  ['POST', 'payments', ':id/simulate', 'Mô phỏng kết quả thanh toán', true],
  ['POST', 'payments', ':id/checkout', 'Tạo liên kết thanh toán payOS'],
  ['POST', 'payments', ':id/vnpay', 'Tạo liên kết thanh toán VNPay'],
  ['PUT', 'payments', ':id', 'Sửa giao dịch thanh toán', true],
  ['PUT', 'support-requests', ':id/status', 'Xử lý yêu cầu hỗ trợ'],
  ['POST', 'staff', 'accounts', 'Tạo tài khoản nhân sự', true],
  ['PATCH', 'staff', 'accounts/:id', 'Cập nhật tài khoản nhân sự', true],
  ['POST', 'members', 'front-desk', 'Tạo hồ sơ hội viên tại quầy'],
  ['POST', 'members', 'me', 'Tạo hồ sơ hội viên của mình'],
  ['PUT', 'members', 'me', 'Cập nhật hồ sơ hội viên của mình'],
  ['PATCH', 'coaches', 'me', 'Cập nhật hồ sơ huấn luyện viên của mình'],
  ['POST', 'attendances', 'coach', 'Điểm danh buổi học'],
  ['POST', 'attendances', '', 'Điểm danh hội viên'],
  ['PUT', 'attendances', ':id', 'Sửa kết quả điểm danh'],
  ['POST', 'notifications', 'coach', 'Gửi thông báo cho học viên'],
  ['POST', 'notifications', '', 'Gửi thông báo'],
  ['PUT', 'notifications', 'my/read-all', 'Đánh dấu đã đọc tất cả thông báo'],
  ['PUT', 'notifications', ':id', 'Cập nhật thông báo'],
  ['POST', 'check-ins', 'plans', 'Tạo gói tập'],
  ['PUT', 'check-ins', 'plans/:id', 'Cập nhật gói tập'],
  ['DELETE', 'check-ins', 'plans/:id', 'Xóa gói tập', true],
  ['POST', 'check-ins', 'memberships', 'Gán gói tập cho hội viên'],
  ['POST', 'check-ins', 'tokens', 'Tạo mã check-in'],
  ['POST', 'check-ins', '', 'Check-in hội viên'],
  ['POST', 'membership-orders', '', 'Tạo đơn mua gói tập'],
  ['POST', 'membership-orders', ':id/checkout', 'Thanh toán đơn gói tập'],
  ['POST', 'manager', 'membership-plans', 'Tạo gói hội viên'],
  ['PATCH', 'manager', 'membership-plans/:id', 'Cập nhật gói hội viên'],
  ['POST', 'manager', 'members/:id/membership', 'Gán gói hội viên'],
  ['POST', 'manager', 'members/:id/membership/renew', 'Gia hạn gói hội viên'],
  ['PUT', 'manager', 'role-access/:id', 'Thay đổi quyền của vai trò', true],
  ['POST', 'ai', 'workout-suggestions', 'Tạo gợi ý bài tập bằng AI'],
  ['POST', 'auth', 'register', 'Đăng ký tài khoản'],
  ['POST', 'auth', 'google/verify-otp', 'Đăng nhập bằng Google'],
  ['PUT', 'class-registrations', ':id', 'Cập nhật đăng ký lớp'],
];

export type ParsedLog = { method: string; path: string; resource: string; sub: string; targetId: string };

/** Method and path pieces of one log row; null when the row is a free-text note. */
export function parseLog(log: Entity | null | undefined): ParsedLog | null {
  let method = String(log?.method || '').toUpperCase();
  let path = String(log?.path || '');
  if (!path) {
    const old = String(log?.action || '').match(/^(Create|Update|Delete)\s+(\/api\/\S+)$/);
    if (!old) return null;
    method = OLD_VERBS[old[1]];
    path = old[2];
  }
  const parts = path.split('?')[0].split('/').filter(Boolean);
  if (parts[0] !== 'api' || !parts[1]) return null;
  const rest = parts.slice(2);
  // Record ids and role names (role-access/COACH) are both "the thing acted on".
  const sub = rest.map(part => (OBJECT_ID.test(part) || part === ':id' || /^[A-Z_]{3,}$/.test(part) ? ':id' : part)).join('/');
  return { method, path, resource: parts[1], sub, targetId: rest.find(part => OBJECT_ID.test(part)) || '' };
}

/** "Cập nhật khóa học", "Ghi nhận thanh toán tại quầy", or the row's own text for a manual note. */
export function describeLog(log: Entity | null | undefined) {
  const parsed = parseLog(log);
  if (!parsed) return { sentence: String(log?.action || 'Thao tác'), sensitive: false, technical: '' };
  const rule = RULES.find(([method, resource, sub]) => method === parsed.method && resource === parsed.resource && sub === parsed.sub);
  const noun = NOUNS[parsed.resource] || parsed.resource.replace(/-/g, ' ');
  return {
    sentence: rule ? rule[3] : `${VERBS[parsed.method] || 'Thao tác'} ${noun}`,
    sensitive: Boolean(rule?.[4]) || parsed.method === 'DELETE',
    technical: `${parsed.method} ${parsed.path}`,
  };
}

/** "Thiều Sỹ Tuấn · Quản lý": profile name, else the e-mail's name part, plus the role. */
export function actorLabel(log: Entity | null | undefined) {
  const user = log?.userId && typeof log.userId === 'object' ? log.userId as Entity : null;
  const role = String(log?.role || user?.role || '');
  const name = String(user?.fullName || (user?.email ? String(user.email).split('@')[0] : '') || id(log?.userId) || 'Người dùng');
  return [name, ROLE_LABELS[role]].filter(Boolean).join(' · ');
}
