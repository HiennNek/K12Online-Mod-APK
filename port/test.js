// Self-check for hook.js outside Frida: node port/test.js
const assert = require('assert');
const h = require('./agent/hook.js');

const choice = {
  questionIndex: 1,
  elementType: 'single',
  textTitle: '2 + 2 = ?',
  partTitle: 'Phần I',
  choices: {
    1: { answerTitle: 'A. 3', point: '0' },
    2: { answerTitle: 'B. 4', point: '0.5' },
  },
};

const report = h.buildReport([choice]);
assert.strictEqual(report.itemCount, 1);
assert.strictEqual(report.groups[0].questions[0].answer, 'B. 4');

// True/false uses point when present.
const tf = h.buildReport([{
  questionIndex: 2,
  elementType: 'truefalse',
  choices: { 1: { answerTitle: 'Mệnh đề 1', point: '1' }, 2: { answerTitle: 'Mệnh đề 2', point: '0' } },
}]);
assert.strictEqual(tf.groups[0].questions[0].answer, 'a. Đ  b. S');

// Short answer joins answerTextN in numeric order.
const sa = h.buildReport([{ questionIndex: 3, answerText2: 'b', answerText1: 'a' }]);
assert.strictEqual(sa.groups[0].questions[0].answer, 'ab');

// Web payload embedded in HTML.
const html = "<script>var cfg = {'LMS.Learning.Courseware.Exam', items: " +
  JSON.stringify([choice]) + '};</script>';
assert.strictEqual(h.extractReport(html).itemCount, 1);

// Plain JSON envelope, with the items nested.
assert.strictEqual(h.extractReport(JSON.stringify({ data: { items: [choice] } })).itemCount, 1);

// App API: section objects also carry elementType, the flat question list is
// what matters. Options are numbered by answerCode, not by array order.
const appPayload = {
  parts: [{ part: '1', elementType: 'Choice', numOfQuestion: '1', items: { 1: { id: '' } } }],
  items: [{
    questionIndex: 1,
    elementType: 'Choice',
    textTitle: 'Q',
    choices: [
      { answerCode: '2', point: '', answerTitle: '<p>wrong</p>' },
      { answerCode: '1', point: '1', answerTitle: '<p>right</p>' },
    ],
  }],
};
const appReport = h.extractReport(JSON.stringify(appPayload));
assert.strictEqual(appReport.itemCount, 1);
assert.strictEqual(appReport.groups[0].questions[0].answer, 'B. right');

const tfApp = h.extractReport(JSON.stringify({
  items: [{
    questionIndex: 2,
    elementType: 'OnlyTrueFalseFour',
    choices: [
      { answerCode: '2', answerTitle: 'false', questionTitle: 's2' },
      { answerCode: '1', answerTitle: 'true', questionTitle: 's1' },
    ],
  }],
}));
assert.strictEqual(tfApp.groups[0].questions[0].answer, 'a. S  b. \u0110');

// `pos` mirrors answerCode, so it must not reorder the choices.
const posApp = h.extractReport(JSON.stringify({
  items: [{
    questionIndex: 3,
    elementType: 'Choice',
    pos: ['1', '0'],
    choices: [
      { answerCode: '1', point: '1', answerTitle: '<p>right</p>' },
      { answerCode: '2', point: '', answerTitle: '<p>wrong</p>' },
    ],
  }],
}));
assert.strictEqual(posApp.groups[0].questions[0].answer, 'A. right');

// Reading group: the group's choices are sub-questions with their own options,
// and `answer` is the answerCode of the key option (array order = A, B, C, D).
const readingGroup = {
  questionIndex: 1,
  elementType: 'ReadAndAnswerQuestion',
  textTitle: 'Passage',
  choices: [
    { answerCode: '1', answer: '3', answerTitle: 'Question 7.', options: [
      { answerCode: 1, title: 'various' },
      { answerCode: 3, title: 'low' },
      { answerCode: 2, title: 'high' },
      { answerCode: 4, title: 'rich' },
    ] },
    { answerCode: '2', answer: '4', answerTitle: 'Question 8.', options: [
      { answerCode: 3, title: 'number' },
      { answerCode: 2, title: 'great deal of' },
      { answerCode: 1, title: 'variety' },
      { answerCode: 4, title: 'amount' },
    ] },
  ],
};
const groupReport = h.extractReport(JSON.stringify({ items: [readingGroup] }));
assert.strictEqual(groupReport.itemCount, 2);
assert.strictEqual(groupReport.groups[0].questions[0].answer, 'B. low');
assert.strictEqual(groupReport.groups[0].questions[1].answer, 'D. amount');
assert.deepStrictEqual(groupReport.groups[0].questions.map((q) => q.index), [1, 2]);

// PDF exams: the choices are just the letters, so the answer stays a letter.
const pdfReport = h.buildReport([{
  questionIndex: 1,
  elementType: 'Choice',
  choices: [
    { answerCode: '1', point: '1', answerTitle: 'A' },
    { answerCode: '2', point: '', answerTitle: 'B' },
    { answerCode: '3', point: '', answerTitle: 'C' },
    { answerCode: '4', point: '', answerTitle: 'D' },
  ],
}]);
assert.strictEqual(pdfReport.groups[0].questions[0].answer, 'A');
assert.deepStrictEqual(pdfReport.groups[0].questions[0].options.map((o) => o.text), ['', '', '', '']);

// Content-Length response split across reads.
const body = Buffer.from(JSON.stringify({ data: { items: [choice] } }));
const head = Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ' + body.length + '\r\n\r\n');
const full = Buffer.concat([head, body]);
h.streams['t1'] = { bytes: new Uint8Array(0) };
const mem = { readByteArray: (n) => full.buffer.slice(full.byteOffset, full.byteOffset + n) };
const half = Math.floor(full.length / 2);
h.pending.length = 0;
// feed() is not exported; drain() is, so drive the same state directly.
h.streams['t1'].bytes = new Uint8Array(full.buffer.slice(full.byteOffset, full.byteOffset + half));
h.drain('t1');
assert.strictEqual(h.pending.length, 0);
h.streams['t1'].bytes = new Uint8Array(full);
h.drain('t1');
assert.strictEqual(h.pending.length, 1);
assert.strictEqual(h.extractReport(h.utf8(h.pending[0].body)).itemCount, 1);
// Consumed bytes are dropped, so a second drain yields nothing new.
h.drain('t1');
assert.strictEqual(h.pending.length, 1);

// Chunked response.
const chunked = Buffer.from('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n' +
  body.length.toString(16) + '\r\n' + body.toString('binary') + '\r\n0\r\n\r\n', 'binary');
h.streams['t2'] = { bytes: new Uint8Array(chunked) };
h.pending.length = 0;
h.drain('t2');
assert.strictEqual(h.pending.length, 1);
assert.strictEqual(h.extractReport(h.utf8(h.pending[0].body)).itemCount, 1);

console.log('ok');
