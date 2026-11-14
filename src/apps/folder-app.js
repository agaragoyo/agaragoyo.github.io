// 기본 앱: 폴더. data/apps.js에서 folder 값이 이 폴더의 opens와 같은 앱들을 아이콘으로 보여 준다.
// 게임 폴더(folder: 'games')는 앱의 group 칸으로 묶음을 나눠 묶음 이름 아래에 아이콘을 늘어놓는다(게임기 화면도 같은 순서와 이름, console-app.js).
import { APPS, groupGames } from '../../data/apps.js';
import { h } from '../util.js';

export function openFolderApp(os, app) {
  const inside = APPS.filter(a => a.folder === app.opens && os.canSee(a));
  // 게임 폴더만 묶음으로 나눈다. 다른 폴더는 묶음 하나(이름 없음)로 둔다
  const groups = app.opens === 'games' ? groupGames(inside) : [{ title: null, apps: inside }];
  // 창 폭 560에 아이콘이 한 줄에 다섯 개 들어간다. 줄이 늘면 창을 그만큼 키우고, 그래도 넘치면 아이콘 칸만 스크롤한다.
  // 80은 창 안쪽 여백과 안내 글 자리에, 마지막 줄의 긴 이름과 창 테두리 두께를 감안한 여유다. 묶음 제목 줄은 하나에 TITLE_H만큼 더한다.
  const TITLE_H = 30;
  const height = 80 + groups.reduce((sum, g) => sum + Math.ceil(g.apps.length / 5) * 108 + (g.title ? TITLE_H : 0), 0);
  return os.wm.open({
    key: app.id,
    app,
    title: app.title,
    width: 560,
    height: Math.min(640, Math.max(360, height)),
    build(body) {
      body.classList.add('folder');
      const grid = h('div', { className: 'folder-grid' });
      for (const g of groups) {
        const box = h('div', { className: 'folder-icons' });
        os.renderIcons(box, g.apps);
        grid.append(...(g.title ? [h('h3', { className: 'folder-group' }, g.title)] : []), box);
      }
      body.append(grid, h('p', { className: 'folder-hint' }, `${inside.length}개 항목. 아이콘을 두 번 누르면 실행됩니다.`));
    },
  });
}
