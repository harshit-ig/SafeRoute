const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to protect routes by verifying JWT token
 */
const protect = async (req, res, next) => {
  let token;
  
  try {
    // Check if token exists in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from the token but exclude password
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }
      
      next();
    } else {
      res.status(401);
      throw new Error('Not authorized, no token');
    }
  } catch (error) {
    console.error('Auth error:', error.message);
    res.status(401);
    
    if (error.name === 'JsonWebTokenError') {
      return res.json({ message: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.json({ message: 'Token expired' });
    } else {
      return res.json({ message: error.message || 'Not authorized' });
    }
  }
};


module.exports = { protect }; 