import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 开发模式:Vite 起 5173 端口,把 /api 请求代理到 Express(3000)
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // 后端没启动时,给前端返回 JSON 而不是空响应,页面能提示友好错误
        configure(proxy) {
          proxy.on('error', (err, req, res) => {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
            }
            res.end(JSON.stringify({ code: 502, message: '后端服务未启动,请先在另一个终端运行 npm start' }));
          });
        },
      },
    },
  },
});
