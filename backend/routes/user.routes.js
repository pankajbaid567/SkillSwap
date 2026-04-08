const { Router } = require('express');
const { z } = require('zod');
const userController = require('../controllers/user.controller');
const { validateBody } = require('../middlewares/validate.middleware');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

const router = Router();

// Apply auth middleware uniformly as requested
router.use(verifyAccessToken);

/**
 * @typedef {Object} UpdateProfileDto
 * @property {string} [displayName]
 * @property {string} [bio]
 * @property {string} [avatarUrl]
 * @property {string} [location]
 * @property {string} [timezone]
 */
const updateProfileSchema = z.object({
  displayName: z.string().optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  location: z.string().optional(),
  timezone: z.string().optional()
});

/**
 * @typedef {Object} AddSkillDto
 * @property {string} skillId
 * @property {'offer'|'want'} type
 * @property {'BEGINNER'|'INTERMEDIATE'|'ADVANCED'|'EXPERT'} proficiencyLevel
 * @property {string} [description]
 */
const addSkillSchema = z.object({
  skillId: z.string().uuid(),
  type: z.enum(['offer', 'want']),
  proficiencyLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  description: z.string().optional()
});

/**
 * @typedef {Object} UpdateSkillLevelDto
 * @property {'BEGINNER'|'INTERMEDIATE'|'ADVANCED'|'EXPERT'} proficiencyLevel
 */
const updateSkillLevelSchema = z.object({
  proficiencyLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'])
});

/**
 * @typedef {Object} AddAvailabilitySlotDto
 * @property {number} dayOfWeek - 0 to 6
 * @property {string} slotStart - DateTime ISO string targeting Time
 * @property {string} slotEnd - DateTime ISO string targeting Time
 * @property {boolean} [isRecurring]
 */
const addAvailabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  slotStart: z.string().datetime(), // Mapping to prisma UTC datetime
  slotEnd: z.string().datetime(), // Mapping to prisma UTC datetime
  isRecurring: z.boolean().default(false)
});

/**
 * @typedef {Object} UpdateNotificationPreferencesDto
 * @property {boolean} [notifyEmail]
 * @property {boolean} [notifyPush]
 * @property {boolean} [notifyInApp]
 */
const updateNotificationPreferencesSchema = z.object({
  notifyEmail: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
});

// Search Route (Has to be mapped before /:id)
router.get('/search', userController.searchUsers);

// Profile Routes
router.get('/me', userController.getOwnProfile);
router.put('/me', validateBody(updateProfileSchema), userController.updateProfile);
router.put(
  '/me/notification-preferences',
  validateBody(updateNotificationPreferencesSchema),
  userController.updateNotificationPreferences
);

// Skills Routes
router.post('/me/skills', validateBody(addSkillSchema), userController.addSkill);
router.put('/me/skills/:id', validateBody(updateSkillLevelSchema), userController.updateSkillLevel);
router.delete('/me/skills/:id', userController.removeSkill);

// Availability Routes
router.post('/me/availability', validateBody(addAvailabilitySlotSchema), userController.addAvailabilitySlot);
router.delete('/me/availability/:id', userController.removeAvailabilitySlot);

// Public Profile Route (Dynamic ID last)
router.get('/:id', userController.getPublicProfile);

module.exports = router;
