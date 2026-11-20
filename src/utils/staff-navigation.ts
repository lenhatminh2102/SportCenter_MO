import type { Href } from 'expo-router';

export type StaffRole = 'COACH' | 'CENTER_MANAGER';
export type WorkspaceRole = StaffRole | 'RECEPTIONIST';
export type AppTab = { label: string; symbol: string; href: Href; path: string };

export const isWorkspaceRole = (role?: string): role is WorkspaceRole =>
  role === 'COACH' || role === 'CENTER_MANAGER' || role === 'RECEPTIONIST';
export const isStaffRole = (role?: string): role is StaffRole => role === 'COACH' || role === 'CENTER_MANAGER';
export const roleHome = (role?: string): '/coach' | '/manager' | '/member' | '/reception' | '/account' =>
  role === 'COACH' ? '/coach' : role === 'CENTER_MANAGER' ? '/manager' : role === 'MEMBER' ? '/member' : role === 'RECEPTIONIST' ? '/reception' : '/account';

const resourceTab = (resource: string, label: string, symbol: string): AppTab => ({
  label, symbol, path: `/workspace/${resource}`, href: { pathname: '/workspace/[resource]', params: { resource } },
});
const members: AppTab = { label: 'Hội viên', symbol: '♧', href: '/members', path: '/members' };
const schedules = resourceTab('schedules', 'Lịch tập', '◷');
const account: AppTab = { label: 'Tài khoản', symbol: '○', href: '/account', path: '/account' };

export function staffTabs(role: WorkspaceRole): AppTab[] {
  const home = { label: 'Trang chủ', symbol: '⌂', href: roleHome(role), path: roleHome(role) };
  if (role === 'COACH') {
    const students: AppTab = { label: 'Học viên', symbol: '♧', href: '/coach-students', path: '/coach-students' };
    const attendance: AppTab = { label: 'Điểm danh', symbol: '✓', href: '/attendance', path: '/attendance' };
    return [home, attendance, { ...schedules, label: 'Lịch dạy' }, students, account];
  }
  if (role === 'RECEPTIONIST') return [home, { label: 'Quét QR', symbol: '⌗', href: '/checkin-desk', path: '/checkin-desk' }, members, resourceTab('class-registrations', 'Đăng ký', '＋'), account];
  return [home, resourceTab('classes', 'Lớp học', '▤'), { ...schedules, label: 'Lịch hoạt động' }, members, account];
}

/** Manager screens that are not tabs: reached from the manager home and the account screen (the web sidebar lists them). */
export const managerAdminLinks: { label: string; description: string; href: Href; path: string }[] = [
  { label: 'Huấn luyện viên & nhân sự', description: 'Tạo, sửa, khóa tài khoản HLV và lễ tân', href: '/staff-accounts', path: '/staff-accounts' },
  { label: 'Gói tập & học phí', description: 'Danh mục gói, gán hoặc gia hạn gói cho hội viên', href: '/manager/memberships', path: '/manager/memberships' },
  { label: 'Báo cáo & doanh thu', description: 'Doanh thu thực thu, hội viên mới, giao dịch', href: '/manager/reports', path: '/manager/reports' },
  { label: 'Lịch sử thao tác', description: 'Ai đã làm gì trên hệ thống', href: { pathname: '/workspace/[resource]', params: { resource: 'activity-logs' } }, path: '/workspace/activity-logs' },
];

export function activeStaffTab(path: string, role: WorkspaceRole) {
  const aliases: Record<string, string> = {
    '/class-detail': '/workspace/classes',
    '/schedule-import': '/workspace/schedules',
    '/catalog-import': '/workspace/classes',
    '/workspace/attendances': '/workspace/schedules',
    '/workspace/attendances/edit': '/workspace/schedules',
    '/attendance/session': '/attendance',
    '/profile': '/account',
  };
  const registrationTab = role === 'RECEPTIONIST' ? '/workspace/class-registrations' : '/workspace/classes';
  const current = ['/enroll', '/registration-detail', '/workspace/class-registrations'].includes(path)
    ? registrationTab : aliases[path] || path;
  return staffTabs(role).find(tab => current === tab.path || (tab.path !== roleHome(role) && current.startsWith(`${tab.path}/`)))?.path;
}

export function isStaffPage(path: string) {
  return [
    '/coach', '/coach-students', '/manager', '/reception', '/account', '/profile', '/members', '/workspace',
    '/class-detail', '/registration-detail', '/enroll', '/schedule-import', '/payments', '/payment-edit',
    '/payment-receipt', '/support', '/operations', '/staff-accounts',
    '/homeworks', '/feedbacks', '/pricing', '/notifications', '/notification-compose',
    '/attendance', '/session', '/payment-result', '/catalog-import', '/checkin-desk',
  ].some(root => path === root || path.startsWith(`${root}/`));
}
