// 펫 바꾸기 창(F30). 내 컴퓨터의 시작 메뉴에서 "펫 바꾸기"를 누르면 열린다(src/os.js의 openStartMenu).
// 종류나 색을 누르면 바로 이 브라우저의 설정(src/settings.js의 pet)에 저장하고, 방의 펫(src/os.js의 syncPet)과
// 창 위의 큰 그림이 따라 바뀐다. 사진 바꾸기 창(src/user-pictures.js)과 같은 방식이다.
// 종류 단추에는 그 종류의 첫 색을, 색 단추에는 지금 종류를 그 색으로 그려 누르기 전에 어떤 펫이 될지 보인다. 다른 종류를 고르면 그 종류의 첫 색이 된다.
// 병아리는 다 자라면 닭이 되지만 종류 줄에는 병아리 단추 하나만 두고, 지금 펫이 닭이면 그 단추에 닭을 그린다(src/pet.js의 petRoot).
// 다른 종류나 "없음"을 고르면 쓰다듬은 횟수(petPats)가 0으로 돌아가므로, 병아리를 다시 고르면 새 병아리부터 시작한다.
// 종류 줄 끝의 "없음"을 고르면 방에서 펫이 사라지고(NO_PET) 색 묶음과 큰 그림이 숨는다. 다시 종류를 누르면 그 펫이 돌아온다.
// 한 번도 고르지 않았으면 설정이 비어 기본 펫(회색 고양이)이 산다.
import { h } from './util.js';
import { PET_COLS, PET_ROWS, NO_PET, PET_KINDS, petCell, petChoice, petPuppet, petRoot, petSvg } from './pet.js';

// 창 크기는 열 때의 펫 한 칸 크기(무대 배율마다 다르다)로 정한다. 단추는 모두 같은 폭(--pet-pick)이고, 그림 폭과 이름 폭 가운데
// 큰 쪽에 안쪽 여백과 테두리 8px을 더한 값이다. 이름은 13px 글씨로 네 글자(기니피그)까지라 LABEL_W를 52px로 잡는다
// (data/pets.js의 이름 길이는 tools/check.py가 본다). 펫 한 칸이 2.2px보다 작은 배율에서는 그림보다 이름이 넓다.
// 종류 단추는 한 줄이라 창 폭은 종류 수로 정한다. 단추 사이 4px에 묶음(fieldset)의 안쪽 여백과 테두리 22px, 창 안쪽 여백 32px을 더한다.
// 높이에는 큰 그림(2배)과 단추 두 줄의 그림 높이에 글자와 여백 OTHER_H를 더한다(오른쪽 단추 메뉴를 알리는 한 줄 26px 포함).
// 내용이 창보다 크면 닫기 단추가 스크롤 아래로 밀린다(known-issues 73)
const LABEL_W = 52;
const OTHER_H = 246;

export function openPetPicker(os) {
  const { settings } = os;
  const cell = petCell();
  const pick = Math.ceil(Math.max(PET_COLS * cell, LABEL_W)) + 8;
  return os.wm.open({
    key: 'pet-picker',
    app: { title: '펫 바꾸기', icon: 'builtin:pet' },
    title: '펫 바꾸기',
    width: Math.max(400, (PET_KINDS.length + 1) * (pick + 4) - 4 + 22 + 32), // 종류 단추와 "없음"
    height: Math.ceil(PET_ROWS * cell * 4) + OTHER_H,
    build(body, win) {
      body.classList.add('pet-app');
      body.style.setProperty('--pet-pick', `${pick}px`); // h()로 넣은 CSS 변수는 빠지므로 setProperty로 넣는다(known-issues 50)
      const big = h('div', { className: 'pet-big' });
      const puppet = petPuppet(big);
      const name = h('b');
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
      const toneSet = h('fieldset', { className: 'labs-group' }, h('legend', {}, '색'), tones);

      let shownKind = null; // 색 단추를 그린 종류. 종류가 바뀔 때만 다시 그려 누른 단추의 포커스가 남게 한다
      function render() {
        const none = settings.get('pet') === NO_PET;
        const now = petChoice(settings.get('pet'));
        const root = none ? NO_PET : petRoot(now.species).id;
        big.hidden = none;
        toneSet.hidden = none;
        if (!none) puppet.look(now);
        name.textContent = none ? '펫 없음' : `${now.color.name} ${now.species.name}`;
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
          const kind = b.dataset.kind;
          if (kind !== NO_PET) {
            const shown = petChoice(kind === root ? now.species.id : kind);
            if (b.dataset.pet !== shown.value) draw(b, shown, shown.species.name);
          }
          b.setAttribute('aria-pressed', String(kind === root));
        }
        for (const b of tones.children) b.setAttribute('aria-pressed', String(!none && b.dataset.pet === now.value));
      }

      body.append(
        h('div', { className: 'pet-app-head' }, big, name),
        h('fieldset', { className: 'labs-group' }, h('legend', {}, '종류'), kinds),
        toneSet,
        // 방의 펫에 할 일을 시키는 메뉴(src/pet.js)는 오른쪽 단추 뒤에 숨어 있어 여기서 한 줄로 알린다
        h('p', { className: 'meta' }, '펫을 마우스 오른쪽 단추로 누르면 따라오게 할 수 있습니다.'),
        h('div', { className: 'link-row' }, h('button', { type: 'button', className: 'btn', onclick: () => win.close() }, '닫기')),
      );
      render();
      puppet.live(true);
      const off = settings.subscribe(patch => {
        if ('pet' in patch) render();
      });
      return () => {
        off();
        puppet.live(false);
      };
    },
  });
}
