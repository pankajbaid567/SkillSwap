const authService = require('../services/auth.service');
const userRepository = require('../repositories/user.repository');
const { hashString, compareHash } = require('../utils/hash.util');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwt.util');

// Mock dependencies
jest.mock('../repositories/user.repository');
jest.mock('../utils/hash.util');
jest.mock('../utils/jwt.util');
jest.mock('../factories/user.factory', () => ({
  createRegularUser: jest.fn().mockImplementation((dto, hash) => ({ ...dto, passwordHash: hash }))
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register()', () => {
    it('should register a new user successfully (happy path)', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      hashString.mockResolvedValue('hashedPass');
      
      const mockUser = { id: 1, email: 'test@test.com', passwordHash: 'hashedPass' };
      userRepository.createUserWithProfile.mockResolvedValue(mockUser);
      
      generateAccessToken.mockReturnValue('access_token_mock');
      generateRefreshToken.mockReturnValue('refresh_token_mock');
      userRepository.saveRefreshToken.mockResolvedValue();

      const result = await authService.register({ email: 'test@test.com', password: 'password123' });

      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@test.com');
      expect(hashString).toHaveBeenCalledWith('password123');
      expect(userRepository.createUserWithProfile).toHaveBeenCalled();
      expect(result.accessToken).toBe('access_token_mock');
      expect(result.refreshToken).toBe('refresh_token_mock');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw duplicate email error (409)', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 1, email: 'test@test.com' });

      await expect(authService.register({ email: 'test@test.com', password: 'password123' }))
        .rejects.toMatchObject({ statusCode: 409, errorCode: 'DUPLICATE_EMAIL' });
    });
  });

  describe('login()', () => {
    it('should login valid credentials successfully', async () => {
      const mockUser = { id: 1, email: 'test@test.com', passwordHash: 'hashedPass' };
      userRepository.findByEmail.mockResolvedValue(mockUser);
      compareHash.mockResolvedValue(true);
      
      generateAccessToken.mockReturnValue('access_token_mock');
      generateRefreshToken.mockReturnValue('refresh_token_mock');
      userRepository.saveRefreshToken.mockResolvedValue();

      const result = await authService.login({ email: 'test@test.com', password: 'password123' });

      expect(compareHash).toHaveBeenCalledWith('password123', 'hashedPass');
      expect(result.accessToken).toBe('access_token_mock');
      expect(result.refreshToken).toBe('refresh_token_mock');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw 403/401 for wrong password', async () => {
      const mockUser = { id: 1, email: 'test@test.com', passwordHash: 'hashedPass' };
      userRepository.findByEmail.mockResolvedValue(mockUser);
      compareHash.mockResolvedValue(false);

      await expect(authService.login({ email: 'test@test.com', password: 'wrongpass' }))
        .rejects.toMatchObject({ statusCode: 401, errorCode: 'INVALID_CREDENTIALS' });
    });

    it('should throw 404/401 for user not found', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login({ email: 'notfound@test.com', password: 'password123' }))
        .rejects.toMatchObject({ statusCode: 401, errorCode: 'INVALID_CREDENTIALS' });
    });
  });

  describe('refreshToken()', () => {
    it('should refresh token successfully for valid token', async () => {
      const dbRecord = { userId: 1, isRevoked: false, expiresAt: new Date(Date.now() + 10000) };
      userRepository.findRefreshToken.mockResolvedValue(dbRecord);
      verifyToken.mockReturnValue({ id: 1, email: 'test@test.com' });
      generateAccessToken.mockReturnValue('new_access_token');

      const result = await authService.refreshToken('valid_refresh_token');

      expect(verifyToken).toHaveBeenCalledWith('valid_refresh_token', true);
      expect(result.accessToken).toBe('new_access_token');
    });

    it('should throw 401 for expired token in DB record', async () => {
      const dbRecord = { userId: 1, isRevoked: false, expiresAt: new Date(Date.now() - 10000) };
      userRepository.findRefreshToken.mockResolvedValue(dbRecord);

      await expect(authService.refreshToken('expired_refresh_token'))
        .rejects.toMatchObject({ statusCode: 401 });
    });

    it('should throw 401 for revoked token', async () => {
      const dbRecord = { userId: 1, isRevoked: true, expiresAt: new Date(Date.now() + 10000) };
      userRepository.findRefreshToken.mockResolvedValue(dbRecord);

      await expect(authService.refreshToken('revoked_refresh_token'))
        .rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('logout()', () => {
    it('should accurately revoke tokens in DB', async () => {
      userRepository.revokeRefreshToken.mockResolvedValue();

      await authService.logout(1);

      expect(userRepository.revokeRefreshToken).toHaveBeenCalledWith(1);
    });
  });
});
