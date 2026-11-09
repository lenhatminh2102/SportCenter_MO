import { Platform } from 'react-native';
import { request } from './api';
export type ScheduleFile = { uri: string; name: string; size?: number; mimeType?: string; file?: File };
export type ImportResult = { totalRows: number; successCount: number; errorCount: number; errors: { row: number; message: string }[] };
export function validateScheduleFile(file: ScheduleFile) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Chọn tệp Excel .xlsx.');
  if (file.size !== undefined && file.size > 5 * 1024 * 1024) throw new Error('Tệp tối đa 5 MB.');
}
export function importSchedules(token: string, file: ScheduleFile) {
  validateScheduleFile(file);
  const formData = new FormData();
  if (Platform.OS === 'web') {
    if (!file.file) throw new Error('Không đọc được tệp. Vui lòng chọn lại.');
    formData.append('file', file.file, file.name);
  } else formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as unknown as Blob);
  return request<ImportResult>('/api/schedules/import', { token, formData });
}
