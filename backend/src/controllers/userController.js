const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { asyncHandler } = require('../middlewares/errorMiddleware');

/**
 * Generate JWT Token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

/**
 * @description Register a new user
 * @route POST /api/users/register
 * @access Public
 */
const registerUser = async (req, res) => {
  try {
    const { id, name, phone, email, password } = req.body;

    // Validate required fields
    if (!id || !name || !phone || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this phone number' });
    }

    // Create user (password will be hashed by the model's pre-save middleware)
    const user = await User.create({
      id,
      name,
      phone,
      email,
      password
    });

    if (user) {
      // Generate token
      const token = generateToken(user._id);
      
      res.status(201).json({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        groupCode: user.groupCode,
        token
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @description Authenticate a user
 * @route POST /api/users/login
 * @access Public
 */
const loginUser = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Check for user by phone number
    const user = await User.findOne({ phone });

    // Check if user exists and password matches
    if (user && (await bcrypt.compare(password, user.password))) {
      // Generate token
      const token = generateToken(user._id);
      
      res.status(200).json({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        groupCode: user.groupCode,
        token
      });
    } else {
      // Return 401 Unauthorized for invalid credentials
      // Don't throw an error, just return the response directly
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @description Get current user
 * @route GET /api/users/me
 * @access Private
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    
    res.status(200).json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      groupCode: user.groupCode
    });
  } catch (error) {
    console.error('Get current user error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @description Get user by ID
 * @route GET /api/users/:userId
 * @access Private
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.userId });
    
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    
    res.status(200).json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      groupCode: user.groupCode
    });
  } catch (error) {
    console.error('Get user by ID error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @description Update user
 * @route PUT /api/users/:userId
 * @access Private
 */
const updateUser = async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.userId });
    
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    
    // Check user has permission to update this profile
    if (user._id.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized to update this user');
    }
    
    // Update fields
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    
    const updatedUser = await user.save();
    
    res.status(200).json({
      id: updatedUser.id,
      name: updatedUser.name,
      phone: updatedUser.phone,
      email: updatedUser.email,
      groupCode: updatedUser.groupCode
    });
  } catch (error) {
    console.error('Update user error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @description Update user group
 * @route PUT /api/users/:userId/group
 * @access Private
 */
const updateUserGroup = async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.userId });
    
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    
    // Check user has permission to update this profile
    if (user._id.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized to update this user');
    }
    
    // Update group code
    user.groupCode = req.body.groupCode;
    
    const updatedUser = await user.save();
    
    res.status(200).json({
      id: updatedUser.id,
      name: updatedUser.name,
      phone: updatedUser.phone,
      email: updatedUser.email,
      groupCode: updatedUser.groupCode
    });
  } catch (error) {
    console.error('Update user group error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @description Update user profile photo
 * @route PUT /api/users/:userId/photo
 * @access Private
 */
const updateProfilePhoto = async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.userId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check user has permission to update this profile
    if (user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this user' });
    }
    
    // Update profile photo (Base64 string)
    if (req.body.profilePhoto) {
      // Convert Base64 string to Buffer for MongoDB storage
      const base64Data = req.body.profilePhoto.split(';base64,').pop();
      user.profilePhoto = Buffer.from(base64Data, 'base64');
    }
    
    const updatedUser = await user.save();
    
    res.status(200).json({
      id: updatedUser.id,
      name: updatedUser.name,
      phone: updatedUser.phone,
      email: updatedUser.email,
      groupCode: updatedUser.groupCode,
      hasProfilePhoto: !!updatedUser.profilePhoto
    });
  } catch (error) {
    console.error('Update profile photo error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @description Get user profile photo
 * @route GET /api/users/:userId/photo
 * @access Private
 */
const getProfilePhoto = async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.userId });
    
    if (!user || !user.profilePhoto) {
      return res.status(404).json({ message: 'Profile photo not found' });
    }
    
    // Convert Buffer to Base64 string
    const base64Photo = user.profilePhoto.toString('base64');
    
    res.status(200).json({
      profilePhoto: `data:image/jpeg;base64,${base64Photo}`
    });
  } catch (error) {
    console.error('Get profile photo error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  getUserById,
  updateUser,
  updateUserGroup,
  updateProfilePhoto,
  getProfilePhoto
}; 