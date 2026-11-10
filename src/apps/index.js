// 기본 앱(OS가 직접 그리는 앱) 등록부.
// data/apps.js의 builtin: '<이름>'은 src/apps/<이름>-app.js의 open...App(os, app)과 짝이다(tools/check.py가 확인한다).
// 새 기본 앱을 만들려면 그 파일을 만들고 아래에 한 줄을 더한다. 팀원 앱(iframe)은 여기가 아니라 apps/ 폴더에 만든다.
import { openRoomApp } from './room-app.js';
import { openFolderApp } from './folder-app.js';
import { openShareApp } from './share-app.js';
import { openMusicApp } from './music-app.js';
import { openMineApp } from './mine-app.js';
import { openComputerApp } from './computer-app.js';
import { openConsoleApp } from './console-app.js';
import { openBookshelfApp } from './bookshelf-app.js';
import { openRadioApp } from './radio-app.js';
import { openTvApp } from './tv-app.js';

export const BUILTIN_APPS = {
  room: openRoomApp,
  folder: openFolderApp,
  share: openShareApp,
  music: openMusicApp,
  mine: openMineApp,
  // 가구 기믹(data/apps.js의 folder: 'furniture'). 주인이 가구에 담아 둔 것(src/likes.js)을 보여 준다
  computer: openComputerApp,
  console: openConsoleApp,
  bookshelf: openBookshelfApp,
  radio: openRadioApp,
  tv: openTvApp,
};

export { openFrameApp } from './frame-app.js';
export { openLinkApp } from './link-app.js';
