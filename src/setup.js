import { join } from 'node:path';
import { getQuestionDatabase, QuestionDatabase } from './lib/db.js';
import { environment } from './lib/environment.js';
import { readFile } from './lib/file.js';
import { logger, logger as loggerSingleton } from './lib/logger.js';
import { parseIndexFile, parseQuestionCategory } from './lib/parse.js';

/**
 * @typedef {import('./types.js').FileItem} FileItem
 * @typedef {import('./types.js').QuestionCategory} QuestionCategory
 */

const SCHEMA_FILE = 'sql/schema.sql';
const DROP_SCHEMA_FILE = 'sql/drop.sql';
const INSERT_FILE = 'sql/insert.sql';
const INPUT_DIR = 'data';

/**
 * @param {QuestionDatabase} qdb
 * @param {import('./lib/logger.js').Logger} logger
 * @returns {Promise<boolean>}
 */
async function setupDbFromFiles(qdb, logger) {
  const dropScript = await readFile(DROP_SCHEMA_FILE);
  const createScript = await readFile(SCHEMA_FILE);
  const insertScript = await readFile(INSERT_FILE);

  if (!dropScript || !createScript || !insertScript) {
    logger.error('unable to read sql files');
    return false;
  }

  if (await qdb.db.query(dropScript)) {
    logger.info('schema dropped');
  } else {
    logger.info('schema not dropped, exiting');
    return false;
  }

  if (await qdb.db.query(createScript)) {
    logger.info('schema created');
  } else {
    logger.info('schema not created');
    return false;
  }

  if (await qdb.db.query(insertScript)) {
    logger.info('data inserted');
  } else {
    logger.info('data not inserted');
    return false;
  }

  return true;
}

/**
 *
 * @param {FileItem} fileItem File item to process
 * @returns {Promise<QuestionCategory|null>} Parsed question category or null if invalid
 */
async function readAndParseFile(fileItem) {
  const content = await readFile(join(INPUT_DIR, fileItem.file));

  if (!content) {
    logger.error('unable to read file', fileItem);
    return null;
  }
  const parsed = parseQuestionCategory(content);

  if (!parsed) {
    logger.error('unable to parse file', fileItem);
    return null;
  }

  parsed.file = fileItem.file;

  return parsed;
}

/**
 * @param {QuestionDatabase} db
 * @param {import('./lib/logger.js').Logger} logger
 */
async function setupData(db, logger) {
  logger.group('reading and parsing index file');
  const indexFile = await readFile(join(INPUT_DIR, 'index.json'));

  if (!indexFile) {
    logger.error('unable to read index file');
    return;
  }
  const index = parseIndexFile(indexFile);
  logger.info('index file length:', index.length);
  logger.groupEnd();

  /** @type QuestionCategory[] */
  let questionCategoryFiles = [];
  for await (const { title, file } of index) {
    logger.group('processing file', file);
    const result = await readAndParseFile({ title, file });

    if (result) {
      questionCategoryFiles.push(result);
    }
    logger.groupEnd();
  }

  logger.group('insert data');
  const categories = questionCategoryFiles.flatMap((category) =>
    category.questions.length > 0 ? [category.title] : []
  );
  const insertedCategories = await db.insertCategories(categories);
  logger.groupEnd();

  logger.group('insert questions and answers');
  for await (const category of questionCategoryFiles) {
    if (category.questions.length === 0) {
      logger.error('no questions found for category', category);
      continue;
    }

    const dbCategory = insertedCategories.find(
      (c) => c.name === category.title
    );

    if (!dbCategory) {
      logger.error('unable to find category', category);
      continue;
    }

    for await (const question of category.questions) {
      const questionResult = await db.insertQuestion(
        question,
        dbCategory.id.toString()
      );

      if (!questionResult) {
        logger.error('unable to insert question', question);
        continue;
      }

      const answersResult = await db.insertAnswers(
        question.answers,
        questionResult.id.toString()
      );

      if (!answersResult) {
        logger.error('unable to insert answers', question);
      }
    }
    logger.info('inserted questions and answers for category', category.title);
  }

  return true;
}

async function create() {
  const logger = loggerSingleton;
  const env = environment(process.env, logger);

  if (!env) {
    process.exit(1);
  }

  logger.info('starting setup');

  const qdb = getQuestionDatabase();

  if (!qdb) {
    logger.error('unable to get question database');
    process.exit(1);
  }

  const resultFromFileSetup = await setupDbFromFiles(qdb, logger);

  if (!resultFromFileSetup) {
    logger.info('error setting up database from files');
    process.exit(1);
  }

  let resultFromReadingData;
  try {
    resultFromReadingData = await setupData(qdb, logger);
  } catch (e) {
    logger.error(e);
  }

  if (!resultFromReadingData) {
    logger.info('error reading data from files');
    process.exit(1);
  }

  logger.info('setup complete');
  await qdb.db.close();
}

create().catch((err) => {
  logger.error('error running setup', err);
});
