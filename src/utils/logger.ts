/**
 * Production-safe logging utility
 * Removes console logs in production builds
 */

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

interface Logger {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

const isDevelopment = import.meta.env.DEV;

const createLogger = (level: LogLevel): (...args: any[]) => void => {
  if (isDevelopment) {
    return console[level].bind(console);
  }
  
  // In production, only log errors to a proper logging service
  if (level === 'error') {
    // TODO: Replace with proper logging service (e.g., Sentry, LogRocket)
    return (...args: any[]) => {
      // Silent in production for now
      // In the future, send to logging service
    };
  }
  
  // All other log levels are silent in production
  return () => {};
};

export const logger: Logger = {
  log: createLogger('log'),
  warn: createLogger('warn'),
  error: createLogger('error'),
  info: createLogger('info'),
  debug: createLogger('debug'),
};

// Export individual methods for convenience
export const { log, warn, error, info, debug } = logger;
