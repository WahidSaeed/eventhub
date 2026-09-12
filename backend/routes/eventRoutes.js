const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { CATEGORIES } = require('../models/Event');
const events = require('../controllers/eventController');
const rsvps = require('../controllers/rsvpController');

const router = express.Router();

const eventRules = [
  body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('date').isISO8601().withMessage('A valid date is required'),
  body('category').optional().isIn(CATEGORIES).withMessage('Unknown category'),
  body('capacity').optional().isInt({ min: 0 }).withMessage('Capacity must be zero or more'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be zero or more'),
  body('note').optional().isString().trim().isLength({ max: 40 }).withMessage('Note must be 40 characters or fewer'),
  body('description').optional().isString(),
  body('venueName').optional().isString(),
  body('address').optional().isString()
];

router.get('/', events.list);
router.get('/:id', param('id').isMongoId(), validate, optionalAuth, events.detail);

router.post('/', requireAuth, requireAdmin, eventRules, validate, events.create);
router.put('/:id', requireAuth, requireAdmin, param('id').isMongoId(), eventRules, validate, events.update);
router.delete('/:id', requireAuth, requireAdmin, param('id').isMongoId(), validate, events.remove);

router.post(
  '/:id/rsvp',
  requireAuth,
  param('id').isMongoId(),
  body('guestsCount').optional().isInt({ min: 1, max: 20 }).withMessage('Guests must be between 1 and 20'),
  validate,
  rsvps.create
);

module.exports = router;
