// 시작점. 모니터(크기 맞추기, 테두리 버튼, 화면 효과, 전원)를 맡고, 화면 안쪽은 os.js에 넘긴다.
import { STAGE_W, STAGE_H } from './config.js';
import { settings } from './settings.js';
import { reduceMotion } from './util.js';
import { initCRT } from './crt.js';
import { initCursors } from './cursors.js';
import { createOS } from './os.js';

const $ = sel => document.querySelector(sel);
const stage = $('#stage');

const mon = {
  scale: 1,
  rotated: false,
  // 화면 좌표를 1280×840 무대 좌표로 바꾼다.
  toLocal(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    if (mon.rotated) {
      // 시계 방향으로 90도 돌린 상태: 무대 왼쪽 위 모서리가 화면의 오른쪽 위에 있고,
      // 무대의 x축은 화면 아래쪽, y축은 화면 왼쪽을 향한다.
      return { x: (clientY - r.top) / mon.scale, y: (r.right - clientX) / mon.scale };
    }
    return { x: (clientX - r.left) / mon.scale, y: (clientY - r.top) / mon.scale };
  },
};

// ---------- 시대 ----------
// 같은 사이트를 세 시대 모습으로 보여 준다(팀 의견을 듣기 위한 비교용).
//   1998: 베이지 CRT, 윈도우 98식 회색 창, BIOS 부팅
//   2005: 은색 평면 CRT, XP 시절식 파란 창과 둥근 시작 버튼, 로고 부팅
//   2010: 검은 광택 와이드 LCD, 반투명 유리 창, 둥근 시작 버튼, 맑은 고딕 (CRT 효과 없음)
// 주소에 ?era=2005 를 붙이면 그 시대로 열리고 설정에도 남는다.
// warp: 화면이 휘는 정도. 2005년식 완전평면 CRT는 유리 앞면이 평평해서 휘지 않는다(0이면 왜곡과 클릭 보정을 끈다).
// pad, ctrl: 모니터 테두리 두께와 아래 줄 높이(무대 px). lcd: 화면 효과(그레인, 볼록)를 쓰지 않는다.
const ERAS = {
  1998: { warp: 0.06, pad: 72, ctrl: 108 },
  2005: { warp: 0, pad: 72, ctrl: 108 },
  2010: { warp: 0, pad: 26, ctrl: 58, lcd: true },
};
const fromUrl = new URLSearchParams(location.search).get('era');
if (ERAS[fromUrl] && fromUrl !== settings.get('era')) settings.set({ era: fromUrl });
if (!ERAS[settings.get('era')]) settings.set({ era: '1998' });
const era = () => ERAS[settings.get('era')];

// 화면 안 커서(시대마다 다르고, 마우스 앱에서 바꿀 수 있다)
initCursors(settings);

// ---------- 화면 맞추기 ----------
// MARGIN: 화면 가장자리와 모니터 사이(px). PAD, CTRL: 모니터 테두리 두께와 아래 버튼 줄 높이(무대 px).
// 테두리도 무대와 같은 비율로 커지므로, 큰 모니터에서 테두리만 얇아 보이거나 스피커 구멍만 길어지지 않는다.
// style.css의 .viewport 회전 조건과 같아야 한다.
const PORTRAIT_PHONE = matchMedia('(orientation: portrait) and (hover: none) and (max-width: 900px)');

function fit() {
  mon.rotated = PORTRAIT_PHONE.matches;
  // 돌려 놓았으면 화면의 세로가 곧 모니터의 가로다.
  const W = mon.rotated ? innerHeight : innerWidth;
  const H = mon.rotated ? innerWidth : innerHeight;
  const viewport = $('#viewport');
  viewport.style.width = mon.rotated ? W + 'px' : '';
  viewport.style.height = mon.rotated ? H + 'px' : '';

  const MARGIN = 16;
  const TOP = mon.rotated ? 0 : 44; // 위쪽 시대 스위치 자리
  const { pad: PAD, ctrl: CTRL } = era();
  const s = Math.max(0.2, Math.min((W - 2 * MARGIN) / (STAGE_W + 2 * PAD), (H - TOP - 2 * MARGIN) / (STAGE_H + PAD + CTRL)));
  const root = document.documentElement.style;
  root.setProperty('--margin', MARGIN + 'px');
  root.setProperty('--top', TOP + 'px');
  root.setProperty('--u', s + 'px');
  root.setProperty('--pad', PAD * s + 'px');
  root.setProperty('--ctrl', CTRL * s + 'px');
  mon.scale = s;
  const screen = $('#screen');
  screen.style.width = STAGE_W * s + 'px';
  screen.style.height = STAGE_H * s + 'px';
  stage.style.transform = `scale(${s})`;
  crt.apply();
}
// 창 크기를 끄는 동안 resize가 연달아 오므로 한 화면에 한 번만 맞춘다.
let fitQueued = false;
addEventListener('resize', () => {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(() => { fitQueued = false; fit(); });
});
PORTRAIT_PHONE.addEventListener('change', fit);

// ---------- 화면 효과 ----------
// 화면을 실제로 휘는 볼록 효과는 마우스를 쓰는 PC의 크롬 계열 브라우저(크롬, 엣지, 웨일, 삼성 인터넷)에서만 켠다.
// 사파리(WebKit)는 HTML에 건 SVG 변위 필터를 제대로 그리지 못해서, 접속만 해도 화면 왼쪽 위만 휘어 그려지고 나머지는 검게 남았다
// (known-issues 30). 아이폰과 아이패드의 크롬도 엔진이 WebKit이다. 파이어폭스는 확인하지 못해서 같이 끄고 평평하게 보여 준다.
// 트랙패드나 터치패드로 화면을 키운(핀치 줌) 동안에도 끈다. 브라우저가 필터를 확대 배율로 다시 그려야 하고,
// 키워서 보는 동안에는 평평한 화면이 글자도 또렷하다(known-issues 29).
const HAS_MOUSE = matchMedia('(hover: hover) and (pointer: fine)');
const CHROMIUM = /Chrome\/|Chromium\//.test(navigator.userAgent);
const pinched = () => (window.visualViewport?.scale ?? 1) > 1.01;
const crt = initCRT({
  screen: $('#screen'),
  warpEl: $('#crt'),
  input: $('#crt-input'),
  grain: $('#grain'),
  isWarpOn: () => settings.get('curve') && HAS_MOUSE.matches && !mon.rotated && era().warp > 0 && CHROMIUM && !pinched(),
});
// 핀치 줌은 창 크기(resize) 이벤트를 보내지 않으므로 visualViewport의 resize를 따로 듣는다.
// 손가락을 움직이는 동안 연달아 오므로 한 화면에 한 번만 다시 정한다.
let pinchQueued = false;
window.visualViewport?.addEventListener('resize', () => {
  if (pinchQueued) return;
  pinchQueued = true;
  requestAnimationFrame(() => { pinchQueued = false; crt.apply(); });
});

// 설정이 바뀔 때마다 화면에 반영한다(테두리 버튼, 밤, 시대).
function applySettings() {
  for (const key of ['grain', 'curve']) {
    document.body.classList.toggle(key, !!settings.get(key));
    $(`[data-toggle="${key}"]`).setAttribute('aria-pressed', String(!!settings.get(key)));
  }
  // 밤 모드: 스탠드나 가로등으로 켜고 끈다. 화면 안쪽(방 그림과 OS 창) 색이 바뀐다.
  stage.dataset.theme = settings.get('night') ? 'night' : 'day';
  document.body.dataset.era = settings.get('era');
  for (const b of document.querySelectorAll('[data-era-pick]')) b.setAttribute('aria-pressed', String(b.dataset.eraPick === settings.get('era')));
  crt.setStrength(era().warp);
  fit(); // 시대마다 모니터 테두리 두께가 다르다
}
fit();
settings.subscribe(applySettings);
applySettings();

// 모니터 바깥 버튼(전원, 효과, 시대)은 마우스로 눌러도 키보드 초점을 가져가지 않는다. 초점이 남아 있으면
// 바탕화면에서 Enter(아바타 말하기)를 누를 때 그 버튼이 다시 눌려 전원이 꺼진다(known-issues 26).
document.querySelectorAll('.phys, [data-era-pick]').forEach(btn => {
  btn.addEventListener('mousedown', e => e.preventDefault());
});
document.querySelectorAll('[data-toggle]').forEach(btn => {
  btn.addEventListener('click', () => settings.set({ [btn.dataset.toggle]: !settings.get(btn.dataset.toggle) }));
});
document.querySelectorAll('[data-era-pick]').forEach(btn => {
  btn.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('era', btn.dataset.eraPick);
    history.replaceState(null, '', url);
    settings.set({ era: btn.dataset.eraPick });
  });
});

// ---------- 전원 ----------
// 소리를 나중에 넣을 때를 생각해, 사용자가 전원 버튼을 직접 누르게 해서 켠다.
// (브라우저는 첫 클릭 전까지 소리 재생을 막는다.) 끄면 실제 컴퓨터처럼 열린 창이 모두 사라진다.
const powerFx = $('#power-fx');
const powerBtn = $('#power');
let powered = false;

function setPowerState(state) { powerFx.className = `power-fx ${state}`; }

// 연출이 끝나면 화면을 켜거나 끈다. 탭이 뒤에 있으면 애니메이션이 멈춰 animationend가 오지 않으므로 타이머로도 끝낸다.
let settleTimer = 0;
function settlePower() {
  clearTimeout(settleTimer);
  if (!powerFx.className.includes('turning')) return;
  setPowerState(powered ? 'on' : 'off');
  if (!powered) os.reset();
}
powerFx.querySelector('.beam').addEventListener('animationend', settlePower);

function setPower(on) {
  if (on === powered) return;
  powered = on;
  powerBtn.setAttribute('aria-pressed', String(powered));
  if (reduceMotion) {
    setPowerState(powered ? 'on' : 'off');
    if (!powered) os.reset();
  } else {
    setPowerState(powered ? 'turning-on' : 'turning-off');
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settlePower, 900);
  }
  if (powered) os.boot();
}

const os = createOS({
  stage,
  toStage: mon.toLocal,
  requestPowerOff: () => setPower(false),
  crt,
  settings,
});
powerBtn.addEventListener('click', () => setPower(!powered));
