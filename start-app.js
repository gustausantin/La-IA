
#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Iniciando La-IA...');

// Arrancar servidor API
const apiServer = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

// Esperar un poco y arrancar Vite
setTimeout(() => {
  const viteServer = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '5000'], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  viteServer.on('exit', (code) => {
    console.log(`Vite terminó con código: ${code}`);
    apiServer.kill();
  });
}, 2000);

apiServer.on('exit', (code) => {
  console.log(`API Server terminó con código: ${code}`);
  process.exit(code);
});

// Manejar cierre limpio
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando aplicación...');
  apiServer.kill();
  process.exit(0);
});
