const { SafeCircle, CircleMember } = require('../models/SafeCircle');
const User = require('../models/User');
const { asyncHandler } = require('../middlewares/errorMiddleware');

/**
 * Generate a unique 6-character group code
 * @returns {Promise<string>} - Unique group code
 */
const generateGroupCode = async () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluded confusing characters like 0/O, 1/I
  const codeLength = 6;
  
  // Try up to 10 times to generate a unique code
  for (let i = 0; i < 10; i++) {
    let codeBuilder = "";
    for (let j = 0; j < codeLength; j++) {
      codeBuilder += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if code already exists
    const existingGroup = await SafeCircle.findOne({ groupCode: codeBuilder });
    if (!existingGroup) {
      return codeBuilder;
    }
  }
  
  // If we couldn't generate a unique code, use a timestamp approach
  return `SR${Date.now().toString().substring(7)}`;
};

/**
 * @desc    Create a new Safe Circle
 * @route   POST /api/groups/create
 * @access  Private
 */
const createGroup = asyncHandler(async (req, res) => {
  const { name, creatorId, description } = req.body;
  
  // Check if user exists
  const user = await User.findOne({ id: creatorId });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  // Generate a unique group code
  const groupCode = await generateGroupCode();
  
  // Create the safe circle
  const circle = await SafeCircle.create({
    groupCode,
    name,
    creatorId,
    description: description || '',
    createdAt: Date.now()
  });
  
  if (!circle) {
    res.status(400);
    throw new Error('Invalid group data');
  }
  
  // Add creator as a member
  const member = await CircleMember.create({
    groupCode,
    userId: creatorId,
    joinedAt: Date.now()
  });
  
  // Update user's group code
  user.groupCode = groupCode;
  await user.save();
  
  res.status(201).json({
    groupCode: circle.groupCode,
    name: circle.name,
    description: circle.description,
    memberCount: 1,
    message: 'Safe Circle created successfully'
  });
});

/**
 * @desc    Join an existing Safe Circle
 * @route   POST /api/groups/join
 * @access  Private
 */
const joinGroup = asyncHandler(async (req, res) => {
  const { groupCode, userId } = req.body;
  
  // Check if user exists
  const user = await User.findOne({ id: userId });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  // Check if group exists
  const circle = await SafeCircle.findOne({ groupCode });
  if (!circle) {
    res.status(404);
    throw new Error('Safe Circle not found');
  }
  
  // Check if user is already in the group
  const existingMembership = await CircleMember.findOne({ groupCode, userId });
  if (existingMembership) {
    res.status(400);
    throw new Error('User is already a member of this Safe Circle');
  }
  
  // Add user to the group
  const member = await CircleMember.create({
    groupCode,
    userId,
    joinedAt: Date.now()
  });
  
  // Update user's group code
  user.groupCode = groupCode;
  await user.save();
  
  // Get updated member count
  const memberCount = await CircleMember.countDocuments({ groupCode });
  
  res.status(200).json({
    groupCode: circle.groupCode,
    name: circle.name,
    memberCount,
    message: 'Successfully joined Safe Circle'
  });
});

/**
 * @desc    Leave a Safe Circle
 * @route   POST /api/groups/leave
 * @access  Private
 */
const leaveGroup = asyncHandler(async (req, res) => {
  const { groupCode, userId } = req.body;
  
  // Check if user exists
  const user = await User.findOne({ id: userId });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  // Check if group exists
  const circle = await SafeCircle.findOne({ groupCode });
  if (!circle) {
    res.status(404);
    throw new Error('Safe Circle not found');
  }
  
  // Check if user is in the group
  const membership = await CircleMember.findOne({ groupCode, userId });
  if (!membership) {
    res.status(400);
    throw new Error('User is not a member of this Safe Circle');
  }
  
  // Remove user from the group
  await CircleMember.findOneAndDelete({ groupCode, userId });
  
  // Clear user's group code
  user.groupCode = null;
  await user.save();
  
  // Check if creator is leaving and there are other members
  if (userId === circle.creatorId) {
    const remainingMembers = await CircleMember.find({ groupCode });
    
    if (remainingMembers.length > 0) {
      // Assign a new creator (first remaining member)
      circle.creatorId = remainingMembers[0].userId;
      await circle.save();
    } else {
      // No more members, delete the circle
      await SafeCircle.findOneAndDelete({ groupCode });
    }
  }
  
  res.status(200).json({
    message: 'Successfully left Safe Circle'
  });
});

/**
 * @desc    Get all members of a Safe Circle
 * @route   GET /api/groups/:groupCode/members
 * @access  Private
 */
const getGroupMembers = asyncHandler(async (req, res) => {
  const { groupCode } = req.params;
  
  // Check if group exists
  const circle = await SafeCircle.findOne({ groupCode });
  if (!circle) {
    res.status(404);
    throw new Error('Safe Circle not found');
  }
  
  // Get members
  const memberDocs = await CircleMember.find({ groupCode });
  
  // Get user details for each member
  const memberPromises = memberDocs.map(async (member) => {
    const user = await User.findOne({ id: member.userId });
    if (user) {
      return {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        joinedAt: member.joinedAt,
        isCreator: user.id === circle.creatorId
      };
    }
    return null;
  });
  
  const members = (await Promise.all(memberPromises)).filter(Boolean);
  
  res.status(200).json(members);
});

/**
 * @desc    Get Safe Circle details
 * @route   GET /api/groups/:groupCode
 * @access  Private
 */
const getGroupDetails = asyncHandler(async (req, res) => {
  const { groupCode } = req.params;
  
  // Check if group exists
  const circle = await SafeCircle.findOne({ groupCode });
  if (!circle) {
    res.status(404);
    throw new Error('Safe Circle not found');
  }
  
  // Get member count
  const memberCount = await CircleMember.countDocuments({ groupCode });
  
  // Get creator details
  const creator = await User.findOne({ id: circle.creatorId });
  
  res.status(200).json({
    groupCode: circle.groupCode,
    name: circle.name,
    description: circle.description || '',
    creatorName: creator ? creator.name : 'Unknown',
    memberCount,
    createdAt: circle.createdAt
  });
});

module.exports = {
  createGroup,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  getGroupDetails
}; 