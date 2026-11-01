// 기본 앱: 폴더. data/apps.js에서 folder 값이 이 폴더의 opens와 같은 앱들을 아이콘으로 보여 준다.
import { APPS } from '../../data/apps.js';
import { h } from '../util.js';

export function openFolderApp(os, app) {
  const inside = APPS.filter(a => a.folder === app.opens && os.canSee(a));
  return os.wm.open({
    key: app.id,
    app,
    title: app.title,
    width: 560,
    height: 360,
    build(body) {
      body.classList.add('folder');
      const grid = h('div', { className: 'folder-grid' });
      os.renderIcons(grid, inside);
      body.append(grid, h('p', { className: 'folder-hint' }, `${inside.length}개 항목. 아이콘을 두 번 누르면 실행됩니다.`));
    },
  });
}
