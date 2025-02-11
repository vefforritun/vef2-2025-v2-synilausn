// We explicitly disable console here since this
// is the only file that should allow writing to
// stdout and stderr
/* eslint-disable no-console */

export class Logger {
  constructor(silent = false) {
    this.silent = silent;
  }

  info(...messages) {
    if (this.silent) {
      return;
    }
    console.info(...messages);
  }

  warn(...messages) {
    if (this.silent) {
      return;
    }
    console.warn(...messages);
  }

  error(...messages) {
    if (this.silent) {
      return;
    }
    console.error(...messages);
  }

  group(...messages) {
    if (this.silent) {
      return;
    }
    console.group(...messages);
  }

  groupEnd(...messages) {
    if (this.silent) {
      return;
    }
    if (messages.length) {
      console.info(...messages);
    }
    console.groupEnd();
  }
}

export const logger = new Logger();
