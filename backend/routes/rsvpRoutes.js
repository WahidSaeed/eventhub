const express = require('express');
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/authMiddleware');
const rsvps = require('../controllers/rsvpController');

const router = express.Router();

router.delete('/:id', requireAuth, param('id').isMongoId(), validate, rsvps.cancel);

module.exports = router;
