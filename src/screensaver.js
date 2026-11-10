// 화면 보호기. 바탕화면을 SAVER_MS 동안 그냥 두면, 2005년 무렵의 "스크롤 문자" 화면 보호기처럼
// 검은 화면 위로 주인의 인사말(공유하기 창에서 적는다)이 오른쪽에서 왼쪽으로 흘러간다. 지나갈 때마다 높이와 색이 바뀐다.
// 마우스를 움직이거나 누르거나 키를 누르면 걷힌다. 걷는 데 쓴 누르기와 키는 화면 안으로 전하지 않는다(가구나 아이콘이 눌리지 않게).
// 언제 돌지는 부르는 쪽(os.js)이 canRun으로 정한다. 창을 쓰는 중이나 가구를 가까이 보는 중에는 돌지 않는다(음악, 영상, 게임을 가리지 않게).
import { SAVER_MS, STAGE_W, STAGE_H } from './config.js';
import { h, reduceMotion } from './util.js';

const COLORS = ['#ffe36e', '#7ef0ff', '#ff9ad5', '#9dff8a', '#ffffff'];
const SPEED = 180;      // 1초에 흐르는 무대 px
const WAKE_GRACE = 600; // 띄운 직후 이만큼(ms)은 마우스 움직임으로 걷지 않는다(미리 보기 단추를 누른 손이 아직 움직이는 중)

// stage: 무대(1280×840). canRun(): 지금 화면 보호기를 띄워도 되는지. text(): 흘릴 글
export function createScreensaver({ stage, canRun, text }) {
  const line = h('p', { className: 'saver-text' });
  const el = h('div', { className: 'saver', hidden: true, 'aria-hidden': 'true' }, line);
  stage.append(el);
  let timer = 0;
  let shownAt = 0;
  let pass = 0;
  let anim = null;
  let swallowClick = false;

  // 한 번 지나가게 한다. 다 지나가면 높이와 색을 바꿔 다시 지나간다.
  function run() {
    line.style.color = COLORS[pass++ % COLORS.length];
    line.style.top = `${Math.round(80 + Math.random() * (STAGE_H - 240))}px`;
    const w = line.offsetWidth;
    anim = line.animate(
      [{ transform: `translateX(${STAGE_W}px)` }, { transform: `translateX(${-w}px)` }],
      { duration: ((STAGE_W + w) / SPEED) * 1000, easing: 'linear' },
    );
    anim.onfinish = () => { if (!el.hidden) run(); };
  }

  // preview: 공유하기 창의 미리 보기 단추로 띄웠는지. 그때만 띄운 직후의 마우스 움직임을 넘긴다
  function show(preview = false) {
    clearTimeout(timer);
    if (!el.hidden) return;
    line.textContent = text();
    el.hidden = false;
    shownAt = preview ? performance.now() : -Infinity;
    line.classList.toggle('still', reduceMotion); // 움직임 줄이기를 켠 사람에게는 가운데에 멈춰 보여 준다
    if (!reduceMotion) run();
  }

  function hide() {
    el.hidden = true;
    anim?.cancel();
    anim = null;
  }

  function arm() {
    clearTimeout(timer);
    timer = setTimeout(() => (canRun() ? show(false) : arm()), SAVER_MS);
  }

  const wake = e => {
    if (!el.hidden) {
      if (e.type === 'pointermove' && performance.now() - shownAt < WAKE_GRACE) return;
      hide();
      if (e.type !== 'pointermove') {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'pointerdown') swallowClick = true;
      }
    }
    arm();
  };
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel']) addEventListener(type, wake, { capture: true });
  // 화면 보호기를 걷은 누르기에서 이어지는 click도 화면 안으로 전하지 않는다
  addEventListener('click', e => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, { capture: true });
  arm();

  return { show, hide };
}
