// CRT 화면 효과 가운데 그레인의 노이즈 그림을 만든다. 움직임은 CSS(.fx-grain::before)가 맡는다.
// 화면을 볼록하게 휘던 효과와 그 클릭 보정 층은 2026-11-10 시대를 2005로 정하면서 뺐다(알파 테스트 피드백).
//
// 노이즈 그림은 한 장만 만든다. 같은 노이즈를 1초에 24번 다른 자리로 옮기면 새 노이즈처럼 보이고, 브라우저는 화면을 다시 칠하지 않아도 된다.
// (예전에는 화면 절반 크기 캔버스를 1초에 24번 새로 칠해서 그레인을 켜 두는 동안 CPU를 계속 썼다.)
export function initGrain(grain) {
  const TILE = 128;
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(TILE, TILE);
  const d = img.data;
  for (let k = 0; k < d.length; k += 4) {
    d[k] = d[k + 1] = d[k + 2] = (Math.random() * 255) | 0;
    d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grain.style.setProperty('--grain-img', `url("${c.toDataURL()}")`);
}
