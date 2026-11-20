import { membersApi } from './members';
import { paymentsApi } from './payments';
import { supportApi } from './support';
import { classRegistrationsApi, schedulesApi, type Entity } from './operations';
import type { ReceptionBoard } from '@/utils/home-cards';

/** Receptionist home (web services/reception): each list loads on its own, failures are listed in `errors`. */
export async function loadReceptionBoard(token: string): Promise<ReceptionBoard> {
  const sources: [Exclude<keyof ReceptionBoard, 'errors'>, string, () => Promise<Entity[]>][] = [
    ['members', 'Hội viên', async () => (await membersApi.list(token)) as unknown as Entity[]],
    ['registrations', 'Đăng ký lớp', () => classRegistrationsApi.list(token)],
    ['payments', 'Thanh toán', () => paymentsApi.list(token)],
    ['support', 'Hỗ trợ', () => supportApi.list(token)],
    ['schedules', 'Lịch tập', () => schedulesApi.list(token)],
  ];
  const results = await Promise.allSettled(sources.map(([, , load]) => load()));
  const board: ReceptionBoard = { members: null, registrations: null, payments: null, support: null, schedules: null, errors: [] };
  results.forEach((result, index) => {
    const [key, label] = sources[index];
    if (result.status === 'fulfilled' && Array.isArray(result.value)) board[key] = result.value;
    else board.errors.push(`${label}: ${result.status === 'rejected' && result.reason instanceof Error ? result.reason.message : 'Không tải được dữ liệu.'}`);
  });
  return board;
}
