import express from 'express';
import { validationResult } from 'express-validator';
import { getQuestionDatabase } from '../lib/db.js';
import { catchErrors } from '../lib/handlers.js';
import {
  createQuestionValidationMiddleware,
  sanitizationMiddleware,
  xssSanitizationMiddleware,
} from '../lib/validation.js';

export const router = express.Router();

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function indexRoute(req, res) {
  let message = '';
  if (
    'messages' in req.session &&
    req.session.messages &&
    Array.isArray(req.session.messages)
  ) {
    message = req.session.messages.join(', ');
    req.session.messages = [];
  }

  const categories = await getQuestionDatabase()?.getCategories();
  res.render('index', {
    title: 'Vefforritunarspurningarsíðan',
    categories,
    message,
  });
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function categoryIndexRoute(req, res) {
  return res.redirect('/');
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function categoryRoute(req, res, next) {
  const paramsCategorySlug = req.params.slug;

  const category =
    await getQuestionDatabase()?.getQuestionsAndAnswersByCategory(
      paramsCategorySlug
    );

  // 404s
  if (!category) {
    return next();
  }

  res.render('category', { title: category.title, category });
}

async function createQuestionFormRoute(req, res) {
  const categories = await getQuestionDatabase()?.getCategories();
  const data = {};
  res.render('form', { title: 'Búa til spurningu', data, categories });
}

async function validationCheck(req, res, next) {
  const categories = await getQuestionDatabase()?.getCategories();
  const { question, category, answers, correct } = req.body;
  const data = { question, category, answers, correct };
  const validation = validationResult(req);

  if (!validation.isEmpty()) {
    return res.render('form', {
      title: 'Búa til spurningu',
      data,
      categories,
      errors: validation.array(),
    });
  }

  return next();
}

async function createQuestionRoute(req, res) {
  const categories = await getQuestionDatabase()?.getCategories();

  const { question, category, answers, correct } = req.body;

  const data = { question, category, answers, correct };

  const created = await getQuestionDatabase()?.createQuestion(
    question,
    category,
    answers,
    correct
  );

  if (!created) {
    req.session.messages = ['Ekki tókst að bæta við spurningu.'];
  } else {
    req.session.messages = ['Spurningu bætt við.'];
  }

  return res.redirect('/');
}

router.get('/', catchErrors(indexRoute));
router.get('/spurningar', catchErrors(categoryIndexRoute));
router.get('/spurningar/:slug', catchErrors(categoryRoute));
router.get('/spurningar/bua-til', catchErrors(createQuestionFormRoute));
router.post(
  '/spurningar/bua-til',
  createQuestionValidationMiddleware(),
  xssSanitizationMiddleware(),
  catchErrors(validationCheck),
  sanitizationMiddleware(),
  catchErrors(createQuestionRoute)
);
