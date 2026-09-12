const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/authController');

const router = express.Router();

// 20 attempts per 15 minutes per IP. Overridable so the test suite, which
// signs up many accounts from one address, is not throttled by its own setup.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' }
});

router.post(
  '/signup',
  authLimiter,
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate,
  ctrl.signup
);

router.post(
  '/login',
  authLimiter,
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
  ctrl.login
);

router.post('/logout', requireAuth, ctrl.logout);
router.get('/me', optionalAuth, ctrl.me);

module.exports = router;
