import { body } from 'express-validator';
import xss from 'xss';
import { getQuestionDatabase } from './db.js';

export function createQuestionValidationMiddleware() {
  return [
    body('question')
      .isString()
      .withMessage('Spurning verður að vera strengur')
      .isLength({ min: 10, max: 500 })
      .withMessage(
        'Spurning verður að vera að minnsta kosti 10 stafir, að hámarki 500'
      ),
    body('category').custom(async (value) => {
      const categories = (await getQuestionDatabase()?.getCategories()) ?? [];

      if (!categories.find((c) => c.id.toString() === value)) {
        throw new Error('Flokkur verður að vera gildur');
      }
      return true;
    }),
    body('answers')
      .isArray({ min: 4, max: 4 })
      .withMessage('Gefa verður upp fjögur svör'),
    body('answers.*')
      .isString()
      .withMessage('Svar verður að vera strengur')
      .isLength({ min: 10, max: 500 })
      .withMessage(
        'Svar verður að vera að minnsta kosti 10 stafir, að hámarki 500'
      ),
    body('correct')
      .isIn(['0', '1', '2', '3'])
      .withMessage('Velja verður að vera rétt svar'),
  ];
}

// Viljum keyra sér og með validation, ver gegn „self XSS“
export function xssSanitizationMiddleware() {
  return [body('question').customSanitizer((v) => xss(v))];
}

export function sanitizationMiddleware() {
  return [
    body('question').trim().escape(),
    body('category').trim().escape(),
    body('answers').trim().escape(),
    body('correct').trim().escape(),
  ];
}
