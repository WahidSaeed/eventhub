const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/authMiddleware');
const users = require('../controllers/userController');

const router = express.Router();

router.get('/me/dashboard', requireAuth, users.dashboard);

router.put(
  '/me',
  requireAuth,
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate,
  users.updateProfile
);

module.exports = router;
