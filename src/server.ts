import app from './app.js';
import { startBackupScheduler } from './services/backupScheduler.js';

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log(`AI Model Catalog running on http://localhost:${PORT}`);
  startBackupScheduler();
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Порт ${PORT} уже занят. Остановите другой экземпляр сервера или задайте другой PORT.`);
    process.exit(1);
  }
  throw error;
});
