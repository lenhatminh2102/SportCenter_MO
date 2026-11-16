const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const context = { exports: {}, URL, require: name => dependencies[name] };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
}
const ref = value => typeof value === 'string' ? value : value?._id || '';
const filter = load('src/utils/subject-filter.ts', { '@/services/operations': { entityId: ref, referenceId: ref } });
const image = load('src/utils/image.ts');

const index = filter.buildSubjectIndex({
  subjects: [{ _id: 'yoga', name: 'Yoga' }, { _id: 'tt', name: 'Bóng bàn' }],
  courses: [{ _id: 'c1', subjectId: 'yoga' }, { _id: 'c2', subjectId: 'tt' }],
  classes: [{ _id: 'k1', courseId: 'c1', coachId: 'h1' }, { _id: 'k2', subjectId: { _id: 'tt', name: 'Bóng bàn' }, courseId: 'c2', coachId: 'h2' }],
  paths: [{ _id: 'p1', courseId: 'c1' }],
});

test('sport of a record follows class, course, path and coach links', () => {
  assert.equal(filter.subjectOf('classes', { _id: 'k1', courseId: 'c1' }, index), 'yoga');
  assert.equal(filter.subjectOf('schedules', { classId: 'k2' }, index), 'tt');
  assert.equal(filter.subjectOf('schedules', { classId: { _id: 'k9', subjectId: 'yoga' } }, index), 'yoga');
  assert.equal(filter.subjectOf('lessons', { learningPathId: 'p1' }, index), 'yoga');
  assert.equal(filter.subjectOf('workout-plans', { coachId: 'h2' }, index), 'tt');
  assert.equal(filter.subjectOf('schedules', { classId: 'unknown' }, index), '');
});

test('chips count each sport, most used first, unknown last', () => {
  const rows = [{ classId: 'k1' }, { classId: 'k2' }, { classId: 'k2' }, { classId: 'nope' }];
  assert.deepEqual(JSON.parse(JSON.stringify(filter.subjectCounts('schedules', rows, index))), [
    { id: 'tt', count: 2, name: 'Bóng bàn' }, { id: 'yoga', count: 1, name: 'Yoga' }, { id: '', count: 1, name: 'Chưa rõ môn' },
  ]);
  assert.equal(filter.wantedSubject('-'), '');
  assert.equal(filter.wantedSubject('yoga'), 'yoga');
});

test('course image links must be plain https', () => {
  assert.equal(image.safeImageUrl(' https://images.example.com/a.jpg '), 'https://images.example.com/a.jpg');
  assert.equal(image.safeImageUrl('http://images.example.com/a.jpg'), '');
  assert.equal(image.safeImageUrl('https://user:pw@images.example.com/a.jpg'), '');
  assert.equal(image.safeImageUrl('javascript:alert(1)'), '');
  assert.equal(image.safeImageUrl(42), '');
});
