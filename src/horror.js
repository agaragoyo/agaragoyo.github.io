// 분신사바(F28). 내 컴퓨터의 바탕화면에서 말풍선에 "분신사바"를 말하면(src/secrets.js) 방의 불이 꺼지고 공포 모드가 된다.
// 2000년대 초 학교에서 유행한 분신사바 놀이(같은 이름의 2004년 공포 영화도 있다)가 이 사이트의 시대와 맞는다.
// 무섭되 놀래키지 않게 한다. 큰 소리, 갑자기 뜨는 얼굴, 피는 넣지 않고, 불이 깜박이고 물건이 저절로 움직이는
// 심즈 4 초자연 현상 팩의 유령 집처럼 조용히 이상한 것만 늘어놓는다. 공포 모드에서는
//   방이 밤이 되고 불빛이 천천히 깜박인다(style.css의 "분신사바" 절. 1초에 3번보다 느리게, WCAG 2.3.1. 움직임 줄이기를 켠 사람에게는 깜박이지 않는다)
//   작업 표시줄 시계가 04:44에 멈추고 시계 가구도 4시 44분이라고 말한다(숫자 4를 꺼리는 한국 괴담)
//   벽에 건 것(TILT) 하나가 천천히 기운다
//   가구를 두 번 누르면 아바타가 평소와 다른 혼잣말(LINES)을 한다. 기믹이 있는 가구는 원래 하던 일을 한다
//   방의 배경음악이 멈춘다. 소리는 불 끄고 켜는 딸깍 소리만 내므로 소리 설정과 창이 뒤로 가면 소리 끄기(F27)를 따른다
// 불을 켜면(스탠드 같은 불빛 가구를 두 번 누르거나 시작 메뉴의 불 켜기, src/os.js의 toggleNight) 풀리고 아바타가 안도하는 한마디를 한다.
// 상태는 메모리에만 둔다. 집 저장(os.saveHome), 서버의 방, 밤 설정을 바꾸지 않아서 새로 고침하거나 바탕화면을 떠나면 풀린다.
// 켜도 되는 곳은 부르는 쪽(src/os.js)이 canStart로 정한다. 내 컴퓨터의 진짜 집에서만 켜고, 손님 화면, 친구 집과 이웃집,
// 튜토리얼과 그 연습 방에서는 켜지 않는다.
import { holdMusic, play } from './sound.js';
import { h } from './util.js';

export const CLOCK = '04:44'; // 공포 모드의 작업 표시줄 시계
const DARK_AFTER = 900;      // 암호를 말하고 불이 꺼질 때까지(ms). 말풍선의 "분신사바"를 읽을 틈이다
const WONDER_AFTER = 1200;   // 불이 꺼지고 아바타가 첫마디를 할 때까지(ms)
// 기울일 벽 가구. 앞에 있는 것부터 찾아 하나만 기울인다. 창문은 벽에 박혀 있어서 기울이지 않는다
const TILT = ['frame', 'poster', 'wall-clock', 'corkboard'];

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
  // 놀이터
  sandbox: '모래에 발자국이 있어.',
  slide: '꼭대기에 뭐가 있어?',
  swing: '그네가 혼자 흔들려.',
  seesaw: '건너편이 내려가 있어.',
  bench: '옆자리가 서늘해.',
  tree: '가지가 손 같아.',
  streetlight: '가로등이 깜박거려.',
};
export const START = '누가 불 껐어?';  // 불이 꺼지고 한 박자 뒤
export const END = '휴, 살았다.';      // 불을 켜서 풀었을 때
export const TILTED = '언제 비뚤어졌지?'; // 기울어진 벽 가구를 두 번 눌렀을 때
const OTHER = '기분 탓이겠지.';         // LINES에 줄이 없는 가구(나중에 더한 가구)

// layer: 바탕화면 방 상자(가구와 아바타가 같이 든 #wallpaper). avatar(): 지금 내 아바타. items(): 지금 공간의 가구 목록.
// canStart(): 지금 켜도 되는지. onChange(): 켜지거나 풀린 뒤에 부른다(밤 색과 작업 표시줄 시계를 다시 맞춘다).
// 돌려주는 것: on(), start(), end(), stop(), attach(), line(item)
export function createHorror({ layer, avatar, items, canStart, onChange }) {
  let on = false;
  let pending = 0;  // 암호를 말하고 불이 꺼지기를 기다리는 타이머
  let wonder = 0;   // 불이 꺼지고 아바타가 첫마디를 하기를 기다리는 타이머
  let releaseMusic = null;
  let tilted = null; // 기울인 가구(집 상태의 가구 줄). 두 번 누르면 TILTED를 말한다
  const dark = h('div', { className: 'horror-dark' });

  // 방 상자에 어둠을 깔고 벽에 건 것 하나를 기울인다. 방을 다시 그리면 상자가 비워지므로 그 뒤에도 부른다(src/os.js의 renderWallpaper).
  // 처음 켤 때는 그려져 있던 가구에 클래스를 다는 것이라 천천히 기울고, 다시 그린 뒤에는 새 가구에 처음부터 달려 기운 채로 나온다
  function attach() {
    tilted = null;
    if (!on) return;
    layer.append(dark);
    const list = items();
    tilted = TILT.map(id => list.find(item => item.id === id)).find(Boolean) || null;
    // 같은 가구가 둘이면 목록에서 먼저 나온 것을 기울인다. 방 그림(src/room.js의 renderStatic)도 목록 차례대로 가구를 넣는다
    if (tilted) layer.querySelector(`.furn.static[data-id="${tilted.id}"]`)?.classList.add('askew');
  }

  function detach() {
    dark.remove();
    layer.querySelector('.furn.askew')?.classList.remove('askew');
    tilted = null;
  }

  function start() {
    if (on || pending || !canStart()) return;
    pending = setTimeout(() => {
      pending = 0;
      if (!canStart()) return;
      on = true;
      play('light');
      releaseMusic = holdMusic('horror', 'own'); // 방의 배경음악을 멈춘다. 그 뒤에 연 음악 앱과 게임 창은 제 음악을 튼다
      attach();
      onChange();
      wonder = setTimeout(() => avatar()?.say(START), WONDER_AFTER);
    }, DARK_AFTER);
  }

  // 소리 없이 푼다. 바탕화면을 떠나거나 새로 만들 때(로그아웃, 전원 끄기, 튜토리얼 연습 방) 부른다
  function stop() {
    clearTimeout(pending);
    clearTimeout(wonder);
    pending = wonder = 0;
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

  const line = item => (item === tilted ? TILTED : LINES[item.id] || OTHER);

  return { on: () => on, start, end, stop, attach, line };
}
