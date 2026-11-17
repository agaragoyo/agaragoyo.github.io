// 실험실의 '심심할 때 혼잣말'(idle-talk, src/labs.js). 켜고 바탕화면을 30초 동안 그냥 두면 내 아바타가 걸어서 갈 수 있는 가구 하나로 걸어가
// 그 가구의 혼잣말(가구를 두 번 눌렀을 때 하는 말)을 한 번 하고, 그 뒤로 40~60초마다 되풀이한다. 같은 가구의 혼잣말을 연달아 하지 않아서(말한 차례 기준),
// 갈 수 있는 가구가 지난번에 말한 가구 하나뿐이면 그 차례는 쉰다. 시간 숫자는 src/config.js의 IDLE_TALK에 있다.
// 말은 가구를 두 번 눌렀을 때와 같은 줄을 src/furniture-line.js에서 꺼낸다.
// 레퍼런스는 시킨 일이 없으면 심이 스스로 움직이는 심즈의 자유 의지(설정에서 끌 수 있다)와 스스로 끼어들어 미움받은 오피스 도우미다.
// 방이 살아 보이는지 귀찮은지는 켜 봐야 알아서 실험실에 둔다.
//
// 마우스를 움직이거나 누르거나 휠을 굴리거나 키를 치면 가구로 가던 길을 바로 버리고(걷던 한 칸은 마저 걷는다) 30초를 처음부터 잰다.
// 입력은 화면 보호기(src/screensaver.js)와 같은 네 가지로 센다. 아바타가 혼자 걸어 커서 아래를 지나가도 크롬은 pointerover와 pointerout만 보내고
// pointermove는 보내지 않아서, 혼자 걷는 것이 화면 보호기의 기다리는 시간을 늘리지 않는다.
// 언제 쉴지는 부르는 쪽(src/os.js)이 canRun으로 정한다(창이 열려 있을 때, 가구 가까이 보기, 튜토리얼, 화면 보호기, 말풍선에 쓰는 중).
// 움직임 줄이기를 켠 사람에게는 혼자 걷지 않고 바로 옆에 있는 가구에만 혼잣말을 한다(실험실의 고양이가 걷지 않는 것과 같다).
import { IDLE_TALK } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { furnitureLine } from './furniture-line.js';
import { labOn } from './labs.js';
import { settings } from './settings.js';
import { reduceMotion } from './util.js';

// avatar(): 지금 바탕화면의 내 아바타(src/avatar.js의 mountAvatar). items(): 지금 공간의 가구 목록. canRun(): 지금 혼잣말하러 가도 되는지
// line(item): 그 가구 앞에서 할 말. 넘기지 않으면 가구 목록의 혼잣말이고, 분신사바의 공포 모드(src/horror.js)에서는 부르는 쪽이 공포 모드의 줄을 넘긴다
export function createIdleTalk({ avatar, items, canRun, line = item => furnitureLine(BY_ID[item.id]) }) {
  let timer = 0;
  let last = null; // 지난번에 혼잣말을 한 가구의 id
  let trip = 0;    // 혼잣말하러 가구로 걷는 중이면 그 걸음의 번호, 아니면 0
  let trips = 0;

  function arm(ms) {
    clearTimeout(timer);
    timer = labOn('idle-talk') ? setTimeout(fire, ms) : 0;
  }
  const again = () => IDLE_TALK.again[0] + Math.random() * (IDLE_TALK.again[1] - IDLE_TALK.again[0]);

  // 걸어서 갈 수 있는 가구 가운데 지난번에 말한 가구가 아닌 것 하나를 무작위로 고른다
  function pick(me) {
    const can = items().filter(item => {
      if (item.id === last) return false;
      const steps = me.stepsTo(item);
      return steps !== null && (!reduceMotion || steps === 0);
    });
    return can[Math.floor(Math.random() * can.length)] || null;
  }

  // 다음 차례는 걷기 전에 한 번 걸어 두고(걷다가 공간을 옮겨 도착하지 못해도 다음 차례가 온다), 말하고 나면 그때부터 다시 잰다.
  // 걷는 길이 다음 차례까지의 시간보다 길면 다음 차례가 길을 바꾸어 앞에 고른 가구는 말하지 못한다. 그래서 last는 고를 때가 아니라 말할 때 적는다(known-issues 94)
  function fire() {
    if (!canRun()) return arm(IDLE_TALK.first);
    arm(again());
    const me = avatar();
    const item = me?.spot() && pick(me);
    if (!item) return;
    const n = trip = ++trips;
    me.approach(item, () => {
      if (trip !== n) return;
      trip = 0;
      if (!canRun()) return;
      last = item.id;
      me.say(line(item));
      arm(again());
    });
  }

  // 사용자가 돌아왔다. 혼잣말하러 가던 길을 버리고 처음부터 다시 잰다
  function wake() {
    if (trip) {
      trip = 0;
      avatar()?.halt();
    }
    arm(IDLE_TALK.first);
  }
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel']) addEventListener(type, wake, { capture: true, passive: true });
  // 실험실에서 켜면 그때부터 재고, 끄면 가던 길도 버린다
  settings.subscribe(patch => { if ('labs' in patch || 'labsOpen' in patch) wake(); });
  arm(IDLE_TALK.first);
}
