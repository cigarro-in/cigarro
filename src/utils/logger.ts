/**
 * Production-safe logging utility
 * Keeps errors available for diagnosis; suppresses other production logs.
 */

import { reportCrash } from '../lib/crashReporting';

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
  
  // Keep crash diagnostics available in the affected browser.
  if (level === 'error') {
    return (...args: unknown[]) => {
      console.error(...args);
      const error = args.find(arg => arg instanceof Error);
      // React boundaries submit their full stack separately; never serialize
      // arbitrary objects here (they may contain private customer data).
      if (error) reportCrash(error, { operation: String(args[0]).slice(0, 200) });
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

