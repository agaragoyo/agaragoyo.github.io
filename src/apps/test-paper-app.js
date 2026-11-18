// 가구 기믹: 시험지(F35). 주인이 자기에 대한 객관식 문제를 세 개까지 내 두면, 놀러 온 손님이 풀고 채점받아 점수를 본다.
// 버디미터 같은 친구 퀴즈와 '○○ 능력고사' 시험지처럼 정답은 주인이 정하고, 손님은 문제를 다 고른 뒤 한꺼번에 채점받는다.
// 채점하면 학교 시험지처럼 맞힌 문제 번호에 빨간 동그라미, 틀린 문제 번호에 빗금을 긋고 정답 보기에 동그라미를 친 뒤 위 칸에 점수를 적는다.
// 점수는 맞힌 수 ÷ 문제 수 × 100을 반올림한다(3문제면 0, 33, 67, 100점). 100점이면 "참 잘했어요" 도장을 찍는다.
// 채점한 시험지는 이 브라우저에 남아(STORAGE_QUIZ) 다시 열어도 그대로이고, 주인이 문제를 고치면 새 시험지가 된다.
// 짧은 링크나 이웃집으로 온 손님은 채점한 시험지의 "코르크 보드에 쪽지 남기기"로 점수를 남긴다(src/os.js의 openNoteDraft,
// 방에 코르크 보드가 있을 때만). 주인은 그 쪽지로 누가 몇 점을 받았는지 본다.
// 주인(내 컴퓨터)에게는 정답을 표시한 시험지와 문제 내기 칸이 있고 손님에게는 없다. 문제가 없는 시험지를 손님이 쓰면 아바타가 한마디 한다.
// 낸 문제는 집 상태의 likes['test-paper']에 저장되고 공유 링크에도 담긴다(src/likes.js). 손님 화면에도 뜨는 글이라 h()의 자식으로만 넣는다.
import { h, loadJSON, saveJSON, reduceMotion } from '../util.js';
import { openCloseup } from '../closeup.js';
import { LIMIT, setLike, isOwner } from '../likes.js';
import { STORAGE_QUIZ } from '../config.js';

const KEEP = 20; // 채점한 시험지를 기억해 두는 장 수. 넘으면 오래된 것부터 잊는다
const MARK_GAP = 280; // 채점할 때 문제마다 빨간 표시를 하나씩 긋는 간격(ms). 마지막 표시 뒤에 점수를 적는다

// 시험지 한 장을 가리키는 글. 주인 이름과 문제가 같으면 같은 시험지라서 주인이 문제를 고치면 새 시험지가 된다.
// 숫자로만 된 이름은 객체가 넣은 순서를 지키지 않아(오래된 것부터 잊을 수 없다) 앞에 q를 붙인다
function paperId(owner, quiz) {
  const text = JSON.stringify([owner, quiz]);
  let x = 0x811c9dc5; // FNV-1a 32비트
  for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 0x01000193);
  return `q${(x >>> 0).toString(36)}`;
}

// 이 브라우저가 채점한 시험지의 고른 답. 문제 수와 맞지 않거나 보기 밖을 가리키면 채점하지 않은 것으로 본다
function gradedPicks(id, quiz) {
  const picks = loadJSON(STORAGE_QUIZ)?.[id];
  return Array.isArray(picks) && picks.length === quiz.length
    && picks.every((p, i) => Number.isInteger(p) && p >= 0 && p < quiz[i].choices.length) ? picks : null;
}
function rememberPicks(id, picks) {
  const saved = loadJSON(STORAGE_QUIZ);
  const all = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  delete all[id]; // 다시 넣어 가장 최근 것으로 만든다
  all[id] = picks;
  const ids = Object.keys(all);
  for (const old of ids.slice(0, Math.max(0, ids.length - KEEP))) delete all[old];
  saveJSON(STORAGE_QUIZ, all);
}

export const scoreOf = (quiz, picks) => Math.round((quiz.filter((q, i) => picks[i] === q.answer).length / quiz.length) * 100);

// 원 안의 보기 번호. 원 숫자 글자(①) 대신 테두리로 그려 작은 글꼴(AgaUI)에 새 글자를 넣지 않는다(known-issues 77)
const num = n => h('span', { className: 'exam-num' }, String(n));

export function openTestPaperApp(os, app) {
  const owner = isOwner(os);
  const quiz = () => os.home.likes['test-paper'] || null;
  if (!owner && !quiz()) return os.say('적어 둔 문제가 없네.');

  return openCloseup(os, {
    key: app.id,
    title: app.title,
    className: 'exam-closeup',
    closeLabel: '내려놓기',
    closeTip: '바깥을 누르면 시험지를 내려놓습니다.',
    build(panel, cu) {
      const timers = [];

      // 시험지 한 장. mode: 'solve' 손님이 푸는 중, 'graded' 채점한 시험지, 'key' 주인이 보는 정답지
      // picks: 문제마다 고른 보기 번호(고르지 않았으면 null), tools: 아래 줄에 놓을 것
      function paper(mode, picks, tools) {
        const list = quiz();
        // 점수 칸. 주인이 보는 정답지에는 점수 칸 자리에 빨간 "정답지" 표시를 둔다
        const score = mode === 'key' ? h('div', { className: 'exam-key' }, '정답지') : h('div', { className: 'exam-score' }, h('span', {}, '점수'), h('b', {}));
        const items = list.map((q, i) => h('li', { className: 'exam-q', dataset: { at: i } },
          h('p', { className: 'exam-ask' }, h('span', { className: 'exam-no' }, `${i + 1}.`), h('span', { className: 'exam-ask-text' }, q.question)),
          h('div', { className: 'exam-choices' }, ...q.choices.map((c, j) => {
            const cls = `exam-choice${picks[i] === j ? ' picked' : ''}${mode === 'key' && j === q.answer ? ' answer' : ''}`;
            const parts = [num(j + 1), h('span', { className: 'exam-text' }, c)];
            return mode === 'solve'
              ? h('button', { type: 'button', className: cls, 'aria-pressed': String(picks[i] === j), onclick: () => pick(i, j) }, ...parts)
              : h('div', { className: cls }, ...parts);
          }))));
        return h('div', { className: `exam-paper ${mode}` },
          h('div', { className: 'exam-head' },
            h('div', {},
              h('h2', { className: 'exam-title' }, `${os.home.owner} 능력고사`),
              h('p', { className: 'exam-name' }, '이름', h('span', {}, mode === 'key' ? '' : os.ownName()))),
            score),
          h('ol', { className: 'exam-list' }, ...items),
          h('div', { className: 'exam-tools' }, ...tools));
      }

      // ---------- 손님 ----------
      let picks = [];
      function solve() {
        const id = paperId(os.home.owner, quiz());
        const done = gradedPicks(id, quiz());
        if (done) return graded(done, false);
        picks = quiz().map(() => null);
        const error = h('p', { className: 'exam-error', hidden: true });
        const submit = h('button', { type: 'button', className: 'btn', onclick: () => grade(id, error) }, '채점하기');
        panel.replaceChildren(paper('solve', picks, [error, submit]));
      }
      function pick(i, j) {
        picks[i] = j;
        const row = panel.querySelector(`.exam-q[data-at="${i}"]`);
        row.querySelectorAll('.exam-choice').forEach((b, k) => {
          b.classList.toggle('picked', k === j);
          b.setAttribute('aria-pressed', String(k === j));
        });
        panel.querySelector('.exam-error').hidden = true;
      }
      function grade(id, error) {
        const left = picks.findIndex(p => p == null);
        if (left >= 0) {
          error.textContent = '고르지 않은 문제가 있습니다. 모든 문제의 답을 골라 주세요.';
          error.hidden = false;
          panel.querySelector(`.exam-q[data-at="${left}"] .exam-choice`)?.focus();
          return;
        }
        rememberPicks(id, picks);
        graded(picks, !reduceMotion);
      }

      // 채점한 시험지. slow면 선생님이 채점하듯 문제마다 표시를 하나씩 긋고 마지막에 점수를 적는다
      function graded(answers, slow) {
        const list = quiz();
        const score = scoreOf(list, answers);
        // 미니게임에서 주인 기록을 넘었을 때(F34)와 같은 단추와 같은 쪽지 칸이다. 남길 말에 "시험지 67점"을 넣어 둔다
        const note = os.canNote()
          ? h('button', { type: 'button', className: 'btn', onclick: () => os.openNoteDraft(`시험지 ${score}점`) }, '코르크 보드에 쪽지 남기기')
          : null;
        const stamp = score === 100 ? h('span', { className: 'exam-stamp', role: 'img', 'aria-label': '참 잘했어요' }, h('span', {}, '참'), h('span', {}, '잘했어요')) : null;
        const sheet = paper('graded', answers, [stamp, note].filter(Boolean));
        panel.replaceChildren(sheet);
        const marks = list.map((q, i) => () => {
          const row = sheet.querySelector(`.exam-q[data-at="${i}"]`);
          const right = answers[i] === q.answer;
          row.classList.add(right ? 'right' : 'wrong');
          if (!right) row.querySelectorAll('.exam-choice')[q.answer].classList.add('answer');
        });
        const finish = () => {
          sheet.querySelector('.exam-score b').textContent = String(score);
          sheet.classList.add('scored');
        };
        if (!slow) {
          marks.forEach(f => f());
          finish();
          return;
        }
        sheet.classList.add('marking');
        marks.forEach((f, i) => timers.push(setTimeout(f, MARK_GAP * (i + 1))));
        timers.push(setTimeout(finish, MARK_GAP * (marks.length + 1)));
      }

      // ---------- 주인 ----------
      function answerKey() {
        const hint = h('p', { className: 'exam-hint' }, '손님에게는 정답 표시 없이 보입니다.');
        panel.replaceChildren(paper('key', quiz().map(() => null), [hint, h('button', { type: 'button', className: 'btn', onclick: form }, '고치기')]));
      }

      // 문제 내기와 고치기. 문제 칸 셋에 보기 칸 넷씩이고, 보기 앞의 동그라미(radio)로 정답을 고른다.
      // 빈 문제 칸과 빈 보기 칸은 빼고 저장한다(src/likes.js의 검사가 보기를 앞으로 당기고 정답 번호도 따라 옮긴다)
      function form() {
        const old = quiz();
        const rows = Array.from({ length: LIMIT.questions }, (_, i) => {
          const q = old?.[i];
          const ask = h('input', { type: 'text', maxLength: LIMIT.questionText, value: q?.question || '', 'aria-label': `${i + 1}번 문제`,
            placeholder: i === 0 ? '예: 내가 제일 좋아하는 아이돌은?' : '' });
          const choices = Array.from({ length: LIMIT.choices }, (_, j) => h('input', { type: 'text', maxLength: LIMIT.choiceText, value: q?.choices[j] || '',
            'aria-label': `${i + 1}번 문제의 ${j + 1}번 보기` }));
          const radios = choices.map((_, j) => h('input', { type: 'radio', name: `exam-answer-${i}`, value: String(j), checked: q?.answer === j,
            'aria-label': `${j + 1}번 보기가 정답` }));
          const box = h('fieldset', { className: 'exam-field' },
            h('legend', {}, `${i + 1}번 문제`),
            ask,
            h('div', { className: 'exam-field-choices' }, ...choices.map((c, j) => h('div', { className: 'exam-field-choice' },
              h('label', { className: 'exam-pick', title: '정답으로 고르기' }, radios[j], num(j + 1)), c))));
          return { box, ask, choices, radios };
        });
        const error = h('p', { className: 'like-error', hidden: true });
        const fail = (text, el) => {
          error.textContent = text;
          error.hidden = false;
          el.focus();
        };
        const submit = e => {
          e.preventDefault();
          const list = [];
          for (const [i, r] of rows.entries()) {
            const question = r.ask.value.trim();
            const filled = r.choices.filter(c => c.value.trim());
            if (!question && !filled.length) continue; // 비워 둔 문제 칸
            if (!question) return fail(`${i + 1}번 문제가 비어 있습니다. 문제를 써 주세요.`, r.ask);
            if (filled.length < 2) return fail(`${i + 1}번 문제의 보기가 모자랍니다. 보기를 두 개 이상 써 주세요.`, r.choices.find(c => !c.value.trim()));
            const answer = r.radios.findIndex(x => x.checked);
            if (answer < 0) return fail(`${i + 1}번 문제의 정답을 고르지 않았습니다. 정답인 보기 앞의 동그라미를 눌러 주세요.`, r.radios[0]);
            if (!r.choices[answer].value.trim()) return fail(`${i + 1}번 문제의 정답으로 고른 보기가 비어 있습니다. 그 보기를 써 주세요.`, r.choices[answer]);
            list.push({ question, choices: r.choices.map(c => c.value), answer });
          }
          if (!list.length) return fail('낸 문제가 없습니다. 문제를 하나 이상 써 주세요.', rows[0].ask);
          setLike(os, 'test-paper', list);
          answerKey();
        };
        panel.replaceChildren(h('form', { className: 'like-form like-card exam-form', onsubmit: submit },
          h('p', { className: 'like-card-head' }, old ? '문제 고치기' : '시험지 문제 내기'),
          h('p', {}, '나에 대한 문제를 세 개까지 내 보세요. 정답은 보기 앞의 동그라미로 고릅니다.'),
          ...rows.map(r => r.box),
          error,
          h('div', { className: 'link-row' },
            old ? h('button', { className: 'btn like-edit', type: 'button', onclick: () => { setLike(os, 'test-paper', null); form(); } }, '문제 지우기') : null,
            h('button', { className: 'btn', type: 'submit' }, old ? '고치기' : '문제 내기'),
            h('button', { className: 'btn', type: 'button', onclick: () => (quiz() ? answerKey() : cu.close()) }, '취소'))));
        setTimeout(() => rows[0].ask.focus(), 50);
      }

      if (!owner) solve();
      else if (quiz()) answerKey();
      else form(); // 문제가 없는 주인은 바로 내는 칸
      return () => timers.forEach(clearTimeout);
    },
  });
}
