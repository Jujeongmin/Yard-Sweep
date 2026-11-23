import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// 개발 서버 전용: ?tooltune 패널의 "저장" 버튼이 POST한 도구 자세값을 game/src/toolModelFit.json에 바로 쓴다.
// apply: 'serve'라 빌드/배포본에는 이 엔드포인트가 없다.
const TOOL_FIT_FILE = resolve(__dirname, 'game/src/toolModelFit.json');
const TOOL_IDS = ['basicBroom', 'wideBroom', 'vacuum', 'copperSickle', 'metalSickle', 'pickaxe', 'neonSickle', 'neonPickaxe'];
const FIT_KEYS = ['flip', 'yaw', 'length', 'rx', 'ry', 'rz', 'px', 'py', 'pz'];

function toolTuneSave(): Plugin {
  return {
    name: 'tooltune-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__tooltune/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 100_000) req.destroy();
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body) as Record<string, Record<string, unknown>>;
            // 알려진 도구·키만, 숫자/불리언만 통과시켜 파일 형태를 고정한다.
            const clean: Record<string, Record<string, number | boolean>> = {};
            for (const id of TOOL_IDS) {
              const fit = parsed[id];
              if (!fit) throw new Error(`missing ${id}`);
              clean[id] = {};
              for (const key of FIT_KEYS) {
                const value = fit[key];
                if (key === 'flip' ? typeof value !== 'boolean' : typeof value !== 'number' || !Number.isFinite(value)) {
                  throw new Error(`bad ${id}.${key}`);
                }
                clean[id][key] = key === 'flip' ? value as boolean : Math.round((value as number) * 1000) / 1000;
              }
            }
            const lines = TOOL_IDS.map((id) => `  "${id}": ${JSON.stringify(clean[id])}`);
            writeFileSync(TOOL_FIT_FILE, `{\n${lines.join(',\n')}\n}\n`);
            res.setHeader('content-type', 'application/json');
            res.end('{"ok":true}');
          } catch (error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(error) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  root: 'game',
  plugins: [toolTuneSave()],
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
