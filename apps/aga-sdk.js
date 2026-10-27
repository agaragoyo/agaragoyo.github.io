// 아가라고요 앱 SDK. 앱 페이지에서 <script src="../aga-sdk.js"></script> 로 불러온다.
// 아가라고요 바깥에서 페이지를 혼자 열어도 오류 없이 동작한다 (AGA.inOS 가 false).
//
//   AGA.inOS            아가라고요 창 안에서 열렸는지
//   AGA.close()         내 창을 닫는다
//   AGA.setTitle(글자)   창 제목을 바꾼다
//   AGA.info()          { owner: 방 주인 닉네임, visitor: 친구 컴퓨터를 구경 중인지 } 를 Promise로 준다
(function () {
  const host = window.parent !== window ? window.parent : null;
  const send = msg => host && host.postMessage({ aga: 1, ...msg }, '*');
  let info = null;
  const waiting = [];

  window.addEventListener('message', e => {
    if (e.source !== host || !e.data || e.data.aga !== 1) return;
    if (e.data.type === 'info') {
      info = e.data.info;
      waiting.splice(0).forEach(resolve => resolve(info));
    }
  });

  window.AGA = {
    inOS: !!host,
    close: () => (host ? send({ type: 'close' }) : window.close()),
    setTitle: title => send({ type: 'title', title: String(title) }),
    info() {
      if (info) return Promise.resolve(info);
      if (!host) return Promise.resolve({ owner: '', visitor: false });
      return new Promise(resolve => {
        waiting.push(resolve);
        send({ type: 'hello' });
        // 바깥이 아가라고요가 아니면(다른 사이트에 임베드된 경우) 답이 오지 않으므로 기본값으로 끝낸다.
        setTimeout(() => resolve(info || { owner: '', visitor: false }), 1000);
      });
    },
  };
})();
