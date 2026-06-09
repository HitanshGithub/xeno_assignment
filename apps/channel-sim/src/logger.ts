/** Minimal levelled logger with a scope tag. Structured enough to grep. */
type Level = 'debug' | 'info' | 'warn' | 'error';

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

export function createLogger(scope: string) {
  function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
    if (level === 'debug' && process.env.DEBUG !== 'true') return;
    const time = new Date().toISOString();
    const head = `${COLORS[level]}${level.toUpperCase().padEnd(5)}${RESET}`;
    const line = `${time} ${head} [${scope}] ${msg}`;
    const out = meta && Object.keys(meta).length ? `${line} ${JSON.stringify(meta)}` : line;
    (level === 'error' ? console.error : console.log)(out);
  }
  return {
    debug: (m: string, meta?: Record<string, unknown>) => emit('debug', m, meta),
    info: (m: string, meta?: Record<string, unknown>) => emit('info', m, meta),
    warn: (m: string, meta?: Record<string, unknown>) => emit('warn', m, meta),
    error: (m: string, meta?: Record<string, unknown>) => emit('error', m, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
