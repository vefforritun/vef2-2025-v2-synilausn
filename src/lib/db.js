import xss from 'xss';
import { Database } from './db.client.js';
import { environment } from './environment.js';
import { Logger, logger as loggerSingleton } from './logger.js';

const MAX_SLUG_LENGTH = 100;

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

  /**
   * Get all categories from the database.
   * @returns {Promise<Array<import('../types.js').DatabaseCategory>>}
   */
  async getCategories() {
    const query = 'SELECT id, name, slug FROM categories';
    const result = await this.db.query(query);
    if (result) {
      /** @type Array<import('../types.js').DatabaseCategory> */
      const categories = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
      }));
      return categories;
    }
    return [];
  }

  /**
   *
   * @param {string} slug
   * @returns {Promise<import('../types.js').DatabaseCategory | null>}
   */
  async getCategoryBySlug(slug) {
    if (!slug || typeof slug !== 'string' || slug.length > MAX_SLUG_LENGTH) {
      return null;
    }

    const query = 'SELECT id, name, slug FROM categories WHERE slug = $1';
    const result = await this.db.query(query, [slug]);
    if (result && result.rows.length === 1) {
      /** @type import('../types.js').DatabaseCategory */
      const category = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        slug: result.rows[0].slug,
      };
      return category;
    }
    return null;
  }

  /**
   * Zip (combine) questions and answers together.
   * @param {import('../types.js').DatabaseQuestion[]} questions
   * @param {import('../types.js').DatabaseAnswer[]} answers
   * @returns {import('../types.js').QuestionCategory}
   */
  zipQuestionsAndAnswers(questions, answers) {
    // zip with Map
    /** @type Map<number,import('../types.js').Question> */
    const questionMap = new Map();
    questions.forEach((question) => {
      questionMap.set(question.id, {
        question: question.text,
        answers: [],
      });
    });

    answers.forEach((answer) => {
      const question = questionMap.get(answer.question_id);
      if (question) {
        question.answers.push({
          answer: answer.text,
          correct: answer.correct,
        });
      }
    });

    const mappedQuestions = Array.from(questionMap.values());

    /** @type {import('../types.js').QuestionCategory} */
    const result = {
      // We can assume the first (and every) question has the same category
      title: questions[0].category_name ?? '',
      questions: mappedQuestions,
    };

    return result;
  }

  /**
   * Fetch questions and answers by category with two queries.
   * It's easy to fall into a N+1 query trap here.
   * @param {string} categorySlug
   * @returns {Promise<import('../types.js').QuestionCategory | null>}
   */
  async getQuestionsAndAnswersByCategory(categorySlug) {
    // Start by getting the category and question
    const categoryQuery = `
      SELECT q.id, q.text, c.name AS category_name
      FROM questions AS q
      JOIN categories AS c ON q.category_id = c.id
      WHERE c.slug = $1
    `;
    const categoryResult = await this.db.query(categoryQuery, [categorySlug]);

    if (!categoryResult || categoryResult.rows.length === 0) {
      return null;
    }

    /** @type Array<import('../types.js').DatabaseQuestion> */
    const questions = categoryResult.rows.map((row) => ({
      id: row.id,
      text: row.text,
      category_id: row.category_id,
      category_name: row.category_name,
    }));

    const answersQuery = `
      SELECT a.text, a.correct, a.question_id
      FROM answers AS a
      JOIN questions AS q ON a.question_id = q.id
      JOIN categories AS c ON q.category_id = c.id
      WHERE c.slug = $1
    `;
    const answersResult = await this.db.query(answersQuery, [categorySlug]);

    if (!answersResult) {
      return null;
    }

    /** @type Array<import('../types.js').DatabaseAnswer> */
    const answers = answersResult.rows.map((row) => ({
      id: row.id,
      text: row.text,
      question_id: row.question_id,
      correct: row.correct,
    }));

    return this.zipQuestionsAndAnswers(questions, answers);
  }

  /**
   * Create a question in the database.
   * @param {string} question
   * @param {string} categoryId
   * @param {string[]} answers
   * @param {number} correctAnswerIndex
   * @returns {Promise<boolean>}
   */
  async createQuestion(question, categoryId, answers, correctAnswerIndex) {
    const client = await this.db.connect();
    if (!client) {
      return false;
    }

    const questionResult = await this.insertQuestion(
      { question, answers: [] },
      categoryId
    );
    if (!questionResult) {
      return false;
    }

    await this.insertAnswers(
      answers.map((answer, i) => ({
        answer,
        correct: i === correctAnswerIndex,
      })),
      questionResult.id.toString()
    );

    return true;
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
