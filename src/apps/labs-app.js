// 기본 앱: 실험실. 팀이 아직 정하지 않은 기능을 이 브라우저에서만 켜고 끈다(목록과 규칙은 src/labs.js).
// 바탕화면 아이콘은 말풍선에 암호를 말한 뒤에만 보인다(data/apps.js의 labs: true, src/os.js의 canSee).
// 모양은 배경음악 앱처럼 그 시절 대화상자의 제목 붙은 묶음(fieldset)과 확인란이다.
import { h } from '../util.js';
import { LABS, setLab, labOn, closeLabs } from '../labs.js';
import { openPetPicker } from '../pet-picker.js';

// 항목 하나(이름 한 줄과 두 줄 설명)는 68px, 항목 사이는 8px이다. 항목이 늘면 창도 그만큼 늘려 실험실 닫기 단추가 스크롤 아래로 밀리지 않게 한다
const ITEM_H = 76;

export function openLabsApp(os, app) {
  const { settings } = os;

  return os.wm.open({
    key: app.id,
    app,
    title: '실험실',
    width: 400,
    height: 250 + ITEM_H * (LABS.length - 1),
    build(body) {
      body.classList.add('labs-app');

      const boxes = LABS.map(lab => {
        const box = h('input', { type: 'checkbox' });
        box.addEventListener('change', () => {
          setLab(lab.id, box.checked);
          // 펫 데려오기를 처음 켜면 펫 고르는 창을 연다. 고르지 않고 닫으면 다음에 켤 때 다시 열린다(src/pet-picker.js)
          if (lab.id === 'pet' && box.checked && !settings.get('pet')) openPetPicker(os);
        });
        // 펫 데려오기를 켜 둔 동안에는 이름 옆에 펫 바꾸기 단추가 붙는다. 이름 줄 높이에 드는 작은 단추라 창 높이(ITEM_H)는 그대로다.
        // 단추는 label 안에 있어도 누를 때 확인란을 바꾸지 않는다(label 안의 단추는 label의 누르기를 넘겨주지 않는다)
        const title = h('b', {}, lab.title);
        const change = lab.id === 'pet' ? h('button', { type: 'button', className: 'btn labs-change', onclick: () => openPetPicker(os) }, '펫 바꾸기') : null;
        const head = change ? h('span', { className: 'labs-title' }, title, change) : title;
        return { lab, box, change, row: h('label', { className: 'labs-item', dataset: { lab: lab.id } }, box, h('span', {}, head, h('span', { className: 'meta' }, lab.desc))) };
      });
      const closeBtn = h('button', { className: 'btn', type: 'button' }, '실험실 닫기');
      closeBtn.addEventListener('click', closeLabs);

      body.append(
        h('p', { className: 'meta' }, '팀이 아직 정하지 않은 기능입니다.', h('br'), '켠 항목은 이 브라우저에만 적용됩니다.'),
        h('fieldset', { className: 'labs-group' }, h('legend', {}, '시험 기능'), ...boxes.map(b => b.row)),
        h('div', { className: 'labs-foot' }, h('p', { className: 'meta' }, '닫으면 모든 항목이 꺼지고', h('br'), '아이콘이 숨겨집니다.'), closeBtn),
      );

      const render = () => {
        for (const { lab, box, change } of boxes) {
          box.checked = labOn(lab.id);
          if (change) change.hidden = !box.checked;
        }
      };
      render();
      return settings.subscribe(render);
    },
  });
}
