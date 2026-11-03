// 기본 앱(OS가 직접 그리는 앱) 등록부.
// data/apps.js의 builtin: '<이름>'은 src/apps/<이름>-app.js의 open...App(os, app)과 짝이다(tools/check.py가 확인한다).
// 새 기본 앱을 만들려면 그 파일을 만들고 아래에 한 줄을 더한다. 팀원 앱(iframe)은 여기가 아니라 apps/ 폴더에 만든다.
import { openRoomApp } from './room-app.js';
import { openFolderApp } from './folder-app.js';
import { openShareApp } from './share-app.js';
import { openMouseApp } from './mouse-app.js';

export const BUILTIN_APPS = {
  room: openRoomApp,
  folder: openFolderApp,
  share: openShareApp,
  mouse: openMouseApp,
};

export { openFrameApp } from './frame-app.js';
export { openLinkApp } from './link-app.js';
