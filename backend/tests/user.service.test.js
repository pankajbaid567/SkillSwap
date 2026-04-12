const defaultUserRepository = require('../repositories/user.repository');
// We need to instantiate or mock the class or just mock the repository 
const UserService = require('../services/user.service').constructor;
let userService;

jest.mock('../repositories/user.repository');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // In our codebase user.service.js exports a new instance with defaultUserRepository
    // So we can just pull it in directly but mock the underlying repo methods
    userService = require('../services/user.service'); 
    userService.userRepository = defaultUserRepository;
  });

  describe('updateProfile()', () => {
    it('should partially update the profile successfully', async () => {
      const mockUser = { id: 1, email: 'test@test.com' };
      defaultUserRepository.findWithSkillsAndAvailability.mockResolvedValue(mockUser);
      
      const payload = { displayName: 'New Name' };
      const updatedUser = { ...mockUser, profile: { displayName: 'New Name' } };
      defaultUserRepository.updateProfile.mockResolvedValue(updatedUser);

      const result = await userService.updateProfile(1, payload);

      expect(defaultUserRepository.updateProfile).toHaveBeenCalledWith(1, expect.objectContaining({
        displayName: 'New Name'
      }));
      expect(result).toEqual(updatedUser);
    });
  });

  describe('addSkill()', () => {
    it('should add skill successfully', async () => {
      const payload = { skillId: 'uuid', type: 'offer', proficiencyLevel: 'EXPERT' };
      const newSkill = { id: 1, userId: 1, ...payload };
      defaultUserRepository.createUserSkill.mockResolvedValue(newSkill);

      const result = await userService.addSkill(1, payload);

      expect(defaultUserRepository.createUserSkill).toHaveBeenCalledWith(expect.objectContaining({
        userId: 1,
        skillId: 'uuid',
        type: 'offer'
      }));
      expect(result).toEqual(newSkill);
    });

    it('should throw duplicate skill error (409) if Prisma throws P2002', async () => {
      const payload = { skillId: 'uuid', type: 'offer', proficiencyLevel: 'EXPERT' };
      
      const prismaError = new Error('Unique constraint failed');
      prismaError.code = 'P2002';
      defaultUserRepository.createUserSkill.mockRejectedValue(prismaError);

      await expect(userService.addSkill(1, payload))
        .rejects.toMatchObject({ statusCode: 409, message: 'Skill mapping already exists' });
    });
  });

  describe('addAvailabilitySlot()', () => {
    it('should add availability slot successfully', async () => {
      const payload = { 
        dayOfWeek: 1, 
        slotStart: '2025-01-01T10:00:00.000Z', 
        slotEnd: '2025-01-01T12:00:00.000Z' 
      };
      const expectedSlot = { id: 1, userId: 1, ...payload };
      defaultUserRepository.createAvailabilitySlot.mockResolvedValue(expectedSlot);

      const result = await userService.addAvailabilitySlot(1, payload);

      expect(defaultUserRepository.createAvailabilitySlot).toHaveBeenCalled();
      expect(result).toEqual(expectedSlot);
    });

    it('should throw overlapping slot / midnight error (400)', async () => {
      const payload = { 
        dayOfWeek: 1, 
        slotStart: '2025-01-01T15:00:00.000Z', 
        slotEnd: '2025-01-01T14:00:00.000Z' // End is before start
      };

      await expect(userService.addAvailabilitySlot(1, payload))
        .rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('searchUsers()', () => {
    it('should return paginated results properly', async () => {
      const mockResult = { users: [{ id: 1, passwordHash: 'hash' }, { id: 2, passwordHash: 'hash' }], total: 2 };
      defaultUserRepository.searchUsers.mockResolvedValue(mockResult);

      const result = await userService.searchUsers('dev', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).not.toHaveProperty('passwordHash');
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should handle empty results', async () => {
      const mockResult = { users: [], total: 0 };
      defaultUserRepository.searchUsers.mockResolvedValue(mockResult);

      const result = await userService.searchUsers('dev', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('removeSkill()', () => {
    it('should remove a skill successfully', async () => {
      defaultUserRepository.findUserSkillById.mockResolvedValue({ id: 1, userId: 1 });
      defaultUserRepository.deleteUserSkill.mockResolvedValue();

      await userService.removeSkill(1, 1);
      expect(defaultUserRepository.deleteUserSkill).toHaveBeenCalledWith(1);
    });

    it('should throw 403 if forbidden', async () => {
      defaultUserRepository.findUserSkillById.mockResolvedValue({ id: 1, userId: 2 });

      await expect(userService.removeSkill(1, 1))
        .rejects.toMatchObject({ statusCode: 403, message: 'Forbidden action' });
    });

    it('should throw 404 if not found', async () => {
      defaultUserRepository.findUserSkillById.mockResolvedValue(null);

      await expect(userService.removeSkill(1, 1))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('updateSkillLevel()', () => {
    it('should update skill level successfully', async () => {
      defaultUserRepository.findUserSkillById.mockResolvedValue({ id: 1, userId: 1 });
      defaultUserRepository.updateUserSkillLevel.mockResolvedValue({ id: 1, proficiencyLevel: 'EXPERT' });

      const result = await userService.updateSkillLevel(1, 1, 'EXPERT');
      expect(result.proficiencyLevel).toBe('EXPERT');
    });

    it('should throw 403 if forbidden', async () => {
      defaultUserRepository.findUserSkillById.mockResolvedValue({ id: 1, userId: 2 });

      await expect(userService.updateSkillLevel(1, 1, 'EXPERT'))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 404 if not found', async () => {
      defaultUserRepository.findUserSkillById.mockResolvedValue(null);

      await expect(userService.updateSkillLevel(1, 1, 'EXPERT'))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('removeAvailabilitySlot()', () => {
    it('should remove slot successfully', async () => {
      defaultUserRepository.findAvailabilitySlotById.mockResolvedValue({ id: 2, userId: 1 });
      defaultUserRepository.deleteAvailabilitySlot.mockResolvedValue();

      await userService.removeAvailabilitySlot(1, 2);
      expect(defaultUserRepository.deleteAvailabilitySlot).toHaveBeenCalledWith(2);
    });

    it('should throw 403 if forbidden', async () => {
      defaultUserRepository.findAvailabilitySlotById.mockResolvedValue({ id: 2, userId: 2 });

      await expect(userService.removeAvailabilitySlot(1, 2))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 404 if not found', async () => {
      defaultUserRepository.findAvailabilitySlotById.mockResolvedValue(null);

      await expect(userService.removeAvailabilitySlot(1, 2))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
