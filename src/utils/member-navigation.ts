import type { Href } from 'expo-router';
export const memberTabs: { label: string; symbol: string; href: Href; path: string }[] = [
  { label: 'Trang chủ', symbol: '⌂', href: '/member', path: '/member' },
  { label: 'Lớp học', symbol: '▤', href: '/explore', path: '/explore' },
  { label: 'Lịch của tôi', symbol: '◷', href: { pathname: '/workspace/[resource]', params: { resource: 'schedules' } }, path: '/workspace/schedules' },
  { label: 'Tài khoản', symbol: '○', href: '/account', path: '/account' },
];
export const isMemberPage = (path: string) => ['/homeworks', '/feedbacks', '/payment-receipt', '/member', '/enroll', '/registration-detail', '/account', '/profile', '/operations', '/workspace', '/payments', '/payment-edit', '/support', '/class-detail', '/pricing', '/notifications', '/session', '/payment-result', '/explore'].some(item => path === item || path.startsWith(`${item}/`));
export function activeMemberTab(path: string) {
  if (['/class-detail', '/enroll', '/registration-detail', '/workspace/classes'].includes(path) || path.startsWith('/workspace/classes/')) return '/explore';
  if (memberTabs.some(tab => tab.path === path || path.startsWith(`${tab.path}/`))) return memberTabs.find(tab => path === tab.path || path.startsWith(`${tab.path}/`))!.path;
  return '';
}
