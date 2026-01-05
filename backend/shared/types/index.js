// Shared types and interfaces for ChitChat microservices

/**
 * User entity
 * @typedef {Object} User
 * @property {string} id - UUID
 * @property {string} email
 * @property {string} avatarName
 * @property {string} tempPassword
 * @property {boolean} emailVerified
 * @property {boolean} isActive
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {Date} lastLogin
 */

/**
 * Session entity
 * @typedef {Object} Session
 * @property {string} id - UUID
 * @property {string} userId
 * @property {string} sessionToken
 * @property {Object} deviceInfo
 * @property {string} ipAddress
 * @property {string} userAgent
 * @property {Date} expiresAt
 * @property {Date} createdAt
 * @property {Date} lastActivity
 */

/**
 * User Profile entity
 * @typedef {Object} UserProfile
 * @property {string} id - UUID
 * @property {string} userId
 * @property {string} displayName
 * @property {string} bio
 * @property {string} avatarUrl
 * @property {string} status
 * @property {Date} lastSeen
 * @property {Object} preferences
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/**
 * OTP Verification entity
 * @typedef {Object} OTPVerification
 * @property {string} id - UUID
 * @property {string} email
 * @property {string} otpCode
 * @property {string} avatarName
 * @property {string} tempPassword
 * @property {string} purpose
 * @property {Date} expiresAt
 * @property {boolean} used
 * @property {Date} usedAt
 * @property {Date} createdAt
 */

/**
 * Conversation entity
 * @typedef {Object} Conversation
 * @property {string} id - UUID
 * @property {string} conversationId
 * @property {string} title
 * @property {string} description
 * @property {string} createdBy
 * @property {number} participantCount
 * @property {Date} lastMessageAt
 * @property {boolean} isActive
 * @property {Object} metadata
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/**
 * API Response format
 * @typedef {Object} APIResponse
 * @property {boolean} success
 * @property {Object|string} data
 * @property {string} [error]
 * @property {number} [statusCode]
 * @property {Object} [metadata]
 */

/**
 * Service Result wrapper
 * @typedef {Object} ServiceResult
 * @property {boolean} success
 * @property {*} data
 * @property {Error} error
 * @property {string} message
 */

/**
 * Cache entry
 * @typedef {Object} CacheEntry
 * @property {*} data
 * @property {Date} expiresAt
 * @property {number} accessCount
 * @property {Date} lastAccessed
 */

module.exports = {};
