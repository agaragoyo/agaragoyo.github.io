// 기본 앱: 배경음악. 바탕화면 내 방에서 틀 곡을 고르고, 배경음악만 따로 끄고 켠다(효과음은 그대로 난다).
// 이 창이 열려 있는 동안은 놀이터에 있어도 고른 곡을 틀어 바로 들어 볼 수 있다(src/sound.js의 holdMusic, 'room').
// 고른 값은 settings의 music, musicOn에 저장된다. 모니터 아래 소리 버튼(settings.sound)이 꺼지면 모든 소리가 꺼진다.
// 모양은 그 시절 대화상자의 제목 붙은 묶음(fieldset)을 따른다.
import { h } from '../util.js';
import { ROOM_MUSIC, roomMusic, holdMusic } from '../sound.js';

export function openMusicApp(os, app) {
  const { settings } = os;
  const group = (title, ...children) => h('fieldset', { className: 'music-group' }, h('legend', {}, title), ...children);

  return os.wm.open({
    key: app.id,
    app,
    title: '배경음악',
    width: 340,
    height: 330,
    build(body) {
      body.classList.add('music-app');

      const onBox = h('input', { type: 'checkbox' });
      onBox.addEventListener('change', () => settings.set({ musicOn: onBox.checked }));
      const picks = ROOM_MUSIC.map(m => {
        const radio = h('input', { type: 'radio', name: 'room-music', value: m.id });
        radio.addEventListener('change', () => settings.set({ music: m.id, musicOn: true }));
        return h('label', { className: 'music-pick' }, radio, m.name);
      });
      const note = h('p', { className: 'meta' });

      body.append(
        group('배경음악', h('label', { className: 'music-pick' }, onBox, '배경음악 틀기')),
        group('내 방에서 틀 곡', ...picks),
        note,
      );

      const render = () => {
        onBox.checked = !!settings.get('musicOn');
        const now = roomMusic().id;
        picks.forEach((label, i) => { label.querySelector('input').checked = ROOM_MUSIC[i].id === now; });
        note.textContent = settings.get('sound')
          ? '놀이터와 방 꾸미기, 미니게임에서는 그곳 음악이 나옵니다.'
          : '지금은 소리가 나지 않습니다. 모니터 아래 소리 버튼을 누르면 다시 나옵니다.';
      };
      render();
      const stopListening = settings.subscribe(render);
      const releaseMusic = holdMusic('music-app', 'room');
      return () => {
        stopListening();
        releaseMusic();
      };
    },
  });
}
