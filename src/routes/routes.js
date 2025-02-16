import express from 'express';
import { getQuestionDatabase } from '../lib/db.js';
import { catchErrors } from '../lib/handlers.js';

export const router = express.Router();

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function indexRoute(req, res) {
  const categories = await getQuestionDatabase()?.getCategories();
  res.render('index', { title: 'Vefforritunarspurningarsíðan', categories });
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
  res.render('form', { title: 'Búa til spurningu' });
}

async function createQuestionRoute(req, res) {
  // TODO
}

router.get('/', catchErrors(indexRoute));
router.get('/spurningar', catchErrors(categoryIndexRoute));
router.get('/spurningar/:slug', catchErrors(categoryRoute));
router.get('/spurningar/bua-til', catchErrors(createQuestionFormRoute));
router.post('/spurningar/bua-til', catchErrors(createQuestionRoute));
