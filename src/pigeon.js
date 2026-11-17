// 말풍선 암호 999999999로 부르는 비둘기(docs/requirements.md의 F32). 숫자 9는 "구"라서, 9를 아홉 번 부르면 "구구" 우는 비둘기가 온다는 말장난이다.
// 방 벽에 창문(id가 window로 끝나는 벽 가구)이 있으면 그 가운데 하나로, 없으면 방의 현관문(src/config.js의 SCENES door)으로 날아 들어와
// 빈 바닥 칸에 내려앉아 "구구" 하고, 내 펫처럼 몇 칸씩 걷다가 12~18초 뒤 가장 가까운 창문(없으면 현관문)으로 날아 나간다.
// 두 번 누르면 아바타가 옆으로 다가오고, 비둘기는 놀라 새소리(src/sound.js의 pet-bird)를 내며 바로 날아 나간다. 현관문으로 드나들 때는 문 닫히는 소리를 낸다.
// 움직임 줄이기를 켠 사람에게는 날지 않고 내려앉을 칸에 나타났다가 그 자리에서 사라진다.
// 걷기, 날기, 그림은 내 펫과 같은 src/pet.js의 mountPet이 맡고(그림은 data/pets.js의 비둘기), 여기서는 드나드는 곳과 머무는 시간만 정한다.
// 한 번에 한 마리만 오고, 와 있을 때 또 부르면 한 번 더 "구구" 한다(src/os.js의 callPigeon). 집 저장 형식과 링크에는 아무것도 담지 않는다.
import { N, PIGEON } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { wallPoint } from './iso.js';
import { isWall } from './rules.js';
import { mountPet, petCell, PET_ROWS } from './pet.js';
import { play } from './sound.js';

export const COO = '구구';          // 내려앉으면 하는 말. 9를 "구"로 읽는 말장난을 비둘기 울음으로 맺는다
const LOOK = 'pigeon/gray';        // 날아오는 비둘기. 길에서 흔히 보는 회색이다(data/pets.js)
const DOOR_V = 0.4;                // 현관문으로 드나들 때 그림 가운데가 오는 높이(문 높이의 비율). 문 손잡이보다 조금 아래다
const LAND = 3;                    // 드나드는 벽에서 이만큼 떨어진 줄 가까이에 내려앉는다

export const isWindow = item => isWall(item) && /(^|-)window$/.test(item.id);

// 드나드는 곳. 벽 wall의 칸 u(벽을 따라 모서리에서 잰 자리), 바닥에서 v줄 높이가 그림 가운데다.
//   at    날기 시작하거나 사라지는 발끝 자리(무대 px). 그림 가운데가 (u, v)에 오게 그림 키의 절반만큼 내린다
//   near  내려앉을 칸을 고를 때 가까이 갈 칸. 벽에서 LAND줄 떨어진 칸이다. 나갈 곳을 고를 때 거리도 이 칸으로 잰다
function gate(wall, u, v, door = false) {
  const p = wallPoint(wall, u, v);
  const c = Math.max(1, Math.min(N - 1, Math.floor(u)));
  return {
    door,
    at: { x: p.x, y: p.y + (petCell() * PET_ROWS) / 2 },
    near: wall === 'R' ? { x: c, y: LAND } : { x: LAND, y: c },
  };
}
// 창문 가운데. 벽 가구의 x는 벽을 따라 시작하는 칸, y는 바닥에서 아래 끝까지의 줄이다(src/iso.js의 placementOf)
function windowGate(item) {
  const [w, rows] = BY_ID[item.id].size;
  return gate(item.wall, item.x + w / 2, item.y + rows / 2);
}
const doorGate = door => gate(door.wall, door.x + door.w / 2, door.h * DOOR_V, true);

// host: 비둘기가 다녀갈 곳(바탕화면 배경, src/os.js가 넘긴다)
//   layer, items(), avatar()  src/pet.js의 mountPet과 같다
//   others()  내 펫(있으면). 그 칸과 둘레 한 칸에는 내려앉거나 걷지 않는다
//   door      방의 현관문(SCENES의 door). 창문이 없으면 여기로 드나든다
//   gone()    날아 나가 방에서 사라진 뒤 부른다
// 돌려주는 것: attach(here), cells(), order(at, rect, z), coo(), destroy(). cells와 order는 아바타가 부른다(src/avatar.js의 host.others)
export function visitPigeon(host) {
  let arrived = false; // 내려앉았는지. 내려앉은 뒤에 머무는 시간을 센다
  let leaving = false; // 날아 나가는 중이거나 다녀갔다
  let stayTimer = 0;
  const bird = mountPet({
    layer: host.layer,
    items: host.items,
    avatar: host.avatar,
    others: host.others,
    look: () => LOOK,
    rest: PIGEON.rest,
    shy: () => leave(true),
    title: '두 번 눌러 다가가기',
  });
  const coo = () => bird.say(COO, PIGEON.coo);

  // 암호를 말하고 PIGEON.come 뒤에 창문 하나(없으면 현관문)에서 나타난다. 내려앉을 빈칸이 없으면 오지 않고 다녀간 것으로 친다
  let comeTimer = setTimeout(() => {
    comeTimer = 0;
    const windows = host.items().filter(isWindow);
    const entry = windows.length ? windowGate(windows[Math.floor(Math.random() * windows.length)]) : doorGate(host.door);
    if (!bird.flyIn(entry, land)) {
      done();
      return;
    }
    if (entry.door) play('enter');
  }, PIGEON.come);

  function land() {
    arrived = true;
    coo();
    stayTimer = setTimeout(() => leave(false), PIGEON.stay[0] + Math.random() * (PIGEON.stay[1] - PIGEON.stay[0]));
  }

  // 지금 칸에서 가장 가까운 창문, 창문이 없으면 현관문으로 나간다. 거리는 창문 앞에 내려앉는 칸(near)까지 잰다
  function exit() {
    const me = bird.cells()[0];
    const gates = host.items().filter(isWindow).map(windowGate);
    if (!me || !gates.length) return gates[0] || doorGate(host.door);
    const d = g => Math.abs(g.near.x - me.x) + Math.abs(g.near.y - me.y);
    return gates.reduce((a, b) => (d(b) < d(a) ? b : a));
  }

  // startled: 다가온 아바타에 놀라 날아간다(두 번 누르기). 그때만 새소리를 내고, 머무는 시간이 다 되어 날아갈 때는 조용히 간다
  function leave(startled) {
    if (leaving) return;
    leaving = true;
    clearTimeout(stayTimer);
    if (startled) play('pet-bird');
    const out = exit();
    bird.flyOut(out, () => {
      if (out.door) play('enter');
      done();
    });
  }

  function stop() {
    leaving = true;
    clearTimeout(comeTimer);
    clearTimeout(stayTimer);
    bird.destroy();
  }
  // 방에서 사라졌다. os.js가 다음에 부를 때 새 비둘기가 오도록 알린다
  function done() {
    stop();
    host.gone();
  }

  return {
    // 방을 다시 그린 뒤 부른다(src/os.js의 renderWallpaper). 날아오던 중이면 내려앉을 칸에 바로 앉고, 날아 나가던 중이면 바로 사라진다.
    // here: 지금 공간이 내 방인지. 다른 공간이면 다녀간 것으로 친다
    attach(here) {
      if (comeTimer) return; // 아직 나타나지 않았다
      if (leaving || !here) {
        done();
        return;
      }
      bird.attach(true);
      if (!arrived) land();
    },
    cells: () => bird.cells(),
    order: (at, rect, z) => bird.order(at, rect, z),
    coo,
    destroy: stop,
  };
}
