/*
  LIMITS CONFIGURATION
  ROLE: Central place for all application limits.
*/
const LIMITS = {
  // 15 minutes per day (in seconds)
  DAILY_TIME_BUDGET_SECONDS: 30 * 60, 
  
  // Max duration for a single session (safety cap)
  MAX_SESSION_DURATION_SECONDS: 30 * 60 
};

module.exports = LIMITS;