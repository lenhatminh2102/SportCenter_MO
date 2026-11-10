import { request } from './api';

type Registrations = Record<'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED', number>;
type PeriodTotals = { newMembers: number; registrations: Registrations; revenue: number; successfulPayments: number };
export type ManagerReport = {
  from: string; to: string; timezone: string; currency: string;
  summary: PeriodTotals & { totalMembers: number };
  daily: (PeriodTotals & { date: string })[];
  undatedSuccessfulPayments: number;
};
export type PlanInput = { name: string; price: number; durationDays: number; status: 'ACTIVE' | 'INACTIVE' };
export type MembershipPlan = PlanInput & { _id: string };
export type MemberMembership = {
  planId: string; planName: string; price: number; durationDays: number;
  startsAt: string; expiresAt: string; status: 'ACTIVE' | 'EXPIRED';
};
export type ConfigurableRole = 'COACH' | 'RECEPTIONIST' | 'MEMBER';
export type RoleAccess = { role: ConfigurableRole; disabled: string[] };

const base = '/api/manager';
const plans = `${base}/membership-plans`;
const access = `${base}/role-access`;
const membership = (id: string) => `${base}/members/${encodeURIComponent(id)}/membership`;

export const managerApi = {
  report: (token: string, from: string, to: string) =>
    request<ManagerReport>(`${base}/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { token }),
  listPlans: (token: string) => request<MembershipPlan[]>(plans, { token }),
  createPlan: (token: string, body: PlanInput) => request<MembershipPlan>(plans, { token, body }),
  updatePlan: (token: string, id: string, body: Partial<PlanInput>) =>
    request<MembershipPlan>(`${plans}/${encodeURIComponent(id)}`, { token, method: 'PATCH', body }),
  getMembership: (token: string, memberId: string) =>
    request<MemberMembership | null>(membership(memberId), { token }),
  assignMembership: (token: string, memberId: string, planId: string) =>
    request<MemberMembership>(membership(memberId), { token, body: { planId } }),
  renewMembership: (token: string, memberId: string, expectedExpiresAt: string) =>
    request<MemberMembership>(`${membership(memberId)}/renew`, { token, body: { expectedExpiresAt } }),
  getRoleAccess: (token: string) => request<{ accessKeys: string[]; roles: RoleAccess[] }>(access, { token }),
  updateRoleAccess: (token: string, role: ConfigurableRole, disabled: string[]) =>
    request<RoleAccess>(`${access}/${encodeURIComponent(role)}`, { token, method: 'PUT', body: { disabled } }),
};
