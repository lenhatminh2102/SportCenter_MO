import { request } from './api';

// QR entry/exit at the front desk (SportCenter-BE /api/check-ins) and the desk approval of a class
// registration (/api/class-registrations/:id/confirm). Same contract as the web app.
export type CheckInAction = 'IN' | 'OUT';
export type AccessRegistration = { id: string; classId: string; className: string; subjectName?: string; courseName?: string; status: string; label: string; active: boolean };
export type CheckInAccess = {
  registrations: AccessRegistration[];
  openVisit: { id: string; checkedInAt: string } | null;
  nextAction: CheckInAction;
  allowed: boolean;
  code?: string;
  message?: string;
};
export type CheckInPreview = CheckInAccess & { member: { id: string; fullName: string; phone?: string }; tokenExpiresAt: string };
export type IssuedQr = { qrImage: string; expiresAt: string; nextAction: CheckInAction };
type Person = { _id?: string; fullName?: string; email?: string } | null;
export type Visit = {
  _id: string; status: 'OPEN' | 'CLOSED'; checkedInAt: string; checkedOutAt?: string | null;
  memberId?: Person; checkedInBy?: Person; checkedOutBy?: Person;
  classRegistrationIds?: ({ classId?: { name?: string } | null } | null)[];
};
export type ConfirmResult = { action: CheckInAction; alreadyRecorded: boolean; visit: { id?: string; status: string; checkedInAt: string; checkedOutAt?: string | null; member?: { fullName?: string } } };

export const checkInApi = {
  /** MEMBER: registrations, whether inside, and what the next code is for. */
  me: (token: string) => request<CheckInAccess>('/api/check-ins/me', { token }),
  /** MEMBER: a PNG data URL holding only a single-use random token (2 minutes). */
  issueQr: (token: string) => request<IssuedQr>('/api/check-ins/tokens', { token, method: 'POST' }),
  /** Front desk: who the code belongs to and what to confirm. Does not use the code up. */
  preview: (token: string, qr: string) => request<CheckInPreview>('/api/check-ins/preview', { token, body: { token: qr } }),
  /** Front desk: records the entry or exit (atomic, safe to repeat). */
  confirm: (token: string, qr: string, action: CheckInAction) => request<ConfirmResult>('/api/check-ins/confirm', { token, body: { token: qr, action } }),
  /** Front desk: visits of a day (YYYY-MM-DD, Vietnam time) plus members still inside. */
  visits: (token: string, date?: string) => request<{ date: string; visits: Visit[] }>(`/api/check-ins/visits${date ? `?date=${encodeURIComponent(date)}` : ''}`, { token }),
  myVisits: (token: string) => request<Visit[]>('/api/check-ins/visits/me', { token }),
};

export type DeskPaymentMethod = 'CASH' | 'BANK_TRANSFER';
/** Front desk collects the fee and confirms the registration in one step. */
export const confirmRegistrationAtDesk = (token: string, registrationId: string, paymentMethod: DeskPaymentMethod) =>
  request<{ registrationId: string; status: string; alreadyConfirmed: boolean }>(`/api/class-registrations/${encodeURIComponent(registrationId)}/confirm`, { token, body: { paymentMethod } });
export const canConfirmAtDesk = (role?: string) => role === 'RECEPTIONIST' || role === 'CENTER_MANAGER';

export const checkInActionLabel = (action?: string) => (action === 'OUT' ? 'Xác nhận ra' : 'Xác nhận vào');

/** Vietnam wall-clock time without relying on the device's Intl/timezone support. */
function vietnamParts(value?: string | null) {
  const time = value ? Date.parse(value) : NaN;
  if (Number.isNaN(time)) return null;
  const local = new Date(time + 7 * 3600_000);
  const two = (n: number) => String(n).padStart(2, '0');
  return { hm: `${two(local.getUTCHours())}:${two(local.getUTCMinutes())}`, dm: `${two(local.getUTCDate())}/${two(local.getUTCMonth() + 1)}` };
}
export const clockTime = (value?: string | null) => vietnamParts(value)?.hm || '';
export const dayTime = (value?: string | null) => { const parts = vietnamParts(value); return parts ? `${parts.hm} ${parts.dm}` : ''; };

/** Seconds left before an ISO time, never below zero. */
export const secondsLeft = (iso: string | undefined, now = Date.now()) => (iso ? Math.max(0, Math.round((Date.parse(iso) - now) / 1000)) : 0);
export const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
/** A desk scanner may add whitespace or a newline; the BE token is 43 url-safe characters. */
export const cleanScannedCode = (value: string) => String(value || '').trim();
export const staffName = (person?: Person) => (person?.fullName || (person?.email ? String(person.email).split('@')[0] : ''));
export const visitClasses = (visit: Visit) => (visit.classRegistrationIds || []).map(item => item?.classId?.name).filter(Boolean).join(', ');
