// content.json 형식 검사. 사용법: node validate.mjs [content.json 경로]
// 앱이 받아들이는 조건보다 조금 더 엄격하게 본다. 문제가 있으면 목록을 출력하고 1로 끝난다.
import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? new URL('./content.json', import.meta.url).pathname;
const data = JSON.parse(readFileSync(path, 'utf8'));
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

// 이 날짜 이후에 추가한 문제는 출처(sources)가 있어야 한다. 그 전 32문제는 앱 개발 때 따로 확인했다.
const SOURCES_REQUIRED_AFTER = '2026-11-23';
const TYPES = ['meaning', 'blank', 'whatis', 'alive'];
const CATEGORIES = ['word', 'meme'];
const STATUSES = ['rising', 'hot', 'old'];
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isHttps = (s) => typeof s === 'string' && /^https:\/\/\S+$/.test(s);
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

if (!Array.isArray(data.questions)) err('questions', '배열이 아니에요');
const questions = Array.isArray(data.questions) ? data.questions : [];
const ids = new Set();
const terms = new Map();

questions.forEach((q, n) => {
  const at = `questions[${n}] ${q?.id ?? '(id 없음)'}`;
  if (!q || typeof q !== 'object') return err(at, '객체가 아니에요');
  if (!/^[a-z]\d{3,}$/.test(q.id ?? '')) err(at, 'id는 w001, m001 같은 모양이어야 해요');
  if (ids.has(q.id)) err(at, 'id가 겹쳐요');
  ids.add(q.id);
  if (!TYPES.includes(q.type)) err(at, `type은 ${TYPES.join('/')} 중 하나여야 해요`);
  if (!CATEGORIES.includes(q.category)) err(at, `category는 ${CATEGORIES.join('/')} 중 하나여야 해요`);
  if (!STATUSES.includes(q.status)) err(at, `status는 ${STATUSES.join('/')} 중 하나여야 해요`);
  // 같은 말을 다른 유형으로 내는 건 괜찮다 (예: 뜻 맞히기 + 살았나 죽었나). 같은 유형으로 두 번은 안 된다.
  const termKey = `${q.type}:${q.term}`;
  if (!nonEmpty(q.term)) err(at, 'term이 비어 있어요');
  else if (terms.has(termKey)) err(at, `"${q.term}"을 같은 유형으로 이미 ${terms.get(termKey)}에서 냈어요`);
  else terms.set(termKey, q.id);
  if (!nonEmpty(q.prompt)) err(at, 'prompt가 비어 있어요');
  if (q.context !== undefined && !nonEmpty(q.context)) err(at, 'context는 빼거나 내용을 넣어야 해요');
  if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5) err(at, '보기는 2~5개여야 해요');
  else {
    if (!q.options.every(nonEmpty)) err(at, '빈 보기가 있어요');
    if (new Set(q.options).size !== q.options.length) err(at, '같은 보기가 두 번 있어요');
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(at, 'answer가 보기 범위를 벗어나요');
  }
  if (!q.explain || !nonEmpty(q.explain.meaning)) err(at, 'explain.meaning이 비어 있어요');
  if (!isDate(q.addedAt)) err(at, 'addedAt은 YYYY-MM-DD 날짜여야 해요');
  if (q.sources !== undefined && (!Array.isArray(q.sources) || !q.sources.every(isHttps))) {
    err(at, 'sources는 https:// 주소 배열이어야 해요');
  }
  if (isDate(q.addedAt) && q.addedAt > SOURCES_REQUIRED_AFTER && !(Array.isArray(q.sources) && q.sources.length > 0)) {
    err(at, `${SOURCES_REQUIRED_AFTER} 이후 추가한 문제는 sources(출처 주소)가 있어야 해요`);
  }
});

if (questions.length < 5) err('questions', '앱은 5문제 미만이면 이 파일을 쓰지 않아요');

const w = data.issueWeek;
if (w !== null && w !== undefined) {
  if (typeof w.label !== 'string') err('issueWeek.label', '문자열이어야 해요');
  if (!Array.isArray(w.issues)) err('issueWeek.issues', '배열이어야 해요');
  else {
    if (w.issues.length > 0 && !nonEmpty(w.label)) err('issueWeek.label', '화제 카드가 있으면 주차 이름(예: 11월 4주차)이 필요해요');
    const issueIds = new Set();
    w.issues.forEach((i, n) => {
      const at = `issueWeek.issues[${n}] ${i?.id ?? '(id 없음)'}`;
      if (!nonEmpty(i?.id)) err(at, 'id가 비어 있어요');
      else if (issueIds.has(i.id)) err(at, 'id가 겹쳐요');
      issueIds.add(i?.id);
      if (!nonEmpty(i?.title)) err(at, 'title이 비어 있어요');
      if (!Array.isArray(i?.lines) || i.lines.length !== 3 || !i.lines.every(nonEmpty)) err(at, 'lines는 정확히 3줄이어야 해요');
      if (!nonEmpty(i?.sourceName)) err(at, 'sourceName이 비어 있어요');
      if (!isHttps(i?.sourceUrl)) err(at, 'sourceUrl은 https:// 주소여야 해요');
    });
  }
}

if (errors.length > 0) {
  console.error(`형식 오류 ${errors.length}개:\n` + errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log(`통과: 문제 ${questions.length}개, 화제 카드 ${w?.issues?.length ?? 0}개`);
