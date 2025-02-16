/**
 * @typedef {Object} FileItem
 * @property {string} title Title of the file
 * @property {string} file File name
 */

/**
 * @typedef {Object} Answer
 * @property {string} answer Answer text
 * @property {boolean} correct Is the answer correct or not
 */

/**
 * @typedef {Object} Question
 * @property {string} question Question text
 * @property {Answer[]} answers Answers to the question
 */

/**
 * @typedef {Object} QuestionCategory
 * @property {string} title Title of the category
 * @property {string} [file] File name
 * @property {Question[]} questions Questions in the category
 */

/**
 * @typedef {Object} DatabaseCategory
 * @property {number} id
 * @property {string} name
 * @property {string} slug
 */

/**
 * @typedef {Object} DatabaseQuestion
 * @property {number} id
 * @property {string} text
 * @property {number} category_id
 * @property {string} [category_name]
 */

/**
 * @typedef {Object} DatabaseAnswer
 * @property {number} id
 * @property {string} text
 * @property {number} question_id
 * @property {boolean} correct
 */

export default {};
