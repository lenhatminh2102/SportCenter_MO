import { request } from './api';
import type { Entity } from './operations';
export type StaffRoleInput = 'COACH' | 'RECEPTIONIST';
export type StaffAccountInput = { email: string; password: string; role: StaffRoleInput; fullName: string; phone: string; subjectId?: string };
export type StaffStatus = 'ACTIVE' | 'INACTIVE';
export type StaffAccount = {
  _id: string; email: string; fullName?: string; phone?: string; role: StaffRoleInput;
  status: StaffStatus; coach: { subjectId?: Entity | string } | null;
};
export type StaffUpdate = Partial<Pick<StaffAccountInput, 'role' | 'fullName' | 'phone' | 'subjectId'> & { status: StaffStatus }>;
// CENTER_MANAGER creates the login account; for COACH the backend also creates the coach profile (subjectId required).
export const staffApi = {
  list: (token: string) => request<StaffAccount[]>('/api/staff/accounts', { token }),
  update: (token: string, id: string, input: StaffUpdate) =>
    request<StaffAccount>(`/api/staff/accounts/${encodeURIComponent(id)}`, { token, method: 'PATCH', body: input }),
  createAccount: (token: string, input: StaffAccountInput) => request<{ user: { id: string; email: string; role: string }; coach: Entity | null }>('/api/staff/accounts', {
    token,
    body: {
      email: input.email.trim().toLowerCase(), password: input.password, role: input.role,
      fullName: input.fullName.trim(), phone: input.phone.replace(/[\s.-]/g, ''),
      ...(input.role === 'COACH' && input.subjectId ? { subjectId: input.subjectId } : {}),
    },
  }),
};
export function validateStaffAccount(input: StaffAccountInput, validEmail: (value: string) => boolean, validPhone: (value: string) => boolean) {
  const errors: Partial<Record<keyof StaffAccountInput, string>> = {};
  if (!validEmail(input.email)) errors.email = 'Nhập email hợp lệ.';
  if (input.password.length < 6) errors.password = 'Mật khẩu cần ít nhất 6 ký tự.';
  if (input.fullName.trim().length < 2) errors.fullName = 'Nhập họ tên từ 2 ký tự.';
  if (!validPhone(input.phone)) errors.phone = 'Nhập số điện thoại Việt Nam hợp lệ.';
  if (input.role === 'COACH' && !/^[a-f\d]{24}$/i.test(input.subjectId || '')) errors.subjectId = 'Chọn môn thể thao huấn luyện viên phụ trách.';
  return errors;
}
