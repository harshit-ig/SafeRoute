const express = require('express');
const {
  registerUser,
  loginUser,
  getUserById,
  updateUser,
  updateUserGroup,
  getCurrentUser,
  updateProfilePhoto,
  getProfilePhoto
} = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// Public routes
// POST /api/users/register
router.post('/register', registerUser);

// POST /api/users/login
router.post('/login', loginUser);

// Protected routes
// GET /api/users/me - Get current user profile
router.get('/me', protect, getCurrentUser);

// GET /api/users/:userId
router.get('/:userId', protect, getUserById);

// PUT /api/users/:userId
router.put('/:userId', protect, updateUser);

// PUT /api/users/:userId/group
router.put('/:userId/group', protect, updateUserGroup);

// PUT /api/users/:userId/photo - Update profile photo
router.put('/:userId/photo', protect, updateProfilePhoto);

// GET /api/users/:userId/photo - Get profile photo
router.get('/:userId/photo', protect, getProfilePhoto);

module.exports = router; 