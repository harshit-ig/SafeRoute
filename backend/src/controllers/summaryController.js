const summaryService = require('../services/summaryService');
const { asyncHandler } = require('../middlewares/errorMiddleware');

/**
 * @desc    Generate daily summaries for all users
 * @route   POST /api/alerts/summaries/generate
 * @access  Private/Admin
 */
const generateDailySummaries = asyncHandler(async (req, res) => {
  // Check if the request is from a scheduled job (has a valid token or API key)
  // This should have proper authentication in production
  
  const result = await summaryService.generateAllDailySummaries();
  
  if (result.success) {
    res.status(200).json({
      success: true,
      message: `Generated summaries for ${result.totalUsers} users`,
      results: result.results
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Failed to generate summaries',
      error: result.error
    });
  }
});

/**
 * @desc    Generate daily summary for a specific user
 * @route   POST /api/alerts/summaries/user/:userId
 * @access  Private
 */
const generateUserSummary = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  const result = await summaryService.generateAndSendDailySummary(userId);
  
  if (result.success) {
    res.status(200).json({
      success: true,
      message: 'Summary generated and sent successfully',
      summary: result.summary,
      results: result.results
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Failed to generate summary',
      error: result.error
    });
  }
});

module.exports = {
  generateDailySummaries,
  generateUserSummary
}; 