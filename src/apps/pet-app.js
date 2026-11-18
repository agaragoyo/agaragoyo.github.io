// 기본 앱: 펫(F30). 내 방에 사는 펫을 한 창에서 돌본다. 바탕화면과 시작 메뉴의 "펫"으로 연다(data/apps.js).
// 2026-11-18에 시작 메뉴의 펫 바꾸기 창(src/pet-picker.js)과 방의 오른쪽 단추 메뉴로 흩어져 있던 일을 이 창에 모았다.
// 다마고치, 닌텐독스, 네오펫의 펫 화면처럼 펫의 그림과 상태를 맨 위에 두고, 자주 하는 일(쓰다듬기, 할 일)을 그 아래에,
// 드물게 하는 일(종류와 색 바꾸기)을 맨 아래에 둔다. 닌텐독스가 배고픔을 숫자 대신 "배부름, 보통" 같은 말로 보이듯 하는 일은 문장으로 쓴다.
//   위     큰 그림(방의 펫처럼 숨 쉬고 깜박인다), 이름, 하는 일, 쓰다듬은 횟수, 자라는 펫(병아리)이면 다 자라기까지 남은 횟수
//   가운데 쓰다듬기와 할 일 셋(src/pet.js의 ORDERS). 지금 하는 일의 단추가 눌려 있다. 단추는 방의 펫(src/os.js의 os.pet)에게 시키므로
//          방에서 펫을 두 번 누르거나 오른쪽 단추 메뉴로 시킨 것과 똑같다. 명령을 듣지 않는 종류(고양이)는 누르기 전에 그렇다고 적는다
//   아래   종류와 색. 누르면 바로 이 브라우저의 설정(src/settings.js의 pet)에 저장하고 방의 펫과 큰 그림이 따라 바뀐다(사진 바꾸기 창과 같은 방식).
//          종류 단추에는 그 종류의 첫 색을, 색 단추에는 지금 종류를 그 색으로 그려 누르기 전에 어떤 펫이 될지 보인다.
//          다른 종류를 고르면 그 종류의 첫 색이 되고 쓰다듬은 횟수(petPats)가 0으로 돌아가므로, 병아리를 다시 고르면 새 병아리부터 시작한다.
//          병아리는 다 자라면 닭이 되지만 종류 줄에는 병아리 단추 하나만 두고, 지금 펫이 닭이면 그 단추에 닭을 그린다(src/pet.js의 petRoot).
//          종류 줄 끝의 "없음"을 고르면 방에서 펫이 사라지고(NO_PET) 큰 그림과 단추, 색 묶음이 숨는다. 다시 종류를 누르면 그 펫이 돌아온다.
// 한 번도 고르지 않았으면 설정이 비어 기본 펫(회색 고양이)이 산다. 펫이 없는 친구 집과 튜토리얼 연습 방에서는 아이콘이 보이지 않는다(editOnly, noPractice).
// 창을 연 채 방에서 쓰다듬거나 메뉴로 시켜도 이 창이 따라 바뀐다(설정 구독과 win.refreshPet).
import { h, batchim, reduceMotion } from '../util.js';
import { PET_COLS, PET_ROWS, NO_PET, PET_KINDS, GROW_PATS, ORDERS, moodOf, petCell, petChoice, petPuppet, petRoot, petSvg } from '../pet.js';

// 창 크기는 열 때의 펫 한 칸 크기(무대 배율마다 다르다)로 정한다. 종류와 색 단추는 모두 같은 폭(--pet-pick)이고, 그림 폭과 이름 폭 가운데
// 큰 쪽에 안쪽 여백과 테두리 8px을 더한 값이다. 이름은 13px 글씨로 네 글자(기니피그)까지라 LABEL_W를 52px로 잡는다
// (data/pets.js의 이름 길이는 tools/check.py가 본다, known-issues 95). 펫 한 칸이 2.2px보다 작은 배율에서는 그림보다 이름이 넓다.
// 종류 단추는 한 줄이라 창 폭은 종류 수로 정한다. 단추 사이 4px에 묶음(fieldset)의 안쪽 여백과 테두리 22px, 창 안쪽 여백 32px을 더한다.
// 높이는 위의 큰 그림(2배, 위 여백 6px)과 그 옆 글 네 줄(HEAD_H) 가운데 높은 쪽에, 종류와 색 단추 두 줄의 그림 높이와
// 나머지 글자와 여백(OTHER_H)을 더한다. 1280×800, 1366×768, 1440×900, 1920×1080 화면에서 내용 높이를 재어 2~5px 남게 잡았다.
// 내용이 창보다 크면 닫기 단추가 스크롤 아래로 밀린다(known-issues 73)
const LABEL_W = 52;
const HEAD_H = 96;
const OTHER_H = 306;
const SHUT_MS = 1000; // 방에서 쓰다듬으면 큰 그림도 눈을 감고 있는 시간(src/pet.js의 HEART_MS와 같다)

// 하는 일(src/pet.js의 mode)을 알리는 문장. 움직임 줄이기를 켠 사람의 펫은 혼자 놀 때도 걷지 않고 앉아만 있다
const DOING = {
  free: reduceMotion ? '방에 앉아 있습니다.' : '방에서 혼자 놀고 있습니다.',
  follow: '아바타를 따라다니고 있습니다.',
  stay: '그 자리에서 기다리고 있습니다.',
};

export function openPetApp(os, app) {
  const { settings } = os;
  const cell = petCell();
  const pick = Math.ceil(Math.max(PET_COLS * cell, LABEL_W)) + 8;
  return os.wm.open({
    key: app.id,
    app,
    title: app.title,
    width: Math.max(400, (PET_KINDS.length + 1) * (pick + 4) - 4 + 22 + 32), // 종류 단추와 "없음"
    height: Math.max(Math.ceil(PET_ROWS * cell * 2) + 6, HEAD_H) + Math.ceil(PET_ROWS * cell * 2) + OTHER_H,
    build(body, win) {
      body.classList.add('pet-app');
      body.style.setProperty('--pet-pick', `${pick}px`); // h()로 넣은 CSS 변수는 빠지므로 setProperty로 넣는다(known-issues 50)
      const big = h('div', { className: 'pet-big' });
      const puppet = petPuppet(big);
      const name = h('b');
      const doing = h('span');
      const pats = h('span', { className: 'meta' });
      const grow = h('span', { className: 'meta' });

      // 쓰다듬기와 할 일 단추. 방에 펫이 없거나 앉을 칸이 없으면 누를 수 없다
      const patBtn = h('button', { type: 'button', className: 'btn', onclick: () => os.pet()?.pat() }, '쓰다듬기');
      const orders = ORDERS.map(([next, label, words]) => h('button', {
        type: 'button',
        className: 'btn',
        dataset: { order: next },
        onclick: () => os.pet()?.command(next, words),
      }, label));
      const tip = h('p', { className: 'meta' });
      const care = h('div', { className: 'pet-care' }, h('div', { className: 'pet-orders' }, patBtn, ...orders), tip);

      const kinds = h('div', { className: 'pet-row' });
      const tones = h('div', { className: 'pet-row' });
      // 그림 단추에 choice(petChoice가 돌려준 펫)의 앉은 그림을 실제 크기로 그리고 이름을 단다
      const draw = (b, choice, label) => {
        b.dataset.pet = choice.value;
        b.replaceChildren(h('span', { className: 'pet-pic', innerHTML: petSvg(choice, ['sit']) }), h('span', {}, label));
      };
      const button = (choice, label, onclick) => {
        const b = h('button', { type: 'button', className: 'pet-choice', onclick });
        draw(b, choice, label);
        return b;
      };
      // 종류 단추. 지금 종류(병아리 단추에는 닭도)를 다시 누르면 고른 색을 그대로 두고, 다른 종류면 그 종류의 첫 색이 되며 쓰다듬은 횟수가 0으로 돌아간다.
      // "없음"을 고른 뒤에 종류를 누르면 petChoice가 'none'을 기본 펫으로 풀므로, 기본 펫의 종류면 기본 펫의 색이 된다
      kinds.append(...PET_KINDS.map(s => {
        const b = button(petChoice(s.id), s.name, () => {
          const now = petChoice(settings.get('pet'));
          settings.set(petRoot(now.species) === s ? { pet: now.value } : { pet: petChoice(s.id).value, petPats: 0 });
        });
        b.dataset.kind = s.id;
        return b;
      }));
      // "없음" 단추. 그림 자리에는 펫 그림과 같은 크기의 점선 네모를 그려 단추 높이를 맞추고 빈자리임을 보인다
      kinds.append(h('button', { type: 'button', className: 'pet-choice', dataset: { pet: NO_PET, kind: NO_PET }, onclick: () => settings.set({ pet: NO_PET, petPats: 0 }) },
        h('span', { className: 'pet-pic', innerHTML: `<svg viewBox="0 0 ${PET_COLS} ${PET_ROWS}" aria-hidden="true"><rect class="pet-none" x="4.5" y="2.5" width="15" height="15"/></svg>` }),
        h('span', {}, '없음')));
      // 다른 종류를 고르면 새 펫이라 쓰다듬은 횟수가 처음부터다. 누르기 전에 알 수 있게 종류 줄 아래에 적는다(펫이 없으면 숨긴다)
      const reset = h('p', { className: 'meta' }, '종류를 바꾸면 쓰다듬은 횟수가 0이 됩니다.');
      const toneSet = h('fieldset', { className: 'labs-group' }, h('legend', {}, '색'), tones);

      let shownKind = null; // 색 단추를 그린 종류. 종류가 바뀔 때만 다시 그려 누른 단추의 포커스가 남게 한다
      function render() {
        const none = settings.get('pet') === NO_PET;
        const now = petChoice(settings.get('pet'));
        const root = none ? NO_PET : petRoot(now.species).id;
        const pet = os.pet();
        const here = !none && !!pet?.spot();
        big.hidden = care.hidden = toneSet.hidden = pats.hidden = reset.hidden = none;
        if (!none && big.dataset.pet !== now.value) puppet.look(now);
        name.textContent = none ? '펫 없음' : `${now.color.name} ${now.species.name}`;
        doing.textContent = none ? '종류를 고르면 펫이 방에 나옵니다.'
          : !pet ? '방에 펫이 없습니다.'
            : !here ? '방에 앉을 빈칸이 없습니다.'
              : DOING[pet.mode()];

        // 쓰다듬은 횟수와 자라기까지 남은 횟수. 자라는 펫만 남은 횟수가 있다
        const n = Number(settings.get('petPats')) || 0;
        pats.textContent = `쓰다듬은 횟수 ${n}번`;
        const next = !none && now.species.grow ? petChoice(now.species.grow).species : null;
        grow.hidden = !next;
        if (next) grow.textContent = `${Math.max(1, GROW_PATS - n)}번 더 쓰다듬으면 ${next.name}${batchim(next.name) ? '이' : '가'} 됩니다.`;

        // 할 일 단추. 지금 하는 일의 단추가 눌려 있다. 듣지 않는 종류는 눌러도 쳐다보기만 하므로 그렇다고 적는다
        patBtn.disabled = !here;
        for (const b of orders) {
          b.disabled = !here;
          b.setAttribute('aria-pressed', String(here && pet.mode() === b.dataset.order));
        }
        const kind = now.species.name;
        tip.textContent = moodOf(now.species).obey ? '펫을 오른쪽 단추로 눌러도 시킬 수 있습니다.' : `${kind}${batchim(kind) ? '은' : '는'} 시켜도 쳐다보기만 합니다.`;

        if (!none && shownKind !== now.species.id) {
          shownKind = now.species.id;
          tones.replaceChildren(...now.species.colors.map(c => {
            const choice = petChoice(`${now.species.id}/${c.id}`);
            return button(choice, c.name, () => settings.set({ pet: choice.value }));
          }));
        }
        // 종류 단추의 그림. 지금 펫이 그 단추의 종류에서 자란 모습이면(병아리 단추와 닭) 자란 모습의 첫 색을 그린다.
        // 단추는 그대로 두고 안만 바꾸므로, 창을 열어 둔 채 방에서 쓰다듬어 자라도 누르던 단추의 포커스가 남는다
        for (const b of kinds.children) {
          const k = b.dataset.kind;
          if (k !== NO_PET) {
            const shown = petChoice(k === root ? now.species.id : k);
            if (b.dataset.pet !== shown.value) draw(b, shown, shown.species.name);
          }
          b.setAttribute('aria-pressed', String(k === root));
        }
        for (const b of tones.children) b.setAttribute('aria-pressed', String(!none && b.dataset.pet === now.value));
      }

      body.append(
        h('div', { className: 'pet-app-head' }, big, h('div', { className: 'pet-status' }, name, doing, pats, grow)),
        care,
        h('fieldset', { className: 'labs-group' }, h('legend', {}, '종류'), kinds, reset),
        toneSet,
        h('div', { className: 'link-row' }, h('button', { type: 'button', className: 'btn', onclick: () => win.close() }, '닫기')),
      );
      render();
      puppet.live(true);
      win.refreshPet = render; // 방의 펫이 생기거나 사라지거나 할 일이 바뀌면 src/os.js의 petChanged가 부른다

      // 방에서 쓰다듬어 횟수가 늘면 큰 그림도 방의 펫처럼 잠깐 눈을 감는다. 창이 방의 펫을 가리고 있어도 쓰다듬은 것이 보인다
      let lastPats = Number(settings.get('petPats')) || 0;
      let shutTimer = 0;
      const off = settings.subscribe(patch => {
        if ('petPats' in patch) {
          const n = Number(patch.petPats) || 0;
          if (n > lastPats) {
            puppet.shut(true);
            clearTimeout(shutTimer);
            shutTimer = setTimeout(() => puppet.shut(false), SHUT_MS);
          }
          lastPats = n;
        }
        if ('pet' in patch || 'petPats' in patch) render();
      });
      return () => {
        off();
        clearTimeout(shutTimer);
        puppet.live(false);
      };
    },
  });
}
