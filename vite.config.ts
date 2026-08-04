import { defineConfig } from 'vite';

export default defineConfig({
  root: 'game',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // three.js는 게임 코드보다 훨씬 덜 바뀌므로 별도 청크로 분리한다.
        // 게임 로직만 고쳐 배포해도 유저는 three 청크를 캐시에서 재사용한다.
        manualChunks: {
          three: ['three', 'three/examples/jsm/loaders/GLTFLoader.js'],
        },
      },
    },
  },
});
