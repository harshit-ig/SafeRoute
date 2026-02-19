const express = require('express');
const {
  createGroup,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  getGroupDetails
} = require('../controllers/groupController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// All group routes should be protected
router.use(protect);

// POST /api/groups/create
router.post('/create', createGroup);

// POST /api/groups/join
router.post('/join', joinGroup);

// POST /api/groups/leave
router.post('/leave', leaveGroup);

// GET /api/groups/:groupCode/members
router.get('/:groupCode/members', getGroupMembers);

// GET /api/groups/:groupCode
router.get('/:groupCode', getGroupDetails);

module.exports = router; 