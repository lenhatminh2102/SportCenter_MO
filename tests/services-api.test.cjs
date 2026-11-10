const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function loadService(name, fetch = async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: [] }) })) {
  const cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const context = { exports: {}, fetch, URL, FormData, AbortController, setTimeout, clearTimeout, TypeError, process: { env: {} }, require: dep => dep === 'react-native' ? { Platform: { OS: 'web' } } : load(dep.startsWith('@/') ? 'src/' + dep.slice(2) + '.ts' : path.posix.normalize(path.posix.join(path.posix.dirname(file), dep + '.ts'))) };
    cache[file] = context.exports;
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
    return context.exports;
  }
  return load(`src/services/${name}.ts`);
}
const cases = [
  ['staff', 'staffApi', 'list', [], '/staff/accounts', 'GET', undefined],
  ['staff', 'staffApi', 'update', ['a/b', { role: 'COACH', subjectId: 'sport', status: 'INACTIVE' }], '/staff/accounts/a%2Fb', 'PATCH', { role: 'COACH', subjectId: 'sport', status: 'INACTIVE' }],
  ['manager', 'managerApi', 'report', ['2026-11-01', '2026-11-30'], '/manager/reports?from=2026-11-01&to=2026-11-30', 'GET', undefined],
  ['manager', 'managerApi', 'listPlans', [], '/manager/membership-plans', 'GET', undefined],
  ['manager', 'managerApi', 'createPlan', [{ name: 'Tháng', price: 400000, durationDays: 30, status: 'ACTIVE' }], '/manager/membership-plans', 'POST', { name: 'Tháng', price: 400000, durationDays: 30, status: 'ACTIVE' }],
  ['manager', 'managerApi', 'updatePlan', ['a/b', { status: 'INACTIVE' }], '/manager/membership-plans/a%2Fb', 'PATCH', { status: 'INACTIVE' }],
  ['manager', 'managerApi', 'getMembership', ['a/b'], '/manager/members/a%2Fb/membership', 'GET', undefined],
  ['manager', 'managerApi', 'assignMembership', ['a/b', 'plan'], '/manager/members/a%2Fb/membership', 'POST', { planId: 'plan' }],
  ['manager', 'managerApi', 'renewMembership', ['a/b', '2026-11-30T10:00:00.000Z'], '/manager/members/a%2Fb/membership/renew', 'POST', { expectedExpiresAt: '2026-11-30T10:00:00.000Z' }],
  ['manager', 'managerApi', 'getRoleAccess', [], '/manager/role-access', 'GET', undefined],
  ['manager', 'managerApi', 'updateRoleAccess', ['COACH', []], '/manager/role-access/COACH', 'PUT', { disabled: [] }],
  ['notifications', 'notificationsApi', 'my', [], '/notifications/my', 'GET', undefined],
  ['operations', 'attendancesApi', 'my', [], '/attendances/my', 'GET', undefined],
  ['operations', 'lessonsApi', 'byClass', ['a/b'], '/lessons/class/a%2Fb', 'GET', undefined],
  ['homeworks', 'homeworksApi', 'my', [], '/homeworks/my', 'GET', undefined],
  ['homeworks', 'homeworksApi', 'create', [{ classId: 'c', title: 'Practice', description: 'Run', attachments: ['https://example.com'] }], '/homeworks', 'POST', { classId: 'c', title: 'Practice', description: 'Run', attachments: ['https://example.com'] }],
  ['members', 'membersApi', 'frontDesk', [{ fullName: ' An ', phone: '090 123 4567', goal: ' Fit ', level: 'BEGINNER' }, ' AN@EXAMPLE.COM ', 'secret123'], '/members/front-desk', 'POST', { fullName: 'An', phone: '0901234567', goal: 'Fit', level: 'BEGINNER', email: 'an@example.com', password: 'secret123' }],
  ['notifications', 'notificationsApi', 'create', [{ userId: 'u', title: ' News ', message: ' Hello ' }], '/notifications', 'POST', { userId: 'u', title: 'News', message: 'Hello' }],
  ['support', 'supportApi', 'list', [], '/support-requests', 'GET', undefined],
  ['support', 'supportApi', 'create', ['m', ' Help '], '/support-requests', 'POST', { memberId: 'm', message: 'Help' }],
  ['support', 'supportApi', 'update', ['a/b', 'RESOLVED'], '/support-requests/a%2Fb/status', 'PUT', { status: 'RESOLVED' }],
  ['payments', 'paymentsApi', 'status', ['a/b'], '/payments/a%2Fb/status', 'GET', undefined],
  ['payments', 'paymentsApi', 'record', ['a/b'], '/payments/a%2Fb/record-payment', 'POST', {}],
  ['payments', 'paymentsApi', 'list', [], '/payments', 'GET', undefined],
  ['payments', 'paymentsApi', 'create', ['r', 'ONLINE'], '/payments', 'POST', { classRegistrationId: 'r', paymentMethod: 'ONLINE' }],
  ['payments', 'paymentsApi', 'update', ['a/b', 'CASH'], '/payments/a%2Fb', 'PUT', { paymentMethod: 'CASH' }],
  ['payments', 'paymentsApi', 'vnpay', ['p'], '/payments/p/vnpay', 'POST', {}],
  ['payments', 'paymentsApi', 'simulate', ['p', 'FAILED'], '/payments/p/simulate', 'POST', { status: 'FAILED' }],
  ['operations', 'coachesApi', 'me', [], '/coaches/me', 'GET', undefined],
  ['operations', 'coachesApi', 'myStudents', [], '/coaches/my-students', 'GET', undefined],
  ['operations', 'schedulesApi', 'coachMy', [], '/schedules/coach/my', 'GET', undefined],
  ['coach-teaching', 'coachAttendanceApi', 'create', ['m', 's', 'PRESENT'], '/attendances/coach', 'POST', { memberId: 'm', scheduleId: 's', status: 'PRESENT' }],
  ['coach-teaching', 'coachAttendanceApi', 'bySchedule', ['s/id'], '/attendances/schedule/s%2Fid', 'GET', undefined],
  ['rooms', 'roomsApi', 'get', ['a/b'], '/rooms/a%2Fb', 'GET', undefined],
  ['staff', 'staffApi', 'createAccount', [{ email: ' HLV@Center.VN ', password: 'secret1', role: 'COACH', fullName: ' Minh ', phone: '090 123 4567', subjectId: 's' }], '/staff/accounts', 'POST', { email: 'hlv@center.vn', password: 'secret1', role: 'COACH', fullName: 'Minh', phone: '0901234567', subjectId: 's' }],
  ['staff', 'staffApi', 'createAccount', [{ email: 'le@center.vn', password: 'secret1', role: 'RECEPTIONIST', fullName: 'Lan', phone: '0901234567', subjectId: 's' }], '/staff/accounts', 'POST', { email: 'le@center.vn', password: 'secret1', role: 'RECEPTIONIST', fullName: 'Lan', phone: '0901234567' }],
];
test('receipt authenticates with a header and reads HTML instead of a JSON envelope', async () => {
  const { paymentsApi } = loadService('payments', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/payments/a%2Fb/receipt');
    assert.equal(options.headers.Authorization, 'Bearer secret');
    return { ok: true, status: 200, headers: { get: () => 'text/html; charset=utf-8' }, text: async () => '<table>receipt</table>' };
  });
  assert.equal(await paymentsApi.receipt('secret', 'a/b'), '<table>receipt</table>');
});
test('receipt rejection preserves backend errors', async () => {
  const { paymentsApi } = loadService('payments', async () => ({ ok: false, status: 409, json: async () => ({ message: 'Only successful payments have receipts' }) }));
  await assert.rejects(paymentsApi.receipt('token', 'pending'), /Only successful payments/);
});
test('Excel import sends a multipart file with authorization and lets fetch set the boundary', async () => {
  const file = new File(['workbook'], 'schedule.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const { importSchedules } = loadService('schedule-import', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/schedules/import');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer token');
    assert.equal(options.headers['Content-Type'], undefined);
    assert.equal(options.body.get('file').name, 'schedule.xlsx');
    return { ok: true, status: 200, json: async () => ({ success: true, data: { successCount: 1, errorCount: 1, errors: [{ row: 3, message: 'Conflict' }] } }) };
  });
  const result = await importSchedules('token', { uri: 'blob:test', name: file.name, size: file.size, file });
  assert.equal(result.successCount, 1); assert.equal(result.errors[0].row, 3);
});
test('Excel import rejects unsupported extensions and oversized files before uploading', () => {
  const { validateScheduleFile } = loadService('schedule-import');
  assert.throws(() => validateScheduleFile({ name: 'file.csv' }), /xlsx/);
  assert.throws(() => validateScheduleFile({ name: 'file.xlsx', size: 5 * 1024 * 1024 + 1 }), /5 MB/);
});
test('receipt displays escaped database values as text and rejects unexpected markup', () => {
  const { receiptRows } = loadService('../utils/payment-receipt');
  const rows = receiptRows('<table><tr><td>Hội viên</td><td>A &amp; B &lt;img&gt;</td></tr><tr><td>Tổng tiền</td><td><strong>500 ₫</strong></td></tr></table>');
  assert.equal(rows[0][1], 'A & B <img>');
  assert.equal(rows[1][1], '500 ₫');
  assert.throws(() => receiptRows('<h1>Unexpected page</h1>'));
});
for (const [service, api, method, args, suffix, verb, body] of cases) test(`${service}.${method} sends correct auth and payload`, async () => {
  const module = loadService(service, async (url, options) => {
    assert.equal(url, `http://localhost:5000/api${suffix}`); assert.equal(options.method, verb); assert.equal(options.headers.Authorization, 'Bearer token');
    assert.deepEqual(options.body ? JSON.parse(options.body) : undefined, body);
    return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) };
  });
  await module[api][method]('token', ...args);
});
test('notification and support ownership exclude foreign or missing references', () => {
  const n = loadService('notifications'); const s = loadService('support');
  assert.equal(n.ownNotifications([{ userId: { _id: 'u' } }, { userId: 'other' }, {}], 'u').length, 1);
  assert.equal(s.ownSupport([{ memberId: 'm' }, { memberId: { id: 'other' } }, {}], 'm').length, 1);
  assert.equal(n.ownNotifications([{}], '').length, 0); assert.equal(s.ownSupport([{}], '').length, 0);
  assert.equal(s.canResolveSupport('COACH'), false); assert.equal(s.canResolveSupport('RECEPTIONIST'), true);
});
test('payment ownership resolves populated and unpopulated registrations', () => {
  const p = loadService('payments');
  const items = [{ classRegistrationId: 'r' }, { classRegistrationId: { _id: 's', memberId: { _id: 'm' } } }, { classRegistrationId: 'other' }, {}];
  assert.equal(p.ownPayments(items, [{ _id: 'r', memberId: 'm' }], 'm').length, 2);
  assert.equal(p.ownPayments(items, [], '').length, 0);
  assert.equal(p.canManagePayments('COACH'), false);
});
test('checkout accepts only supported HTTPS payment hosts', () => {
  const { validatePaymentUrl } = loadService('payments');
  assert.ok(validatePaymentUrl('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?a=1'));
  assert.ok(validatePaymentUrl('https://pay.payos.vn/web/example'));
  assert.throws(() => validatePaymentUrl('https://pay.payos.vn.example.com/web/example'));
  for (const url of ['http://sandbox.vnpayment.vn', 'https://sandbox.vnpayment.vn.evil.com', 'javascript:alert(1)', 'https://user:pass@pay.vnpay.vn', 'https://example.com']) assert.throws(() => validatePaymentUrl(url));
});
test('server payment rejection does not become client success', async () => {
  const p = loadService('payments', async () => ({ ok: false, status: 403, json: async () => ({ success: false, message: 'Mock payment is disabled' }) }));
  await assert.rejects(p.paymentsApi.simulate('token', 'p', 'SUCCESS'), /Mock payment is disabled/);
});

test('payment shortcut reuses pending requests and excludes already charged registrations', () => {
  const p = loadService('payments');
  const payments = [{ _id: 'p', classRegistrationId: { _id: 'r' }, status: 'PENDING' }, { _id: 'old', classRegistrationId: 'retry', status: 'FAILED' }, { _id: 'paid', classRegistrationId: 'paid-r', status: 'SUCCESS' }];
  assert.equal(p.pendingPaymentForRegistration(payments, 'r')._id, 'p');
  assert.equal(p.pendingPaymentForRegistration(payments, 'retry'), undefined);
  assert.equal(p.pendingPaymentForRegistration(payments, undefined), undefined);
  const eligible = p.payableRegistrations([{ _id: 'r', status: 'PENDING_PAYMENT' }, { _id: 'retry', status: 'PENDING_PAYMENT' }, { _id: 'cancelled', status: 'CANCELLED' }, { _id: 'paid-r', status: 'PENDING_PAYMENT' }], payments);
  assert.deepEqual(Array.from(eligible, item => item._id), ['retry']);
});
test('member homepage scopes account data and tolerates one unavailable dataset', async () => {
  const responses = {
    '/api/members/me': { _id: 'm', fullName: 'Test Member' },
    '/api/classes': [{ _id: 'c', name: 'Yoga' }],
    '/api/class-registrations': [{ _id: 'r', memberId: 'm', status: 'PENDING_PAYMENT' }, { _id: 'foreign', memberId: 'other', status: 'CONFIRMED' }],
    '/api/payments': [{ classRegistrationId: 'r', status: 'PENDING' }, { classRegistrationId: 'foreign', status: 'PENDING' }],
  };
  const home = loadService('member-home', async url => {
    const path = new URL(url).pathname;
    if (path === '/api/schedules/my') return { ok: false, status: 500, json: async () => ({ success: false, message: 'Schedule unavailable' }) };
    return { ok: true, status: 200, json: async () => ({ success: true, data: responses[path] }) };
  });
  const data = await home.loadMemberHome('token');
  assert.equal(data.registrations.length, 1); assert.equal(data.payments.length, 1);
  assert.equal(data.schedules, null); assert.equal(data.classes.length, 1); assert.equal(data.errors.length, 1);
});
test('new member without profile can browse classes without loading personal billing', async () => {
  const calls = [];
  const home = loadService('member-home', async url => {
    const path = new URL(url).pathname; calls.push(path);
    if (path === '/api/members/me') return { ok: false, status: 404, json: async () => ({ success: false, message: 'No profile' }) };
    return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) };
  });
  const data = await home.loadMemberHome('token');
  assert.equal(data.profileMissing, true); assert.equal(data.errors.length, 0); assert.equal(data.classes.length, 0);
  assert.equal(data.payments, null); assert.equal(calls.includes('/api/payments'), false);
  assert.equal(calls.includes('/api/notifications/my'), false);
});
test('member upcoming sessions exclude past and cancelled appointments in Bangkok time', () => {
  const { upcomingMemberSessions } = loadService('member-home');
  const items = [{ _id: 'past', date: '2026-10-17', startTime: '08:00', status: 'SCHEDULED' }, { _id: 'next', date: '2026-10-17', startTime: '10:00', status: 'SCHEDULED' }, { _id: 'cancel', date: '2026-10-18', startTime: '10:00', status: 'CANCELLED' }];
  assert.deepEqual(Array.from(upcomingMemberSessions(items, new Date('2026-10-17T02:00:00Z')), item => item._id), ['next']);
});

test('role workflows keep reception operations separate from coach teaching and manager setup', () => {
  const scope = loadService('../utils/role-workflows');
  assert.equal(scope.canReadResource('activity-logs', 'MEMBER'), false);
  assert.equal(scope.canReadResource('workout-plans', 'RECEPTIONIST'), false);
  assert.equal(scope.canReadResource('attendances', 'RECEPTIONIST'), true);
  assert.equal(scope.canReadResource('classes', 'COACH'), true);
  const records = [{ classId: 'own', memberId: 'm' }, { classId: 'other', memberId: 'other-m' }];
  assert.equal(scope.scopeCoachRecords('attendances', records, [{ _id: 'own' }], []).length, 1);
  assert.equal(scope.scopeCoachRecords('lesson-progress', records, [], [{ member: { _id: 'm' } }]).length, 1);
  assert.throws(() => scope.assertCoachAssignment({ classId: 'other', memberId: 'm' }, 'coach', [{ _id: 'own', coachId: 'coach' }], [{ member: 'm', class: 'own' }]));
  assert.throws(() => scope.assertCoachAssignment({ classId: 'own', memberId: 'foreign' }, 'coach', [{ _id: 'own', coachId: 'coach' }], [{ member: 'm', class: 'own' }]));
});
test('enrollment saves only after matching schedule confirmation and uses the correct member', async () => {
  let posted;
  const schedule = { _id: 's', classId: 'c', date: '2099-10-17', startTime: '08:00', endTime: '09:00', roomId: 'room', status: 'SCHEDULED' };
  const service = loadService('enrollment', async (url, options) => {
    const path = new URL(url).pathname;
    if (options.method === 'POST') { posted = JSON.parse(options.body); return { ok: true, status: 201, json: async () => ({ success: true, data: { _id: 'r', ...posted, status: 'PENDING_PAYMENT' } }) }; }
    const data = { '/api/class-registrations': [], '/api/classes': [{ _id: 'c', courseId: 'course' }], '/api/courses': [{ _id: 'course', pricing: { personal: 900000, group: 500000 }, status: 'ACTIVE' }], '/api/schedules': [schedule] }[path];
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  });
  const result = await service.saveEnrollment('token', { classId: 'c', memberId: 'm', confirmedSchedule: 's|2099-10-17|08:00|09:00|room' });
  assert.deepEqual(posted, { classId: 'c', memberId: 'm' }); assert.equal(result.status, 'PENDING_PAYMENT');
});
test('changed or missing schedules block registration instead of submitting stale choices', async () => {
  let writes = 0;
  const service = loadService('enrollment', async (url, options) => {
    if (options.method === 'POST') writes++;
    const data = { '/api/class-registrations': [], '/api/classes': [{ _id: 'c', courseId: 'course' }], '/api/courses': [{ _id: 'course', pricing: { personal: 900000, group: 500000 }, status: 'ACTIVE' }], '/api/schedules': [] }[new URL(url).pathname];
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  });
  await assert.rejects(service.saveEnrollment('token', { classId: 'c', memberId: 'm', confirmedSchedule: 'old' }), error => error instanceof service.ScheduleChangedError);
  assert.equal(writes, 0);
});
test('existing pending registration resumes but confirmed/cancelled registrations are never recreated', async () => {
  for (const status of ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED']) {
    let writes = 0;
    const service = loadService('enrollment', async (url, options) => {
      if (options.method === 'POST') writes++;
      return { ok: true, status: 200, json: async () => ({ success: true, data: [{ _id: 'r', classId: 'c', memberId: 'm', status }] }) };
    });
    const result = service.saveEnrollment('token', { classId: 'c', memberId: 'm', confirmedSchedule: 'unused' });
    if (status === 'PENDING_PAYMENT') assert.equal((await result)._id, 'r'); else await assert.rejects(result);
    assert.equal(writes, 0);
  }
});

test('enrollment detects overlapping confirmed classes but allows adjacent sessions', () => {
  const flow = loadService('../utils/enrollment');
  const sessions = [{ _id: 'selected', classId: 'new', date: '2099-10-17', startTime: '08:00', endTime: '09:00', status: 'SCHEDULED' }, { _id: 'booked', classId: 'old', date: '2099-10-17', startTime: '08:30', endTime: '09:30', status: 'SCHEDULED' }];
  const registrations = [{ memberId: 'm', classId: 'old', status: 'CONFIRMED' }];
  assert.equal(flow.enrollmentConflicts(sessions, registrations, 'new', 'm').length, 1);
  sessions[1].startTime = '09:00';
  assert.equal(flow.enrollmentConflicts(sessions, registrations, 'new', 'm').length, 0);
  sessions[1].startTime = '08:30'; registrations[0].status = 'PENDING_PAYMENT';
  assert.equal(flow.enrollmentConflicts(sessions, registrations, 'new', 'm').length, 0);
});

test('coach roster shows pending and confirmed names only for assigned classes', () => {
  const { buildCoachRoster, coachStudentName } = loadService('../utils/coach-roster');
  const classes = [{ _id: 'own', name: 'Yoga', coachId: 'coach' }, { _id: 'foreign', name: 'Boxing', coachId: 'other' }];
  const rows = buildCoachRoster([
    { _id: 'new', classId: 'own', memberId: { _id: 'm1', fullName: 'Nguyễn An', phone: '0901234567' }, status: 'PENDING_PAYMENT', registeredAt: '2026-10-17' },
    { _id: 'paid', classId: { _id: 'own' }, memberId: { _id: 'm2', fullName: 'Trần Bình' }, status: 'CONFIRMED', registeredAt: '2026-10-16' },
    { _id: 'hidden', classId: 'foreign', memberId: { _id: 'm3', fullName: 'Foreign' }, status: 'PENDING_PAYMENT' },
    { _id: 'cancelled', classId: 'own', memberId: { _id: 'm4', fullName: 'Cancelled' }, status: 'CANCELLED' },
  ], classes, 'coach');
  assert.equal(rows.length, 2); assert.equal(coachStudentName(rows[0]), 'Nguyễn An');
  assert.equal(rows[0].status, 'PENDING_PAYMENT'); assert.equal(coachStudentName(rows[1]), 'Trần Bình');
  assert.equal(buildCoachRoster([], classes, '').length, 0);
});
test('coach roster counts repeat students by member and avoids exposing raw IDs as names', () => {
  const { buildCoachRoster, coachStudentName } = loadService('../utils/coach-roster');
  const rows = buildCoachRoster([{ _id: 'a', classId: 'a', memberId: 'm', status: 'PENDING_PAYMENT' }, { _id: 'b', classId: 'b', memberId: { _id: 'm', fullName: 'Member' }, status: 'CONFIRMED' }], [{ _id: 'a', coachId: 'c' }, { _id: 'b', coachId: 'c' }], 'c');
  assert.equal(rows.length, 2); assert.equal(new Set(rows.map(item => item.memberId)).size, 1);
  assert.equal(coachStudentName(rows[0]), 'Chưa tải được tên hội viên');
});

test('coach lessons and subject information follow assigned class/course relations', () => {
  const scope = loadService('../utils/coach-teaching');
  const classes = [{ _id: 'c', subjectId: 'badminton', courseId: { _id: 'badminton-course' } }];
  const paths = [{ _id: 'badminton-path', courseId: 'badminton-course' }, { _id: 'yoga-path', courseId: 'yoga-course' }];
  assert.deepEqual(Array.from(scope.scopeTeachingResources('lessons', [{ _id: 'badminton-lesson', learningPathId: { _id: 'badminton-path' } }, { _id: 'yoga-lesson', learningPathId: 'yoga-path' }], classes, paths), item => item._id), ['badminton-lesson']);
  assert.equal(scope.scopeTeachingResources('subjects', [{ _id: 'badminton' }, { _id: 'yoga' }], classes, paths).length, 1);
  assert.equal(scope.scopeTeachingResources('courses', [{ _id: 'badminton-course' }, { _id: 'yoga-course' }], classes, paths).length, 1);
  assert.equal(scope.scopeTeachingResources('learning-paths', paths, classes, paths).length, 1);
});
test('attendance schedule choices match selected class and day and exclude cancellations', () => {
  const { classSessions, attendanceMembers } = loadService('../utils/coach-teaching');
  const schedules = [{ _id: 'valid', classId: { _id: 'c' }, date: '2026-10-17T00:00:00Z', status: 'SCHEDULED', startTime: '08:00' }, { _id: 'wrong-class', classId: 'other', date: '2026-10-17', status: 'SCHEDULED' }, { _id: 'wrong-day', classId: 'c', date: '2026-10-18', status: 'SCHEDULED' }, { _id: 'cancelled', classId: 'c', date: '2026-10-17', status: 'CANCELLED' }];
  assert.deepEqual(Array.from(classSessions(schedules, 'c', '2026-10-17'), item => item._id), ['valid']);
  assert.equal(attendanceMembers([{ class: { _id: 'c' }, member: { _id: 'm' } }, { class: 'other', member: { _id: 'other-m' } }], 'c').length, 1);
});
test('coach staff accounts require a sport; receptionists do not', () => {
  const { validateStaffAccount } = loadService('staff');
  const ok = () => true;
  const base = { email: 'a@b.vn', password: 'secret1', fullName: 'Minh', phone: '0901234567' };
  assert.ok(validateStaffAccount({ ...base, role: 'COACH', subjectId: '' }, ok, ok).subjectId);
  assert.equal(Object.keys(validateStaffAccount({ ...base, role: 'COACH', subjectId: '507f1f77bcf86cd799439012' }, ok, ok)).length, 0);
  assert.equal(Object.keys(validateStaffAccount({ ...base, role: 'RECEPTIONIST' }, ok, ok)).length, 0);
  assert.ok(validateStaffAccount({ ...base, role: 'RECEPTIONIST', password: '123' }, ok, ok).password);
});
test('coach feedback reaches the whole class or one confirmed student as notifications', async () => {
  const posted = [];
  const feedback = loadService('feedback', async (url, options) => {
    posted.push(JSON.parse(options.body));
    return { ok: true, status: 201, json: async () => ({ success: true, data: {} }) };
  });
  const rows = [
    { class: { _id: 'c1' }, member: { _id: 'm1', userId: 'u1', fullName: 'An' } },
    { class: { _id: 'c1' }, member: { _id: 'm2', userId: { _id: 'u2' }, fullName: 'Bình' } },
    { class: { _id: 'c2' }, member: { _id: 'm3', userId: 'u3', fullName: 'Chi' } },
    { class: { _id: 'c1' }, member: { _id: 'm1', userId: 'u1', fullName: 'An' } },
  ];
  assert.deepEqual(Array.from(feedback.feedbackRecipients(rows, 'class', 'c1'), item => item.userId), ['u1', 'u2']);
  assert.deepEqual(Array.from(feedback.feedbackRecipients(rows, 'member', 'c1', 'm2'), item => item.userId), ['u2']);
  assert.equal(feedback.feedbackRecipients(rows, 'member', 'c1', 'm3').length, 0);
  const input = { target: 'class', classId: 'c1', className: 'Yoga sáng', content: ' Cả lớp tiến bộ tốt ', rating: 4 };
  assert.equal(feedback.validateFeedback(input), '');
  assert.ok(feedback.validateFeedback({ ...input, content: 'ok' }));
  assert.ok(feedback.validateFeedback({ ...input, target: 'member', memberId: '' }));
  assert.ok(feedback.validateFeedback({ ...input, rating: 6 }));
  const result = await feedback.sendFeedback('token', feedback.feedbackRecipients(rows, 'class', 'c1'), input);
  assert.equal(result.sent, 2);
  assert.deepEqual(posted.map(item => item.userId), ['u1', 'u2']);
  assert.equal(posted[0].title, 'Nhận xét từ HLV · Cả lớp · Yoga sáng');
  assert.equal(posted[0].message, 'Cả lớp tiến bộ tốt\nĐánh giá: 4/5');
  assert.equal(feedback.isFeedback({ title: posted[0].title }), true);
  assert.equal(feedback.isFeedback({ title: 'Bài tập mới' }), false);
});
test('schedule date input accepts Vietnamese and ISO formats and rejects impossible days', () => {
  const t = loadService('../utils/schedule-time');
  assert.equal(t.parseDateInput('16/11/2026', '2026-11-11'), '2026-11-16');
  assert.equal(t.parseDateInput('5-1-27', '2026-11-11'), '2027-01-05');
  assert.equal(t.parseDateInput('16/11', '2026-11-11'), '2026-11-16');
  assert.equal(t.parseDateInput('2026-11-16', '2026-11-11'), '2026-11-16');
  assert.equal(t.parseDateInput('31/02/2026', '2026-11-11'), '');
  assert.equal(t.parseDateInput('abc', '2026-11-11'), '');
  assert.equal(t.formatDateLabel('2026-11-16'), 'Thứ Hai, 16/11/2026');
  assert.deepEqual(Array.from(t.upcomingDays('2026-12-30', 3)), ['2026-12-30', '2026-12-31', '2027-01-01']);
});
test('schedule time input normalizes typing and computes session ends', () => {
  const t = loadService('../utils/schedule-time');
  for (const [input, expected] of [['1830', '18:30'], ['930', '09:30'], ['18', '18:00'], ['18h30', '18:30'], ['9:5', '09:05'], ['18.15', '18:15'], ['2400', ''], ['18:60', ''], ['x', '']]) assert.equal(t.normalizeTime(input), expected, input);
  assert.equal(t.addMinutes('18:00', 90), '19:30');
  assert.equal(t.addMinutes('23:30', 60), '23:59');
  assert.equal(t.durationLabel('18:00', '19:30'), '1 giờ 30 phút');
  assert.equal(t.durationLabel('18:00', '18:45'), '45 phút');
  assert.equal(t.durationLabel('18:00', '17:00'), '');
});
test('weekly repeat lists the next sessions and cycles lessons in order', () => {
  const t = loadService('../utils/schedule-time');
  assert.deepEqual(Array.from(t.repeatDates('2026-11-16', [1, 3], 5)), ['2026-11-16', '2026-11-18', '2026-11-23', '2026-11-25', '2026-11-30']);
  assert.deepEqual(Array.from(t.repeatDates('2026-11-17', [1], 2)), ['2026-11-23', '2026-11-30']);
  assert.equal(t.repeatDates('2026-11-16', [], 3).length, 0);
  const lessons = [{ _id: 'c', order: 3 }, { _id: 'a', order: 1 }, { _id: 'b', order: 2 }];
  assert.deepEqual(Array.from(t.cycleLessons(lessons, 'b', 5)), ['b', 'c', 'a', 'b', 'c']);
  assert.deepEqual(Array.from(t.cycleLessons(lessons, 'missing', 2)), ['missing', 'missing']);
});
test('coach account email comes from the staff directory or activity log', async () => {
  const responses = {
    '/api/staff/accounts': [{ _id: 'staff-coach', email: 'staff@center.vn' }],
    '/api/activity-logs': [{ userId: { _id: 'coach-user', email: 'hlv@center.vn', role: 'COACH' } }],
  };
  const { findUserEmail, emailFromRecords } = loadService('account-email', async url => ({ ok: true, status: 200, json: async () => ({ success: true, data: responses[new URL(url).pathname] }) }));
  assert.equal(await findUserEmail('token', 'staff-coach'), 'staff@center.vn');
  assert.equal(await findUserEmail('token', 'coach-user'), 'hlv@center.vn');
  assert.equal(await findUserEmail('token', 'nobody'), '');
  assert.equal(await findUserEmail('token', ''), '');
  assert.equal(emailFromRecords([{ userId: 'coach-user' }], 'coach-user'), '');
});
test('coach account email lookup falls back when the staff directory is forbidden', async () => {
  const { findUserEmail } = loadService('account-email', async url => new URL(url).pathname === '/api/staff/accounts'
    ? { ok: false, status: 403, json: async () => ({ success: false, message: 'Access denied' }) }
    : { ok: true, status: 200, json: async () => ({ success: true, data: [{ userId: { _id: 'u', email: 'a@b.vn' } }] }) });
  assert.equal(await findUserEmail('token', 'u'), 'a@b.vn');
});
test('a pending payment of a cancelled registration is shown as no longer valid', () => {
  const p = loadService('payments');
  const pending = { status: 'PENDING', amount: 5000 };
  assert.equal(p.isVoidedPayment(pending, { status: 'CANCELLED' }), true);
  assert.equal(p.isVoidedPayment(pending, { status: 'PENDING_PAYMENT' }), false);
  assert.equal(p.isVoidedPayment({ status: 'SUCCESS' }, { status: 'CANCELLED' }), false);
  assert.equal(p.isVoidedPayment(pending, undefined), false);
  assert.equal(p.paymentStatusLabel(pending, { status: 'CANCELLED' }), 'Không còn hiệu lực · đăng ký đã hủy');
  assert.equal(p.paymentStatusLabel(pending, { status: 'PENDING_PAYMENT' }), 'Chờ thanh toán');
  assert.equal(p.paymentStatusLabel({ status: 'SUCCESS' }), 'Thanh toán thành công');
});
test('staff reopen a cancelled registration back to pending payment with the stored class and member', async () => {
  const calls = [];
  let status = 'CANCELLED';
  const reopen = loadService('registration-reopen', async (url, options = {}) => {
    calls.push({ path: new URL(url).pathname, method: options.method || 'GET', body: options.body && JSON.parse(options.body) });
    if (options.method === 'PUT') return { ok: true, status: 200, json: async () => ({ success: true, data: { _id: 'r1', status: 'PENDING_PAYMENT' } }) };
    return { ok: true, status: 200, json: async () => ({ success: true, data: [{ _id: 'r1', status, classId: { _id: 'c1' }, memberId: { _id: 'm1' } }] }) };
  });
  assert.equal(reopen.canReopenRegistration('RECEPTIONIST'), true);
  assert.equal(reopen.canReopenRegistration('CENTER_MANAGER'), true);
  assert.equal(reopen.canReopenRegistration('MEMBER'), false);
  assert.equal(reopen.canReopenRegistration('COACH'), false);
  await reopen.reopenRegistration('token', 'r1');
  const put = calls.find(call => call.method === 'PUT');
  assert.equal(put.path, '/api/class-registrations/r1');
  assert.equal(JSON.stringify(put.body), JSON.stringify({ classId: 'c1', memberId: 'm1', status: 'PENDING_PAYMENT' }));
  status = 'CONFIRMED';
  await assert.rejects(reopen.reopenRegistration('token', 'r1'), /không còn ở trạng thái đã hủy/);
  await assert.rejects(reopen.reopenRegistration('token', 'missing'), /Không tìm thấy đăng ký/);
});
test('roll call saves only changed students: creates new marks and updates saved ones', () => {
  const r = loadService('../utils/roll-call');
  const students = [{ _id: 'a', fullName: 'An' }, { _id: 'b', fullName: 'Bình' }, { _id: 'c', fullName: 'Chi' }];
  const records = [{ _id: 'rec-a', memberId: { _id: 'a' }, status: 'PRESENT' }, { _id: 'rec-b', memberId: 'b', status: 'PRESENT' }];
  const marks = { a: 'PRESENT', b: 'ABSENT', c: 'PRESENT' };
  const changes = r.rollCallChanges(students, records, marks);
  assert.equal(JSON.stringify(changes), JSON.stringify([
    { memberId: 'b', name: 'Bình', status: 'ABSENT', recordId: 'rec-b' },
    { memberId: 'c', name: 'Chi', status: 'PRESENT' },
  ]));
  assert.equal(JSON.stringify(r.rollCallCounts(students, records, {})), JSON.stringify({ present: 2, absent: 0, unmarked: 1 }));
  assert.equal(JSON.stringify(r.rollCallCounts(students, records, marks)), JSON.stringify({ present: 2, absent: 1, unmarked: 0 }));
  assert.equal(r.rollCallChanges(students, records, {}).length, 0);
  assert.equal(r.currentStatus('c', r.savedAttendance(records), {}), '');
});

test('exercise suggestions follow sport, goal, level and history', () => {
  const { suggestExercises } = loadService('../utils/exercise-suggest');
  const first = suggestExercises({ subject: 'Bóng bàn', goal: 'Giảm cân, tăng sức bền', level: 'BEGINNER', history: { results: 0 } });
  assert.ok(first.text.includes('Kỹ thuật Bóng bàn'));
  assert.ok(first.text.includes('2 hiệp × 8–10 lần'));
  assert.ok(first.text.includes('đánh giá đầu vào'));
  assert.equal(JSON.stringify(first.focus), JSON.stringify(['Đốt mỡ, giảm cân', 'Tăng sức bền']));
  const later = suggestExercises({ subject: 'Yoga', goal: '', level: 'ADVANCED', history: { results: 4, lastResult: 'Giữ plank 60s', lastComment: 'Cần thở đều', sessions: 10, absences: 4 } });
  assert.ok(later.text.includes('4 hiệp × 12–15 lần'));
  assert.ok(later.text.includes('tăng khoảng 10%'));
  assert.ok(later.text.includes('Cần thở đều'));
  assert.ok(later.text.includes('vắng 4/10'));
  assert.equal(JSON.stringify(later.focus), JSON.stringify(['Thể lực chung']));
  assert.ok(suggestExercises({ subject: 'Boxing', goal: 'tăng cơ', level: 'INTERMEDIATE', forClass: true }).text.includes('cả lớp'));
});
test('a workout result can be tagged with the session it belongs to', () => {
  const { withSessionNote } = loadService('../utils/exercise-suggest');
  assert.equal(withSessionNote('Chạy 3 km', 'Buổi 16/11/2026 18:00–19:00 · Bài 1'), '[Buổi 16/11/2026 18:00–19:00 · Bài 1] Chạy 3 km');
  assert.equal(withSessionNote('Chạy 3 km', ''), 'Chạy 3 km');
});
