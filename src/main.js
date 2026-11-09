// 시작점. 모니터(크기 맞추기, 테두리 버튼, 화면 효과, 전원)를 맡고, 화면 안쪽은 os.js에 넘긴다.
import { STAGE_W, STAGE_H } from './config.js';
import { settings } from './settings.js';
import { reduceMotion } from './util.js';
import { initCRT } from './crt.js';
import { initCursors } from './cursors.js';
import { createOS } from './os.js';
import { play, setPlace } from './sound.js';

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
// 사파리(WebKit)는 필터를 건 층을 화면의 60~80%만 그려서, 접속만 해도 화면 왼쪽 위만 휘어 그려지고 나머지는 검게 남았다.
// 원인과 고친 방법은 known-issues 30에 있다(crt.js가 필터와 함께 3D 변형을 준다). Windows용 WebKit에서는 크롬과 같게 그려졌지만
// 맥 사파리에서 확인한 사람이 아직 없어서 기본은 꺼 둔다. 주소 뒤에 ?warp=on을 붙이면 크롬 계열이 아닌 브라우저에서도 켜서 볼 수 있다.
// 아이폰과 아이패드의 크롬도 엔진이 WebKit이다. 파이어폭스는 확인하지 못해서 같이 끄고 평평하게 보여 준다.
// 트랙패드나 터치패드로 화면을 키운(핀치 줌) 동안에도 끈다. 브라우저가 필터를 확대 배율로 다시 그려야 하고,
// 키워서 보는 동안에는 평평한 화면이 글자도 또렷하다(known-issues 29).
const HAS_MOUSE = matchMedia('(hover: hover) and (pointer: fine)');
// index.html의 모듈 미리 받기 스크립트도 같은 식으로 크롬 계열을 가린다(known-issues 43). 한쪽을 고치면 다른 쪽도 같이 고친다.
const CHROMIUM = /Chrome\/|Chromium\//.test(navigator.userAgent);
const FORCE_WARP = new URLSearchParams(location.search).get('warp') === 'on';
const pinched = () => (window.visualViewport?.scale ?? 1) > 1.01;
const crt = initCRT({
  screen: $('#screen'),
  warpEl: $('#crt'),
  input: $('#crt-input'),
  grain: $('#grain'),
  isWarpOn: () => settings.get('curve') && HAS_MOUSE.matches && !mon.rotated && era().warp > 0 && (CHROMIUM || FORCE_WARP) && !pinched(),
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
  $('#sound-key').setAttribute('aria-pressed', String(!!settings.get('sound')));
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
$('#sound-key').addEventListener('click', () => settings.set({ sound: !settings.get('sound') }));
document.querySelectorAll('[data-era-pick]').forEach(btn => {
  btn.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('era', btn.dataset.eraPick);
    history.replaceState(null, '', url);
    settings.set({ era: btn.dataset.eraPick });
  });
});

// ---------- 전원 ----------
// 사용자가 전원 버튼을 직접 누르게 해서 켠다. 브라우저는 첫 클릭 전까지 소리 재생을 막으므로, 이 클릭 뒤부터 소리가 난다.
// 끄면 실제 컴퓨터처럼 열린 창이 모두 사라지고 배경음악도 바로 멈춘다.
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
  play('button');
  if (!powered) setPlace(null);
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

// 켜진 화면 안을 누르면 마우스 딸깍 소리. 볼록 화면의 보정 층이 넘기는 가짜 이벤트(isTrusted가 거짓)는 세지 않아서 한 번만 난다.
// 모니터 바깥 버튼(전원, 소리, 시대)은 화면 밖이라 나지 않는다. iframe 앱 안의 클릭은 부모 문서까지 오지 않는다.
document.addEventListener('pointerdown', e => {
  if (e.isTrusted && e.button === 0 && powered && e.target.closest?.('#screen')) play('mouse');
}, true);

// ---------- 첫 화면 ----------
// 여기까지 오면 모니터가 다 그려지고 버튼도 이어졌으므로 index.html의 가림막을 걷는다.
// 가림막이 없을 때는 이 파일이 돌기 전까지 모니터 없이 글씨만 먼저 보였다(known-issues 42).
// 첫 화면의 글자는 사이트 글자만 담은 작은 글꼴(AgaUI) 보통과 굵게 두 벌로 그린다(style.css의 "글꼴", known-issues 45).
// 둘을 받을 때까지 기다리되, 3초가 넘으면 먼저 걷는다. 3초는 브라우저가 웹 글꼴을 기다리며 글자를 숨기는 기본 시간이다.
// 그 뒤에는 기본 글꼴로 보이다가 글꼴이 오는 대로 바뀐다.
const FIRST_FONTS = ['12px AgaUI', 'bold 12px AgaUI'];
// 작은 글꼴에 없는 글자(사용자가 치는 닉네임과 말풍선)는 갈무리11 전체가 그린다. 첫 화면을 다 그린 뒤에 이어 받아 두어,
// 느린 연결에서 첫 화면의 짐을 나눠 지지 않으면서도 로그인 화면에서 닉네임을 칠 무렵에는 와 있게 한다.
const FULL_FONTS = ['12px Galmuri11', 'bold 12px Galmuri11'];
const loader = $('#page-loader');
Promise.race([
  Promise.all(FIRST_FONTS.map(f => document.fonts.load(f))).catch(() => {}),
  new Promise(done => setTimeout(done, 3000)),
]).then(() => {
  loader.classList.add('done');
  setTimeout(() => loader.remove(), 400); // 사라지는 데 0.25초. 다 사라진 뒤 점 깜빡임까지 멈추게 뺀다
  for (const f of FULL_FONTS) document.fonts.load(f).catch(() => {});
});
