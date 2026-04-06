const prisma = require('../config/db.config');

/**
 * Encapsulates database queries for the User model.
 * Adheres to SRP by handling only DB operations.
 */
class UserRepository {
  async createUserWithProfile(createInput) {
    return await prisma.user.create({
      data: createInput,
      include: {
        profile: true
      }
    });
  }

  async findByEmail(email) {
    return await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true
      }
    });
  }

  async findById(id) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true
      }
    });
  }

  async updatePassword(id, passwordHash) {
    return await prisma.user.update({
      where: { id },
      data: { passwordHash }
    });
  }

  /**
   * Upsert a refresh token, revoking the old one if it exists
   */
  async saveRefreshToken(userId, token, expiresAt) {
    return await prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt
      }
    });
  }

  async findRefreshToken(token) {
    return await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true }
    });
  }

  async revokeRefreshToken(userId) {
    return await prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false
      },
      data: {
        isRevoked: true
      }
    });
  }
}

module.exports = new UserRepository();
