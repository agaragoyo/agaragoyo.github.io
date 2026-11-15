// 실험실 '펫 데려오기'(pet)의 펫 고르는 창. 실험실 창에서 펫 데려오기를 처음 켤 때와, 켜 둔 동안 그 줄의 펫 바꾸기 단추를 누를 때 열린다
// (src/apps/labs-app.js). 종류나 색을 누르면 바로 이 브라우저의 설정(src/settings.js의 pet)에 저장하고, 방의 펫(src/os.js의 syncPet)과
// 창 위의 큰 그림이 따라 바뀐다. 사진 바꾸기 창(src/user-pictures.js)과 같은 방식이다.
// 종류 단추에는 그 종류의 첫 색을, 색 단추에는 지금 종류를 그 색으로 그려 누르기 전에 어떤 펫이 될지 보인다. 다른 종류를 고르면 그 종류의 첫 색이 된다.
// 고르지 않고 닫으면 설정이 빈 채로 남아 기본 펫(회색 고양이)이 나오고, 다음에 켤 때 이 창이 다시 열린다.
// 펫 데려오기를 끄거나 실험실을 닫으면 이 창도 닫힌다.
import { h } from './util.js';
import { labOn } from './labs.js';
import { PET_SPECIES } from '../data/pets.js';
import { PET_COLS, PET_ROWS, petCell, petChoice, petPuppet, petSvg } from './pet.js';

// 창 크기는 열 때의 펫 한 칸 크기(무대 배율마다 다르다)로 정한다. 단추 하나는 그림 폭에 안쪽 여백과 테두리 8px을 더한 폭이고,
// 단추 사이는 4px이다. 폭에는 묶음(fieldset)의 안쪽 여백과 테두리 22px, 창 안쪽 여백 32px을 더하고, 높이에는 큰 그림(2배)과
// 단추 두 줄의 그림 높이에 글자와 여백 OTHER_H를 더한다. 내용이 창보다 크면 닫기 단추가 스크롤 아래로 밀린다(known-issues 73)
const OTHER_H = 220;

export function openPetPicker(os) {
  const { settings } = os;
  const cell = petCell();
  const pick = Math.ceil(PET_COLS * cell) + 8;
  return os.wm.open({
    key: 'pet-picker',
    app: { title: '펫 고르기', icon: 'builtin:labs' },
    title: '펫 고르기',
    width: Math.max(400, PET_SPECIES.length * (pick + 4) - 4 + 22 + 32),
    height: Math.ceil(PET_ROWS * cell * 4) + OTHER_H,
    build(body, win) {
      body.classList.add('pet-app');
      const big = h('div', { className: 'pet-big' });
      const puppet = petPuppet(big);
      const name = h('b');
      const kinds = h('div', { className: 'pet-row' });
      const tones = h('div', { className: 'pet-row' });

      // 그림 단추 하나. choice는 그 단추가 고를 펫(petChoice)이고, 단추에는 그 펫의 앉은 그림을 실제 크기로 그린다
      const button = (choice, label, onclick) => h('button', { type: 'button', className: 'pet-choice', dataset: { pet: choice.value }, onclick },
        h('span', { className: 'pet-pic', innerHTML: petSvg(choice, ['sit']) }), h('span', {}, label));
      // 종류 단추. 지금 종류를 다시 누르면 고른 색을 그대로 두고, 다른 종류면 그 종류의 첫 색이 된다
      kinds.append(...PET_SPECIES.map(s => {
        const first = petChoice(s.id);
        return button(first, s.name, () => {
          const now = petChoice(settings.get('pet'));
          settings.set({ pet: now.species.id === s.id ? now.value : first.value });
        });
      }));

      let shownKind = null; // 색 단추를 그린 종류. 종류가 바뀔 때만 다시 그려 누른 단추의 포커스가 남게 한다
      function render() {
        const now = petChoice(settings.get('pet'));
        puppet.look(now);
        name.textContent = `${now.color.name} ${now.species.name}`;
        if (shownKind !== now.species.id) {
          shownKind = now.species.id;
          tones.replaceChildren(...now.species.colors.map(c => {
            const choice = petChoice(`${now.species.id}/${c.id}`);
            return button(choice, c.name, () => settings.set({ pet: choice.value }));
          }));
        }
        for (const b of kinds.children) b.setAttribute('aria-pressed', String(b.dataset.pet.split('/')[0] === now.species.id));
        for (const b of tones.children) b.setAttribute('aria-pressed', String(b.dataset.pet === now.value));
      }

      body.append(
        h('div', { className: 'pet-app-head' }, big, name),
        h('fieldset', { className: 'labs-group' }, h('legend', {}, '종류'), kinds),
        h('fieldset', { className: 'labs-group' }, h('legend', {}, '색'), tones),
        h('div', { className: 'link-row' }, h('button', { type: 'button', className: 'btn', onclick: () => win.close() }, '닫기')),
      );
      render();
      puppet.live(true);
      const off = settings.subscribe(patch => {
        if ('pet' in patch) render();
        if (('labs' in patch || 'labsOpen' in patch) && !labOn('pet')) win.close();
      });
      return () => {
        off();
        puppet.live(false);
      };
    },
  });
}
