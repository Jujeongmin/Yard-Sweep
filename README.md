# Yard Sweep

TypeScript + Three.js 1인칭 마당 청소 게임. Verse8(Agent8) 플랫폼용이다.

빗자루로 낙엽과 쓰레기를 치워 코인을 모으고, 장비와 능력을 강화해 다음 지역을 연다.

## 내용

- 지역 5곳: 앞마당, 정원, 돌 정원, 공원, 해변. 진행도 100%면 다음 지역이 열린다
- 도구 8종 (로우폴리 카툰 3D 모델): 빗자루, 청소기, 낫, 곡괭이. 청소·풀·돌 3종류로 나뉜다
- 콤보, 능력 강화, 로봇청소기, 미션, 업적, 일일 보물 상자
- 랭킹과 닉네임 (Agent8 GameServer), VX 상점, 리워드 광고 (`@verse8/ads`)
- 언어 4개: 한국어, 영어, 일본어, 번체 중국어

## 실행

```bash
bun install
bun run dev
```

빌드는 `bun run build` (결과물 `dist/`).

## 조작

키보드와 마우스:

- WASD: 이동
- 마우스: 시점 회전
- 좌클릭(누르고 있기): 청소
- 숫자키 1 / 2 / 3: 도구 종류 전환 (청소, 풀, 돌)
- F: 보물 상자 열기 (상자 근처에서)
- Tab: 상점 열기/닫기
- T: 설정 열기/닫기

터치 (가로 모드 전체화면 권장):

- 왼쪽 아래 조이스틱, 또는 화면 왼쪽 아무 곳이나 누르고 드래그: 이동
- 화면 오른쪽 드래그: 시점 회전
- 조준 원을 쓰레기에 맞추기: 자동 청소
- 청소 버튼 누르고 있기: 이동하면서 계속 청소

## 구조

- `game/` — 게임 소스 (Vite root)
  - `src/main.ts` — 게임 본체
  - `src/scenery.ts`, `src/sceneryKit.ts` — 지역 바깥 풍경
  - `src/ads.ts`, `src/ranking.ts`, `src/i18n.ts` — 광고, 랭킹, 다국어 문구
  - `public/assets/` — 모델(`Yardsweep-*.glb`), 이미지, 오디오
- `server/` — Agent8 GameServer 서버 로직 (랭킹, 닉네임, 저장, VX 상태)
- `tools/blender/` — 청소 오브젝트·풍경 모델을 만드는 Blender 스크립트
- `tools/icons/` — 아이콘 시트 자르는 스크립트
- `store-assets/` — 스토어 이미지와 플레이 영상
- `GAME_DESIGN.md` — 기획서
- `dist/` — 빌드 결과물 (git에 넣지 않음)

## 테스트

```bash
npx -y @agent8/gameserver-node test
```
