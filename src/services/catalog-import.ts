import { Platform } from 'react-native';
import { API_URL, request } from './api';
import { validateScheduleFile, type ScheduleFile } from './schedule-import';

export type CatalogCount = { create: number; update: number; skip: number; error: number };
export type CatalogReport = {
  dryRun: boolean; valid: boolean; imported: boolean;
  summary: { courses: CatalogCount; learningPaths: CatalogCount; classes: CatalogCount; lessons: CatalogCount };
  rows: { sheet: string; row: number; action: 'create' | 'update' | 'skip'; label: string }[];
  errors: { sheet: string; row: number; message: string }[];
};

export const CATALOG_SHEETS: { key: keyof CatalogReport['summary']; title: string; label: string; columns: string }[] = [
  { key: 'courses', title: 'Khoa hoc', label: 'Khóa học', columns: 'Mon · Ten khoa hoc · Hoc phi · Mo ta · Trang thai · Anh' },
  { key: 'learningPaths', title: 'Lo trinh', label: 'Lộ trình', columns: 'Khoa hoc · Ten lo trinh · Mo ta' },
  { key: 'classes', title: 'Lop hoc', label: 'Lớp học', columns: 'Ten lop · Khoa hoc · Email HLV' },
  { key: 'lessons', title: 'Bai hoc', label: 'Bài học', columns: 'Lop · Lo trinh · Thu tu · Ten bai · Noi dung · Video' },
];

/** Upload the workbook: dryRun checks every row without saving anything. */
export function importCatalog(token: string, file: ScheduleFile, dryRun: boolean) {
  validateScheduleFile(file);
  const formData = new FormData();
  if (Platform.OS === 'web') {
    if (!file.file) throw new Error('Không đọc được tệp. Vui lòng chọn lại.');
    formData.append('file', file.file, file.name);
  } else formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as unknown as Blob);
  return request<CatalogReport>(`/api/manager/catalog-import${dryRun ? '?dryRun=1' : ''}`, { token, formData });
}

/** Web only: save the template (sheets + current subjects and coaches) through the browser. */
export async function downloadCatalogTemplate(token: string) {
  const response = await fetch(`${API_URL}/api/manager/catalog-import/template`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Không tải được tệp mẫu (HTTP ${response.status}).`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url; link.download = 'mau-import-khoa-hoc.xlsx';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
