// The receipt endpoint returns HTML. Extract only table text; never execute server markup.
export function receiptRows(html: string): string[][] {
  const decode = (value: string) => value.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' })[name] || '').trim();
  const rows = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi), row => Array.from(row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi), cell => decode(cell[1]))).filter(row => row.length === 2);
  if (!rows.length) throw new Error('Không đọc được nội dung biên nhận. Vui lòng thử lại.');
  return rows;
}
