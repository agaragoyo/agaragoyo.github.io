// 기믹이 없는 가구를 두 번 눌렀을 때 아바타가 말풍선으로 하는 혼잣말 한 줄을 꺼낸다.
// 줄은 가구 목록(data/furniture.js)의 say에 있고, say가 없는 가구는 "옷장이네."처럼 이름을 말한다.
// say 안의 {시각}은 지금 시각("3시 40분", "3시 정각", "3시 반")으로 바뀐다(시계 가구). now는 시각을 정해 시험할 때만 넘긴다.
// 두 번 눌렀을 때(src/os.js의 os.openFurniture)와 같은 줄을 다른 곳에서 말할 때 같이 쓴다.
import { batchim } from './util.js';

export function furnitureLine(def, now = new Date()) {
  const say = def.say?.trim();
  if (!say) return `${def.name}${batchim(def.name) ? '이네' : '네'}.`;
  return say.replaceAll('{시각}', clockWords(now));
}

// 말로 읽는 시각. 낮과 밤을 가르지 않고 12시간으로 읽는다("15:40"이 아니라 "3시 40분").
function clockWords(d) {
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  return m === 0 ? `${h}시 정각` : m === 30 ? `${h}시 반` : `${h}시 ${m}분`;
}
