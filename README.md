# Yard Sweep

TypeScript와 Three.js로 제작 중인 1인칭 마당 청소 게임 프로토타입입니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 터미널에 표시된 로컬 주소로 접속합니다.

## 조작

- WASD: 이동
- 마우스: 시점 회전
- 좌클릭: 청소
- 숫자키 1~8: 장비 교체
- Tab: 상점 열기/닫기
- T: 설정 열기/닫기

모바일에서는 가로 화면과 전체화면 플레이를 권장합니다.

## 구조

Verse8 플랫폼 배포를 위해 Vite 프로젝트 루트(`index.html`, `src/`, `public/`)를 `game/` 폴더 아래에 둔다. `vite.config.ts`가 저장소 루트에서 `root: 'game'`을 지정하며, 빌드 결과물은 `dist/`(저장소 루트)에 생성된다.
