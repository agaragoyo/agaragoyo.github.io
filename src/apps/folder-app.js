// 기본 앱: 폴더. data/apps.js에서 folder 값이 이 폴더의 opens와 같은 앱들을 아이콘으로 보여 준다.
import { APPS } from '../../data/apps.js';
import { h } from '../util.js';

export function openFolderApp(os, app) {
  const inside = APPS.filter(a => a.folder === app.opens && os.canSee(a));
  // 창 폭 560에 아이콘이 한 줄에 다섯 개 들어간다. 줄이 늘면 창을 그만큼 키우고, 그래도 넘치면 아이콘 칸만 스크롤한다.
  // 80은 창 안쪽 여백과 안내 글 자리에, 마지막 줄의 긴 이름과 창 테두리 두께를 감안한 여유다.
  const rows = Math.ceil(inside.length / 5);
  return os.wm.open({
    key: app.id,
    app,
    title: app.title,
    width: 560,
    height: Math.min(580, Math.max(360, 80 + rows * 108)),
    build(body) {
      body.classList.add('folder');
      const grid = h('div', { className: 'folder-grid' });
      os.renderIcons(grid, inside);
      body.append(grid, h('p', { className: 'folder-hint' }, `${inside.length}개 항목. 아이콘을 두 번 누르면 실행됩니다.`));
    },
  });
}
