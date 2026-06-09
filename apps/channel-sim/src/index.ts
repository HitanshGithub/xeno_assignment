import { config } from './config';
import { createLogger } from './logger';
import { createApp } from './server';

const log = createLogger('boot');

const app = createApp();
const server = app.listen(config.port, () => {
  log.info(`channel simulator listening`, {
    port: config.port,
    speed: config.speed,
    crmBaseUrl: config.crmBaseUrl,
    usingDefaultSecrets:
      config.apiKey === 'dev-send-key-change-me' ||
      config.callbackSecret === 'dev-callback-secret-change-me',
  });
});

function shutdown(signal: string) {
  log.info(`received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  // Hard stop if connections linger.
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
