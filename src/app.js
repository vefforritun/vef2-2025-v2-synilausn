import express from 'express';
import session from 'express-session';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { environment } from './lib/environment.js';
import { handler404, handlerError } from './lib/handlers.js';
import { logger } from './lib/logger.js';
import { router } from './routes/routes.js';

import { getQuestionDatabase } from './lib/db.js';
import { isInvalid } from './lib/is-invalid.js';

const env = environment(process.env, logger);

if (!env) {
  process.exit(1);
}

const { port, sessionSecret } = env;

const sessionOptions = {
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
};

const path = dirname(fileURLToPath(import.meta.url));

const app = express();

app.set('views', join(path, '../views'));
app.set('view engine', 'ejs');

app.locals = {
  isInvalid,
};

app.use(express.urlencoded({ extended: true }));
app.use(session(sessionOptions));

app.use('/', router);
app.use(express.static(join(path, '../public')));
app.use(handler404);
app.use(handlerError);

const server = app.listen(port, () => {
  logger.info(`🚀 Server running at http://localhost:${port}/`);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 shutting down');
  server.close((e) => {
    if (e) {
      logger.error('error closing server', { error: e });
    }
  });

  if (!(await getQuestionDatabase()?.db.close())) {
    logger.error('error closing database connection');
  }
});
