type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private log(level: LogLevel, message: string, meta?: unknown): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (meta) {
      console.log(logMessage, meta);
    } else {
      console.log(logMessage);
    }
  }

  info(message: string, meta?: unknown): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.log('error', message, meta);
  }

  debug(message: string, meta?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, meta);
    }
  }
}

export default new Logger();
