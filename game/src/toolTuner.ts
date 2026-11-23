// 개발 서버 전용 도구 자세 튜너. http://localhost:5173/?tooltune 로 연다.
// 슬라이더를 움직이면 손에 든 도구가 바로 갱신되고, "저장"을 누르면 game/src/toolModelFit.json에 바로 쓴다(vite.config.ts 플러그인).
// 프로덕션 빌드에는 포함되지 않는다(main.ts에서 import.meta.env.DEV일 때만 동적 import).
import type { ToolId } from './gameData';
import { toolOrder } from './gameData';
import type { ToolModelFit } from './main';

type NumericKey = Exclude<keyof ToolModelFit, 'flip'>;
const sliders: Array<{ key: NumericKey; label: string; min: number; max: number; step: number }> = [
  { key: 'length', label: '길이', min: 0.4, max: 3, step: 0.01 },
  { key: 'yaw', label: '모델 Y회전(정면)', min: -Math.PI, max: Math.PI, step: 0.01 },
  { key: 'rx', label: '회전 X', min: -Math.PI, max: Math.PI, step: 0.01 },
  { key: 'ry', label: '회전 Y', min: -Math.PI, max: Math.PI, step: 0.01 },
  { key: 'rz', label: '회전 Z', min: -Math.PI, max: Math.PI, step: 0.01 },
  { key: 'px', label: '위치 X(좌우)', min: -2, max: 2, step: 0.01 },
  { key: 'py', label: '위치 Y(상하)', min: -2, max: 2, step: 0.01 },
  { key: 'pz', label: '위치 Z(앞뒤)', min: -2, max: 2, step: 0.01 },
];

const round = (n: number) => Math.round(n * 1000) / 1000;

const LAST_TOOL_KEY = 'tooltune.lastTool';

export function mountToolTuner(fits: Record<ToolId, ToolModelFit>, show: (id: ToolId) => void) {
  const initial = JSON.parse(JSON.stringify(fits)) as Record<ToolId, ToolModelFit>;
  let current: ToolId = toolOrder[0];

  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed', 'top:8px', 'left:8px', 'z-index:2147483647', 'width:300px', 'max-height:calc(100vh - 16px)',
    'overflow:auto', 'background:rgba(20,44,59,.94)', 'color:#eee', 'font:700 12px/1.4 Nunito,Jua,sans-serif',
    'padding:10px', 'border-radius:10px', 'box-shadow:0 4px 16px rgba(0,0,0,.4)', 'pointer-events:auto',
  ].join(';');
  // 패널 조작이 게임 입력(포인터락, 청소 클릭, 숫자키 도구 전환)으로 새지 않게 막는다.
  for (const type of ['pointerdown', 'mousedown', 'click', 'keydown', 'keyup', 'wheel', 'touchstart']) {
    panel.addEventListener(type, (event) => event.stopPropagation());
  }

  const title = document.createElement('div');
  title.textContent = '도구 자세 튜너';
  title.style.cssText = 'font-family:Jua,sans-serif;font-size:17px;margin-bottom:6px';
  panel.append(title);

  const select = document.createElement('select');
  select.style.cssText = 'width:100%;margin-bottom:6px;padding:4px';
  for (const id of toolOrder) select.add(new Option(id, id));
  panel.append(select);

  const headUpRow = document.createElement('label');
  headUpRow.style.cssText = 'display:block;margin:4px 0';
  const headUp = document.createElement('input');
  headUp.type = 'checkbox';
  headUpRow.append(headUp, ' flip (작업부 방향 뒤집기)');
  panel.append(headUpRow);

  const inputs = new Map<NumericKey, { range: HTMLInputElement; number: HTMLInputElement }>();
  for (const s of sliders) {
    const row = document.createElement('div');
    row.style.cssText = 'margin:6px 0';
    const label = document.createElement('div');
    label.textContent = s.label;
    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(s.min);
    range.max = String(s.max);
    range.step = String(s.step);
    range.style.cssText = 'width:200px;vertical-align:middle';
    const number = document.createElement('input');
    number.type = 'number';
    number.step = String(s.step);
    number.style.cssText = 'width:70px;margin-left:6px';
    const apply = (value: number) => {
      if (!Number.isFinite(value)) return;
      fits[current][s.key] = value;
      range.value = String(value);
      number.value = String(round(value));
      show(current);
    };
    range.addEventListener('input', () => apply(Number(range.value)));
    number.addEventListener('change', () => apply(Number(number.value)));
    row.append(label, range, number);
    panel.append(row);
    inputs.set(s.key, { range, number });
  }

  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;gap:6px;margin:8px 0';
  const makeButton = (text: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = 'flex:1;padding:6px;border:0;border-radius:6px;background:#4caf50;color:#fff;cursor:pointer';
    b.addEventListener('click', onClick);
    buttons.append(b);
    return b;
  };
  const status = document.createElement('div');
  status.style.cssText = 'min-height:16px;color:#9f9';
  const saveButton = makeButton('저장', () => {
    saveButton.disabled = true;
    status.textContent = '저장 중…';
    fetch('/__tooltune/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fits) })
      .then(async (res) => {
        const result = await res.json() as { ok: boolean; error?: string };
        if (!result.ok) throw new Error(result.error);
        // toolModelFit.json이 바뀌면 Vite가 페이지를 다시 불러온다. 보던 도구를 기억해 둔다.
        try { sessionStorage.setItem(LAST_TOOL_KEY, current); } catch { /* 저장소 막힘: 첫 도구로 열림 */ }
        status.textContent = '저장됨 (toolModelFit.json)';
      })
      .catch((error: unknown) => { status.style.color = '#f88'; status.textContent = `저장 실패: ${String(error)}`; })
      .finally(() => { saveButton.disabled = false; });
  });
  saveButton.style.background = '#2196f3';
  makeButton('이 도구 되돌리기', () => {
    Object.assign(fits[current], initial[current]);
    load(current);
  });
  panel.append(buttons, status);

  function load(id: ToolId) {
    current = id;
    select.value = id;
    headUp.checked = fits[id].flip;
    for (const s of sliders) {
      const value = fits[id][s.key];
      const pair = inputs.get(s.key)!;
      pair.range.value = String(value);
      pair.number.value = String(round(value));
    }
    show(id);
  }
  select.addEventListener('change', () => load(select.value as ToolId));
  headUp.addEventListener('change', () => {
    fits[current].flip = headUp.checked;
    show(current);
  });

  document.body.append(panel);
  let saved: string | null = null;
  try { saved = sessionStorage.getItem(LAST_TOOL_KEY); } catch { /* 무시 */ }
  load(saved && (toolOrder as string[]).includes(saved) ? saved as ToolId : current);
}
