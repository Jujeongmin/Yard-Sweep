# Yard Sweep

TypeScript + Three.js 1인칭 마당 청소 게임.

## 실행

```bash
bun install
bun run dev
```

## 조작

- WASD: 이동
- 마우스: 시점 회전
- 좌클릭: 청소
- 숫자키 1~8: 장비 교체
- Tab: 상점 열기/닫기
- T: 설정 열기/닫기

모바일은 가로 모드 전체화면 플레이 권장.

## 구조

- `game/` — 게임 소스 (Vite entry)
- `server/` — Agent8 GameServer 서버 로직 (랭킹, 닉네임)
- `dist/` — 빌드 결과물

## 테스트

```bash
npx -y @agent8/gameserver-node test
```
