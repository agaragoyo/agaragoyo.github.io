// 기믹이 없는 가구를 두 번 눌렀을 때 아바타가 말풍선으로 하는 혼잣말 한 줄을 꺼낸다. 지금은 "옷장이네."처럼 가구 이름을 말한다.
// 두 번 눌렀을 때(src/os.js의 os.openFurniture)와 실험실의 심심할 때 혼잣말(src/idle-talk.js)이 같이 쓴다. 가구마다 다른 줄을 넣을 때는 이 한 곳만 고친다.
import { batchim } from './util.js';

export function furnitureLine(def) {
  return `${def.name}${batchim(def.name) ? '이네' : '네'}.`;
}
