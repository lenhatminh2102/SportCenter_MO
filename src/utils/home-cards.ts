import type { Href } from 'expo-router';
import type { HomeAttention, HomeMetric } from '@/components/dashboard/home-widgets';
import type { CoachSummary, ManagerSummary } from '@/services/dashboard';
import type { Entity } from '@/services/operations';
import { referenceLabel } from '@/services/operations';

// Tiles and "needs attention" rows of the manager and reception homes, same as the web ManagerHome / ReceptionHome.

const count = (value: number | null | undefined) => value == null ? '—' : String(value).padStart(2, '0');
const money = (value: number | null) => value == null ? '—' : `${value.toLocaleString('vi-VN')} ₫`;
const list = (resource: string, params: Record<string, string> = {}): Href => ({ pathname: '/workspace/[resource]', params: { resource, ...params } });
const dayOf = (value: unknown) => String(value ?? '').slice(0, 10);

export function managerCards(summary: ManagerSummary, today: string): { metrics: HomeMetric[]; attention: HomeAttention[] } {
  const pending = summary.pendingRegistrations;
  const sessions = summary.todaySessions;
  return {
    metrics: [
      { label: 'Tổng hội viên', value: count(summary.members), detail: 'Hồ sơ hội viên trên hệ thống', href: '/members' },
      { label: 'Lớp đang hoạt động', value: count(summary.classes), detail: 'Lớp học của trung tâm', href: list('classes') },
      { label: 'Buổi tập hôm nay', value: count(sessions), detail: 'Lịch tập đang diễn ra', href: list('schedules', { date: today }) },
      { label: 'Doanh thu tháng này', value: money(summary.revenueMonth), detail: 'Thanh toán thành công', href: '/manager/reports' },
    ],
    attention: [
      pending
        ? { tone: 'urgent', title: `${pending} đăng ký chờ thanh toán`, detail: 'Cần thu học phí để xác nhận học viên vào lớp', cta: 'Xem đăng ký', href: list('class-registrations') }
        : { tone: 'ok', title: 'Không có đăng ký chờ thanh toán', detail: 'Các đăng ký đã được xử lý', cta: 'Xem đăng ký', href: list('class-registrations') },
      { tone: sessions ? 'info' : 'ok', title: sessions ? `${sessions} buổi tập hôm nay` : 'Hôm nay chưa có buổi tập', detail: 'Theo dõi lịch tập và phòng tập trong ngày', cta: 'Xem lịch tập', href: list('schedules', { date: today }) },
      { tone: 'info', title: 'Gói tập & học phí', detail: 'Gán hoặc gia hạn gói thành viên cho hội viên', cta: 'Quản lý gói tập', href: '/manager/memberships' },
    ],
  };
}

/** Member home (web MemberHome). `upcoming` is already sorted, nearest first; `pending` counts payments still due. */
export function memberCards(input: { confirmed: number; upcoming: Entity[]; pending: number; unread: number | null; profileMissing: boolean }): { metrics: HomeMetric[]; attention: HomeAttention[] } {
  const next = input.upcoming[0];
  const vnDay = (value: unknown) => dayOf(value).split('-').reverse().join('/');
  return {
    metrics: [
      { label: 'Lớp đang tham gia', value: count(input.confirmed), detail: 'Lịch tập đã xác nhận', href: list('class-registrations') },
      { label: 'Buổi tập sắp tới', value: count(input.upcoming.length), detail: next ? `Gần nhất ${vnDay(next.date)} ${next.startTime}` : 'Chưa có buổi sắp tới', href: list('schedules') },
      { label: 'Chờ thanh toán', value: count(input.pending), detail: 'Khoản học phí cần thanh toán', href: '/payments' },
      { label: 'Thông báo mới', value: count(input.unread), detail: 'Từ trung tâm và HLV', href: '/notifications' },
    ],
    attention: [
      input.profileMissing
        ? { tone: 'urgent', title: 'Hoàn thiện hồ sơ của bạn', detail: 'Cần họ tên, số điện thoại và mục tiêu để đăng ký lớp', cta: 'Cập nhật hồ sơ', href: '/profile' }
        : { tone: 'ok', title: 'Hồ sơ đã sẵn sàng', detail: 'HLV dùng mục tiêu và trình độ để lập kế hoạch cho bạn', cta: 'Xem hồ sơ', href: '/profile' },
      input.pending
        ? { tone: 'urgent', title: `${input.pending} khoản chờ thanh toán`, detail: 'Thanh toán để xác nhận chỗ trong lớp', cta: 'Thanh toán ngay', href: '/payments' }
        : { tone: 'ok', title: 'Không có khoản chờ thanh toán', detail: 'Các giao dịch đã được cập nhật', cta: 'Xem thanh toán', href: '/payments' },
      next
        ? { tone: 'info', title: `Buổi tiếp theo: ${referenceLabel(next.classId)}`, detail: `${vnDay(next.date)} · ${next.startTime}–${next.endTime} · ${referenceLabel(next.roomId)}`, cta: 'Xem lịch', href: list('schedules') }
        : { tone: 'info', title: 'Chưa có buổi tập sắp tới', detail: 'Khám phá các lớp đang mở tại trung tâm', cta: 'Khám phá lớp học', href: '/explore' },
    ],
  };
}

/** Coach home (web CoachHome). */
export function coachCards(summary: CoachSummary): { metrics: HomeMetric[]; attention: HomeAttention[] } {
  const today = summary.todaySessions ?? 0;
  const drafts = summary.drafts ?? 0;
  return {
    metrics: [
      { label: 'Lớp phụ trách', value: count(summary.classes), detail: 'Lớp đang hoạt động', href: list('classes') },
      { label: 'Học viên', value: count(summary.students), detail: 'Đã xác nhận trong lớp', href: '/coach-students' },
      { label: 'Buổi dạy hôm nay', value: count(summary.todaySessions), detail: 'Sẵn sàng cho buổi tập', href: '/attendance' },
      { label: 'Kế hoạch tập luyện', value: count(summary.plans), detail: `${drafts} bản nháp cần duyệt`, href: list('workout-plans') },
    ],
    attention: [
      { tone: today ? 'urgent' : 'ok', title: today ? `${today} buổi cần điểm danh hôm nay` : 'Hôm nay không có buổi dạy', detail: 'Điểm danh cả lớp và ghi nhận kết quả sau buổi', cta: 'Mở điểm danh', href: '/attendance' },
      { tone: drafts ? 'urgent' : 'info', title: drafts ? `${drafts} kế hoạch bản nháp` : 'Kế hoạch tập luyện', detail: 'Dùng gợi ý bài tập theo mục tiêu và trình độ', cta: 'Xem kế hoạch', href: list('workout-plans') },
      summary.pendingStudents
        ? { tone: 'urgent', title: `${summary.pendingStudents} học viên chờ thanh toán`, detail: 'Sẽ vào danh sách điểm danh sau khi thanh toán', cta: 'Xem học viên', href: '/coach-students' }
        : { tone: 'ok', title: 'Danh sách học viên đã cập nhật', detail: 'Theo dõi mục tiêu và trình độ của từng học viên', cta: 'Xem học viên', href: '/coach-students' },
    ],
  };
}

/** Lists the reception home loads; null when that list could not be loaded. */
export type ReceptionBoard = { members: Entity[] | null; registrations: Entity[] | null; payments: Entity[] | null; support: Entity[] | null; schedules: Entity[] | null; errors: string[] };

export function receptionCards(board: ReceptionBoard, today: string): { metrics: HomeMetric[]; attention: HomeAttention[]; recent: Entity[] } {
  const pendingRegistrations = board.registrations?.filter(item => item.status === 'PENDING_PAYMENT').length;
  const atDesk = board.payments?.filter(item => item.status === 'PENDING' && ['CASH', 'BANK_TRANSFER'].includes(String(item.paymentMethod))).length ?? 0;
  const openSupport = board.support?.filter(item => item.status !== 'RESOLVED').length;
  const todaySessions = board.schedules?.filter(item => dayOf(item.date) === today && item.status !== 'CANCELLED').length;
  const newest = [...(board.registrations || [])].sort((a, b) =>
    String(b.createdAt || b.registeredAt || '').localeCompare(String(a.createdAt || a.registeredAt || '')));
  return {
    metrics: [
      { label: 'Tổng hội viên', value: count(board.members?.length), detail: 'Hồ sơ trên hệ thống', href: '/members' },
      { label: 'Đăng ký chờ thanh toán', value: count(pendingRegistrations), detail: 'Cần thu học phí', href: list('class-registrations') },
      { label: 'Buổi tập hôm nay', value: count(todaySessions), detail: 'Lịch lớp trong ngày', href: list('schedules', { date: today }) },
      { label: 'Yêu cầu hỗ trợ', value: count(openSupport), detail: 'Đang chờ xử lý', href: '/support' },
    ],
    attention: [
      atDesk
        ? { tone: 'urgent', title: `${atDesk} khoản cần xác nhận thu tiền`, detail: 'Tiền mặt / chuyển khoản tại quầy', cta: 'Kiểm tra thanh toán', href: '/payments' }
        : { tone: 'ok', title: 'Không có khoản chờ thu tại quầy', detail: 'Các giao dịch đã được cập nhật', cta: 'Xem thanh toán', href: '/payments' },
      openSupport
        ? { tone: 'urgent', title: `${openSupport} yêu cầu hỗ trợ chưa xử lý`, detail: 'Hội viên đang chờ phản hồi', cta: 'Xử lý ngay', href: '/support' }
        : { tone: 'ok', title: 'Không có yêu cầu tồn đọng', detail: 'Mọi yêu cầu đã được giải quyết', cta: 'Xem hỗ trợ', href: '/support' },
      { tone: 'info', title: 'Đăng ký hội viên mới tại quầy', detail: 'Tạo tài khoản và hồ sơ trong một bước', cta: 'Đăng ký hội viên', href: '/members/front-desk' },
    ],
    recent: newest.slice(0, 4),
  };
}
