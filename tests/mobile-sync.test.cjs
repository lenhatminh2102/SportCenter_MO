const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const context = { exports: {}, require: name => dependencies[name] };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
}
const COURSE = '6af3466f100ea5b2b5b88eb6';

test('activity log rows read as sentences, old and new formats alike', () => {
  const log = load('src/utils/activity-log.ts');
  assert.equal(log.describeLog({ method: 'PUT', path: `/api/courses/${COURSE}` }).sentence, 'Cập nhật khóa học');
  assert.equal(log.describeLog({ action: `Update /api/courses/${COURSE}` }).sentence, 'Cập nhật khóa học');
  assert.equal(log.describeLog({ action: 'Create /api/manager/catalog-import' }).sentence, 'Nhập danh mục khóa học từ Excel');
  const paid = log.describeLog({ method: 'POST', path: `/api/payments/${COURSE}/record-payment` });
  assert.equal(paid.sentence, 'Ghi nhận thanh toán tại quầy');
  assert.equal(paid.sensitive, true);
  assert.equal(log.describeLog({ method: 'PUT', path: '/api/manager/role-access/COACH' }).sentence, 'Thay đổi quyền của vai trò');
  assert.equal(log.describeLog({ method: 'DELETE', path: `/api/classes/${COURSE}` }).sensitive, true);
  assert.equal(log.describeLog({ action: 'Kiểm kê phòng tập' }).sentence, 'Kiểm kê phòng tập');
  assert.equal(log.actorLabel({ userId: { email: 'tuan@example.com', role: 'CENTER_MANAGER' } }), 'tuan · Quản lý');
});

test('team report overview becomes daily rows with zeros for quiet days', () => {
  const manager = load('src/services/manager.ts', { './api': { request: async () => ({}) } });
  const report = manager.toManagerReport({
    members: { total: 8, newInPeriod: 2, series: [{ period: '2026-11-02', count: 2 }] },
    registrations: { byStatusInPeriod: { CONFIRMED: 3 }, series: [{ period: '2026-11-02', count: 3 }] },
    revenue: { total: 600000, classes: 500000, memberships: 100000, series: [{ period: '2026-11-03', total: 600000, transactions: 2 }] },
  }, '2026-11-01', '2026-11-03');
  assert.deepEqual(Array.from(report.daily, day => day.date), ['2026-11-01', '2026-11-02', '2026-11-03']);
  assert.equal(report.daily[1].registrations, 3);
  assert.equal(report.daily[2].revenue, 600000);
  assert.equal(report.summary.successfulPayments, 2);
  assert.equal(report.summary.registrations.PENDING_PAYMENT, 0);
  assert.equal(report.summary.membershipRevenue, 100000);
});
