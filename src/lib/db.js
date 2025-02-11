import xss from 'xss';
import { Database } from './db.client.js';
import { environment } from './environment.js';
import { Logger, logger as loggerSingleton } from './logger.js';

export class QuestionDatabase {
  /**
   * @param {Database} db
   * @param {Logger} logger
   */
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  slugify(text) {
    // temp copilot generated..
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(/[^\w-]+/g, '') // Remove all non-word chars
      .replace(/--+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start of text
      .replace(/-+$/, ''); // Trim - from end of text
  }

  replaceHtmlEntities(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  stringToHtml(str) {
    return this.replaceHtmlEntities(str)
      .split('\n\n')
      .map((line) => `<p>${line}</p>`)
      .join('')
      .replace(/\n/g, '<br>')
      .replace(/ {2}/g, '&nbsp;&nbsp;');
  }

  /**
   * Insert a category into the database.
   * @param {string} name Name of the category.
   * @returns {Promise<import('../types.js').DatabaseCategory | null>}
   */
  async insertCategory(name) {
    const safeName = xss(this.replaceHtmlEntities(name));

    const slug = this.slugify(safeName);
    const result = await this.db.query(
      'INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id, name, slug',
      [safeName, slug]
    );
    if (result && result.rows.length === 1) {
      /** @type import('../types.js').DatabaseCategory */
      const resultCategory = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        slug: result.rows[0].slug,
      };
      return resultCategory;
    }
    return null;
  }

  /**
   * Insert categories into the database.
   * @param {string[]} categories List of categories to insert.
   * @returns {Promise<Array<import('../types.js').DatabaseCategory>>} List of categories inserted.
   */
  async insertCategories(categories) {
    /** @type Array<import('../types.js').DatabaseCategory> */
    const inserted = [];
    for await (const category of categories) {
      const result = await this.insertCategory(category);
      if (result) {
        inserted.push(result);
      } else {
        this.logger.warn('unable to insert category', { category });
      }
    }
    return inserted;
  }

  /**
   *
   * @param {import('../types.js').Question} question
   * @param {string} categoryId
   * @returns
   */
  async insertQuestion(question, categoryId) {
    const safeQuestionText = xss(this.stringToHtml(question.question));
    const result = await this.db.query(
      'INSERT INTO questions (text, category_id) VALUES ($1, $2) RETURNING id, text, category_id',
      [safeQuestionText, categoryId]
    );
    if (result && result.rows.length === 1) {
      /** @type import('../types.js').DatabaseQuestion */
      const resultQuestion = {
        id: result.rows[0].id,
        text: result.rows[0].text,
        category_id: result.rows[0].category_id,
      };
      return resultQuestion;
    }
    return null;
  }

  /**
   *
   * @param {import('../types.js').Answer} answer
   * @param {string} questionId
   * @returns
   */
  async insertAnswer(answer, questionId) {
    const safeAnswerText = xss(this.replaceHtmlEntities(answer.answer));
    const safeCorrect = answer.correct ? 1 : 0;
    const result = await this.db.query(
      'INSERT INTO answers (text, question_id, correct) VALUES ($1, $2, $3) RETURNING id, text, question_id',
      [safeAnswerText, questionId, safeCorrect.toString()]
    );
    if (result && result.rows.length === 1) {
      /** @type import('../types.js').DatabaseAnswer */
      const resultAnswer = {
        id: result.rows[0].id,
        text: result.rows[0].text,
        question_id: result.rows[0].question_id,
        correct: Boolean(result.rows[0].correct),
      };
      return resultAnswer;
    }
    return null;
  }

  /**
   * @param {import('../types.js').Answer[]} answers
   * @param {string} questionId
   * @returns {Promise<Array<import('../types.js').DatabaseAnswer>>}
   */
  async insertAnswers(answers, questionId) {
    /** @type Array<import('../types.js').DatabaseAnswer> */
    const inserted = [];
    for await (const answer of answers) {
      const result = await this.insertAnswer(answer, questionId);
      if (result) {
        inserted.push(result);
      } else {
        this.logger.warn('unable to insert answer', { answer });
      }
    }
    return inserted;
  }
}

/** @type {QuestionDatabase | null} */
let qdb = null;

/**
 * Return a singleton question database instance.
 * @returns {QuestionDatabase | null}
 */
export function getQuestionDatabase() {
  if (qdb) {
    return qdb;
  }

  const env = environment(process.env, loggerSingleton);

  if (!env) {
    return null;
  }
  const db = new Database(env.connectionString, loggerSingleton);
  db.open();
  qdb = new QuestionDatabase(db, loggerSingleton);
  return qdb;
}
