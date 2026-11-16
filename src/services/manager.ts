import { request } from './api';

type Registrations = Record<'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED', number>;
export type ManagerReport = {
  from: string; to: string; timezone: string; currency: string;
  summary: { totalMembers: number; newMembers: number; registrations: Registrations; revenue: number; classRevenue: number; membershipRevenue: number; successfulPayments: number };
  /** Per day: new members, registrations made that day (all statuses), revenue collected. */
  daily: { date: string; newMembers: number; registrations: number; revenue: number; successfulPayments: number }[];
  undatedSuccessfulPayments: number;
};

type SeriesRow = { period: string; count?: number; total?: number; transactions?: number };
/** GET /api/reports/overview payload (team backend), only the parts used here. */
export type ReportOverview = {
  members?: { total?: number; newInPeriod?: number; series?: SeriesRow[] };
  registrations?: { byStatusInPeriod?: Partial<Registrations>; series?: SeriesRow[] };
  revenue?: { total?: number; classes?: number; memberships?: number; series?: SeriesRow[] };
};

function datesBetween(from: string, to: string) {
  const days: string[] = [];
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86400000) days.push(new Date(time).toISOString().slice(0, 10));
  return days;
}

/** Team report grouped by day → the shape the report screen uses; days with no activity become zeros. */
export function toManagerReport(overview: ReportOverview, from: string, to: string): ManagerReport {
  const byPeriod = (rows?: SeriesRow[]) => new Map((rows || []).map(row => [row.period, row]));
  const members = byPeriod(overview.members?.series);
  const registrations = byPeriod(overview.registrations?.series);
  const revenue = byPeriod(overview.revenue?.series);
  const daily = datesBetween(from, to).map(date => ({
    date,
    newMembers: members.get(date)?.count || 0,
    registrations: registrations.get(date)?.count || 0,
    revenue: revenue.get(date)?.total || 0,
    successfulPayments: revenue.get(date)?.transactions || 0,
  }));
  const status = overview.registrations?.byStatusInPeriod || {};
  return {
    from, to, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND',
    summary: {
      totalMembers: overview.members?.total || 0,
      newMembers: overview.members?.newInPeriod || 0,
      registrations: { PENDING_PAYMENT: status.PENDING_PAYMENT || 0, CONFIRMED: status.CONFIRMED || 0, CANCELLED: status.CANCELLED || 0 },
      revenue: overview.revenue?.total || 0,
      classRevenue: overview.revenue?.classes || 0,
      membershipRevenue: overview.revenue?.memberships || 0,
      successfulPayments: daily.reduce((sum, day) => sum + day.successfulPayments, 0),
    },
    daily,
    undatedSuccessfulPayments: 0,
  };
}
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
  /** from/to: YYYY-MM-DD, whole days in UTC+7, read from the team report API /api/reports/overview. */
  report: async (token: string, from: string, to: string) => toManagerReport(
    await request<ReportOverview>(`/api/reports/overview?from=${encodeURIComponent(`${from}T00:00:00+07:00`)}&to=${encodeURIComponent(`${to}T23:59:59.999+07:00`)}&groupBy=day`, { token }),
    from, to,
  ),
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
