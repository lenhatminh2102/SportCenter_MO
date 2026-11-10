import { activityLogsApi, referenceId, type Entity } from './operations';
import { staffApi } from './staff';
export function emailFromRecords(records: Entity[], userId: string): string {
  for (const record of records) {
    const user = record.userId;
    if (user && typeof user === 'object' && referenceId(user) === userId && typeof (user as Entity).email === 'string') return String((user as Entity).email);
  }
  return '';
}
export async function findUserEmail(token: string, userId: string): Promise<string> {
  if (!userId) return '';
  try {
    const staff = await staffApi.list(token);
    const account = staff?.find(item => item._id === userId);
    if (account?.email) return account.email;
  } catch {
    // Older servers may only expose account references in existing records.
  }
  try {
    const logs = await activityLogsApi.list(token);
    return emailFromRecords(Array.isArray(logs) ? logs : [], userId);
  } catch {
    return '';
  }
}
