// 분신사바(F29). 내 컴퓨터의 바탕화면에서 말풍선에 "분신사바"를 말하면(src/secrets.js) 방의 불이 꺼지고 공포 모드가 된다.
// 2000년대 초 학교에서 유행한 분신사바 놀이(같은 이름의 2004년 공포 영화도 있다)가 이 사이트의 시대와 맞는다.
// 무섭되 놀래키지 않게 한다. 큰 소리, 갑자기 뜨는 얼굴, 피는 넣지 않고, 불이 깜박이고 물건이 저절로 움직이는
// 심즈 4 초자연 현상 팩의 유령 집처럼 조용히 이상한 것만 늘어놓는다. 불이 꺼지면
//   방이 밤이 되고 불빛이 천천히 깜박인다(style.css의 "분신사바" 절. 1초에 3번보다 느리게, WCAG 2.3.1. 움직임 줄이기를 켠 사람에게는 깜박이지 않는다)
//   작업 표시줄 시계가 04:44에 멈추고 시계 가구도 4시 44분이라고 말한다(숫자 4를 꺼리는 한국 괴담)
//   벽에 건 것(TILT) 하나가 천천히 기운다
//   가구를 두 번 누르면 아바타가 평소와 다른 혼잣말(LINES)을 한다. 기믹이 있는 가구는 원래 하던 일을 한다
//   방의 배경음악이 멈춘다. 소리는 불 끄고 켜는 딸깍 소리만 내므로 소리 설정과 창이 뒤로 가면 소리 끄기(F27)를 따른다
// 그 뒤로 방이 보이는 동안 시간이 지나면 이상한 일이 하나씩 늘어난다(STEPS. 때는 src/config.js의 HORROR).
// 같은 복도를 돌 때마다 무언가 하나씩 달라지는 P.T.(2014)처럼 같은 방을 조금씩 바꾸고, 물건에서 목소리, 메뉴로 이상한 것이 점점 가까워진다.
// 빈칸의 목소리는 유령이 "여기", "뒤에"처럼 짧게 답하는 파스모포비아의 스피릿 박스에서, 시작 메뉴의 글이 바뀌는 것은
// 게임의 메뉴가 망가지는 두근두근 문예부에서 가져왔다. 마지막 단계 뒤로는 더 늘지 않고 그대로 머문다.
// 불을 켜면(스탠드 같은 불빛 가구를 두 번 누르거나 시작 메뉴의 불 켜기, src/os.js의 toggleNight) 모든 단계가 한 번에 풀리고 아바타가 안도하는 한마디를 한다.
// 상태는 메모리에만 둔다. 집 저장(os.saveHome), 서버의 방, 밤 설정을 바꾸지 않아서 새로 고침하거나 바탕화면을 떠나면 풀린다.
// 켜도 되는 곳은 부르는 쪽(src/os.js)이 canStart로 정한다. 내 컴퓨터의 진짜 집에서만 켜고, 손님 화면, 친구 집과 이웃집,
// 튜토리얼과 그 연습 방에서는 켜지 않는다.
import { HORROR } from './config.js';
import { emptyCells, sayPoint } from './avatar.js';
import { holdMusic, play } from './sound.js';
import { h } from './util.js';

export const CLOCK = '04:44'; // 공포 모드의 작업 표시줄 시계
// 기울일 벽 가구. 앞에 있는 것부터 찾아 기울인다. 창문은 벽에 박혀 있어서 기울이지 않는다
const TILT = ['frame', 'poster', 'wall-clock', 'corkboard'];
const BEAT = 250; // 단계 시계가 방이 보이는지 보고 시간을 세는 간격(ms)

// 공포 모드에서 가구를 두 번 눌렀을 때 아바타가 하는 혼잣말. 말투는 아바타 말풍선(반말 혼잣말, 한 줄에 13자 이하)이고
// 마침표, 물음표, 느낌표 가운데 하나로 끝낸다(tools/check.py의 check_horror_lines가 본다).
// 기믹이 있는 가구(책장, 컴퓨터, TV, 게임기, 라디오, 코르크 보드)는 두 번 누르면 원래 하던 일을 하므로 그 줄은 실험실의
// 심심할 때 혼잣말(src/idle-talk.js)에서만 나온다. 불빛 가구의 줄은 불을 켜면 풀린다는 것을 귀띔한다
export const LINES = {
  // 방 바닥
  desk: '서랍이 왜 열려 있지?',
  'dining-table': '의자가 하나 더 있었나?',
  bed: '침대 밑은 안 볼래.',
  sofa: '소파가 아직 따뜻해.',
  bookshelf: '책 한 권이 떨어졌어.',
  wardrobe: '옷장은 열지 말자.',
  armchair: '쿠션이 눌려 있어.',
  fridge: '냉장고 소리가 커졌어.',
  lamp: '불부터 켜야겠다.',
  audio: '전원이 켜졌다 꺼졌어.',
  'big-plant': '잎이 왜 흔들리지?',
  // 가구 위
  computer: '꺼진 화면에 내가 비쳐.',
  tv: '치지직 소리만 나.',
  console: '누가 하다 만 거지?',
  camera: '찍은 적 없는 사진이야.',
  diary: '내 글씨가 아닌데.',
  'desk-lamp': '이거라도 켜 볼까.',
  'desk-lamp-2': '불 켜면 괜찮겠지.',
  mug: '차가 반이나 줄었어.',
  plant: '어느새 시들었어.',
  books: '페이지가 혼자 넘어가.',
  clock: '4시 44분에 멈췄네.',
  radio: '잡음 사이로 뭐가 들려.',
  fishbowl: '물고기가 날 보고 있어.',
  // 벽
  window: '창밖이 너무 조용해.',
  'wide-window': '밖에 아무도 없네.',
  'beads-window': '방금 누가 지나갔나?',
  'wide-beads-window': '바람도 없는데 찰랑여.',
  frame: '사진 속 눈이 날 보네.',
  poster: '포스터가 달라졌어?',
  'wall-clock': '계속 4시 44분이야.',
  corkboard: '쪽지가 하나 늘었어.',
};
export const START = '누가 불 껐어?';  // 불이 꺼지고 한 박자 뒤
export const END = '휴, 살았다.';      // 불을 켜서 풀었을 때
export const TILTED = '언제 비뚤어졌지?'; // 기울어진 벽 가구를 두 번 눌렀을 때
const OTHER = '기분 탓이겠지.';         // LINES에 줄이 없는 가구(나중에 더한 가구)
// 아무도 없는 빈칸에서 뜨는 말풍선(누군가의 반말 한마디)과, 그쪽을 돌아본 아바타의 한마디. 말풍선 한 줄(13자 이하)에 든다
export const HERE = '여기야.';         // 아바타에게서 가장 먼 빈칸(far 단계)
export const BEHIND = '바로 뒤야.';    // 아바타 바로 옆 빈칸(near 단계)
export const HEARD = '잘못 들었나?';   // near 단계의 말풍선이 사라진 뒤 아바타가 하는 말
export const DONT = '불 켜지 마';       // menu 단계부터 시작 메뉴를 열면 불 켜기 단추에 잠깐 보이는 글

// layer: 바탕화면 방 상자(가구와 아바타가 같이 든 #wallpaper). avatar(): 지금 내 아바타. items(): 지금 공간의 가구 목록.
// figures(): 지금 공간에서 아바타와 실험실의 펫이 선 칸들(빈칸의 말풍선은 그 칸을 피한다). canStart(): 지금 켜도 되는지.
// canSee(): 지금 방이 보이는지(보이는 동안만 단계의 시간을 센다). onChange(): 켜지거나 풀린 뒤에 부른다(밤 색과 작업 표시줄 시계를 다시 맞춘다).
// 돌려주는 것: on(), start(), end(), stop(), attach(), line(item), menu(label)
export function createHorror({ layer, avatar, items, figures, canStart, canSee, onChange }) {
  let on = false;
  let pending = 0;  // 암호를 말하고 불이 꺼지기를 기다리는 타이머
  let wonder = 0;   // 불이 꺼지고 아바타가 첫마디를 하기를 기다리는 타이머
  let releaseMusic = null;
  let tilted = [];  // 기울인 가구들(집 상태의 가구 줄). 두 번 누르면 TILTED를 말한다
  // 단계 시계. 불이 꺼진 뒤 방이 보인 시간(seen)을 BEAT마다 더해, 다음 단계(STEPS[next])의 때가 되면 그 단계를 한다. 다 하면 멈춘다
  let beat = 0;
  let seen = 0;
  let last = 0;
  let next = 0;
  let voiceTimer = 0;
  let turnTimer = 0;
  let label = null;    // 지금 열린 시작 메뉴의 불 켜기 글(span)
  let flashed = false; // 불 켜기 글을 이미 바꿔 보였는지. 공포 모드마다 한 번만 보인다
  let unflash = null;  // 바꿔 보인 불 켜기 글을 돌려놓는다
  const dark = h('div', { className: 'horror-dark' });
  const voice = h('div', { className: 'room-avatar-say horror-voice' });

  // 불이 꺼진 뒤 이상한 일이 늘어나는 차례. 이름은 src/config.js의 HORROR에서 그 단계의 때를 찾는 열쇠다
  const STEPS = [
    ['tilt', () => lean()],                                                 // 벽에 건 것이 하나 더 기운다
    ['far', () => speak(farCell(), HERE)],                                  // 먼 구석에서 누군가 부른다
    ['near', () => speak(nearCell(), BEHIND, () => avatar()?.say(HEARD))],  // 그 목소리가 아바타 바로 뒤로 온다
    ['menu', () => flash()],                                                // 불을 켜려고 시작 메뉴를 열면 말린다
  ];
  const reached = name => STEPS.findIndex(([n]) => n === name) < next;

  function pulse() {
    const now = performance.now();
    if (canSee()) seen += Math.min(now - last, BEAT * 4); // 컴퓨터가 잠들었다 깨어나도 단계를 한꺼번에 건너뛰지 않는다
    last = now;
    const step = STEPS[next];
    if (step && seen >= HORROR[step[0]]) {
      next++;
      step[1]();
    }
    if (next >= STEPS.length) { // 마지막 단계 뒤로는 그대로 머문다
      clearInterval(beat);
      beat = 0;
    }
  }

  // 가구 줄 item을 그린 상자. 같은 가구가 여럿이면 목록에서의 차례로 고른다. 방 그림(src/room.js의 renderStatic)도 목록 차례대로 가구를 넣는다
  function boxOf(item) {
    const same = items().filter(it => it.id === item.id);
    return layer.querySelectorAll(`.furn.static[data-id="${item.id}"]`)[same.indexOf(item)] || null;
  }

  // 벽에 건 것을 TILT 차례로(같은 가구가 여럿이면 목록 차례로) 기울인다. 처음에는 하나만 기울고, tilt 단계부터는 다음 것이 반대쪽으로 기울며,
  // 벽에 건 것이 하나뿐이면 그것이 더 기운다(style.css의 "분신사바" 절). 방을 다시 그린 뒤에도 부른다
  function lean() {
    const list = items();
    const [first, second] = TILT.flatMap(id => list.filter(item => item.id === id));
    const more = reached('tilt');
    tilted = [first, more && second].filter(Boolean);
    if (first) boxOf(first)?.classList.add('askew');
    if (more && second) boxOf(second)?.classList.add('askew', 'ccw');
    else if (more && first) boxOf(first)?.classList.add('more');
  }

  // 방 상자에 어둠을 깔고 벽에 건 것을 기울인다. 방을 다시 그리면 상자가 비워지므로 그 뒤에도 부른다(src/os.js의 renderWallpaper).
  // 처음 켤 때는 그려져 있던 가구에 클래스를 다는 것이라 천천히 기울고, 다시 그린 뒤에는 새 가구에 처음부터 달려 기운 채로 나온다
  function attach() {
    tilted = [];
    if (!on) return;
    layer.append(dark);
    lean();
  }

  function detach() {
    dark.remove();
    voice.remove();
    for (const box of layer.querySelectorAll('.furn.askew')) box.classList.remove('askew', 'ccw', 'more');
    tilted = [];
  }

  // 아바타에게서 가장 먼 빈칸. 아무도 없는 구석에서 소리가 나야 해서 아바타와 펫이 선 칸은 뺀다
  function farCell() {
    const me = avatar()?.spot();
    if (!me) return null;
    const d = c => Math.abs(c.x - me.x) + Math.abs(c.y - me.y);
    return emptyCells(items(), figures()).reduce((best, c) => (!best || d(c) > d(best) ? c : best), null);
  }

  // 아바타 바로 옆의 빈칸. 화면에서 아바타와 같은 높이에 있는 왼쪽과 오른쪽 칸 가운데 등 뒤(바라보는 쪽의 반대편) 쪽을 먼저 고르고,
  // 둘 다 막혀 있으면 가장 가까운 빈칸이다. 아바타 바로 위아래 칸에 띄우면 말풍선이 아바타 머리에 걸려 아바타가 말한 것처럼 보인다
  function nearCell() {
    const walker = avatar();
    const me = walker?.spot();
    if (!me) return null;
    const back = walker.behind();
    const side = Math.sign(back.x - me.x - (back.y - me.y)); // 등 뒤가 화면의 오른쪽이면 1, 왼쪽이면 -1
    const score = c => {
      const right = c.x - me.x - (c.y - me.y); // 화면에서 오른쪽으로 반 칸 몇 개만큼인지
      if (c.x + c.y === me.x + me.y && Math.abs(right) === 2) return right === 2 * side ? 0 : 1;
      return 2 + Math.abs(c.x - me.x) + Math.abs(c.y - me.y);
    };
    return emptyCells(items(), figures()).reduce((best, c) => (!best || score(c) < score(best) ? c : best), null);
  }

  // 아무도 없는 칸 cell 위에 말풍선 text를 띄운다. 아바타의 말풍선과 같은 모양이고 천천히 나타났다 사라진다(움직임 줄이기면 그냥 떴다 사라진다).
  // 조금 뒤에 아바타가 그쪽을 돌아보고, 말풍선이 사라지면 then을 부른다. 빈칸이 없으면(방이 꽉 찼으면) 아무 일도 없다
  function speak(cell, text, then) {
    if (!cell) return;
    clearTimeout(voiceTimer);
    clearTimeout(turnTimer);
    voice.remove(); // 다시 붙여야 나타나는 애니메이션이 처음부터 돈다
    voice.textContent = text;
    voice.style.animationDuration = `${HORROR.voice}ms`;
    Object.assign(voice.style, sayPoint(cell));
    layer.append(voice);
    turnTimer = setTimeout(() => avatar()?.lookAt(cell), HORROR.turn);
    voiceTimer = setTimeout(() => {
      voice.remove();
      then?.();
    }, HORROR.voice);
  }

  // 열려 있는 시작 메뉴의 불 켜기 글을 잠깐 DONT로 바꿨다 돌려놓는다. 메뉴가 닫혀 있으면 다음에 열 때 menu가 다시 부른다.
  // 글만 바뀌고 단추는 그대로라, 바뀐 글을 눌러도 불이 켜진다
  function flash() {
    if (flashed || !label?.isConnected || label.closest('[hidden]')) return;
    flashed = true;
    const span = label;
    const was = span.textContent;
    span.textContent = DONT;
    const timer = setTimeout(() => unflash?.(), HORROR.flash);
    unflash = () => {
      clearTimeout(timer);
      span.textContent = was;
      unflash = null;
    };
  }

  // 시작 메뉴를 열 때 부른다(src/os.js의 openStartMenu). span: 불 켜기 단추의 글. menu 단계가 지났으면 한 번 바꿔 보인다
  function menu(span) {
    if (!on) return;
    label = span;
    if (reached('menu')) flash();
  }

  function start() {
    if (on || pending || !canStart()) return;
    pending = setTimeout(() => {
      pending = 0;
      if (!canStart()) return;
      on = true;
      seen = next = 0;
      flashed = false;
      last = performance.now();
      beat = setInterval(pulse, BEAT);
      play('light');
      releaseMusic = holdMusic('horror', 'own'); // 방의 배경음악을 멈춘다. 그 뒤에 연 음악 앱과 게임 창은 제 음악을 튼다
      attach();
      onChange();
      wonder = setTimeout(() => avatar()?.say(START), HORROR.wonder);
    }, HORROR.dark);
  }

  // 소리 없이 푼다. 바탕화면을 떠나거나 새로 만들 때(로그아웃, 전원 끄기, 튜토리얼 연습 방) 부른다.
  // 단계 시계와 아직 뜨지 않은 말풍선, 돌아보기도 모두 멈춘다
  function stop() {
    clearTimeout(pending);
    clearTimeout(wonder);
    clearInterval(beat);
    clearTimeout(voiceTimer);
    clearTimeout(turnTimer);
    pending = wonder = beat = 0;
    unflash?.();
    label = null;
    if (!on) return;
    on = false;
    releaseMusic?.();
    releaseMusic = null;
    detach();
    onChange();
  }

  // 불을 켜서 푼다. 딸깍 소리를 내고 아바타가 안도하는 한마디를 한다
  function end() {
    if (!on) return;
    stop();
    play('light');
    avatar()?.say(END);
  }

  const line = item => (tilted.includes(item) ? TILTED : LINES[item.id] || OTHER);

  return { on: () => on, start, end, stop, attach, line, menu };
}
