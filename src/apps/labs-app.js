// 기본 앱: 실험실. 팀이 아직 정하지 않은 기능을 이 브라우저에서만 켜고 끈다(목록과 규칙은 src/labs.js).
// 바탕화면 아이콘은 말풍선에 암호를 말한 뒤에만 보인다(data/apps.js의 labs: true, src/os.js의 canSee).
// 모양은 배경음악 앱처럼 그 시절 대화상자의 제목 붙은 묶음(fieldset)과 확인란이다.
import { h } from '../util.js';
import { LABS, setLab, labOn, closeLabs } from '../labs.js';

// 창 높이는 항목이 늘어도 아래의 실험실 닫기 단추가 창 밖으로 밀리지 않게 항목마다 더한다.
// 항목 하나는 이름 한 줄(24px), 설명 한 줄마다 21px, 사이 간격 10px이다
const windowHeight = () => 150 + LABS.reduce((sum, lab) => sum + 34 + 21 * lab.desc.split('\n').length, 0);

export function openLabsApp(os, app) {
  const { settings } = os;

  return os.wm.open({
    key: app.id,
    app,
    title: '실험실',
    width: 400,
    height: windowHeight(),
    build(body) {
      body.classList.add('labs-app');

      const boxes = LABS.map(lab => {
        const box = h('input', { type: 'checkbox' });
        box.addEventListener('change', () => setLab(lab.id, box.checked));
        return { lab, box, row: h('label', { className: 'labs-item', dataset: { lab: lab.id } }, box, h('span', {}, h('b', {}, lab.title), h('span', { className: 'meta' }, lab.desc))) };
      });
      const closeBtn = h('button', { className: 'btn', type: 'button' }, '실험실 닫기');
      closeBtn.addEventListener('click', closeLabs);

      body.append(
        h('p', { className: 'meta' }, '팀이 아직 정하지 않은 기능입니다.', h('br'), '켠 항목은 이 브라우저에만 적용됩니다.'),
        h('fieldset', { className: 'labs-group' }, h('legend', {}, '시험 기능'), ...boxes.map(b => b.row)),
        h('div', { className: 'labs-foot' }, h('p', { className: 'meta' }, '닫으면 모든 항목이 꺼지고', h('br'), '아이콘이 숨겨집니다.'), closeBtn),
      );

      const render = () => { for (const { lab, box } of boxes) box.checked = labOn(lab.id); };
      render();
      return settings.subscribe(render);
    },
  });
}
