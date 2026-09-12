const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const users = require('../controllers/userController');

const router = express.Router();

router.get('/reports', requireAuth, requireAdmin, users.reports);

module.exports = router;
