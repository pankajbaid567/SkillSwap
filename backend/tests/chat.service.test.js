const prisma = require('../config/db.config');
const messageRepository = require('../repositories/message.repository');
const chatService = require('../services/chat.service');

// Mock dependencies
jest.mock('../config/db.config', () => ({
  chat: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../repositories/message.repository', () => ({
  createMessage: jest.fn(),
  getMessagesByCursor: jest.fn(),
  markRead: jest.fn(),
  getUnreadCounts: jest.fn(),
}));

describe('ChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createChatForSwap', () => {
    it('returns existing chat', async () => {
      prisma.chat.findUnique.mockResolvedValueOnce({ id: 'c1' });
      const res = await chatService.createChatForSwap('s1');
      expect(res.id).toBe('c1');
    });

    it('creates new chat if none exists', async () => {
      prisma.chat.findUnique.mockResolvedValueOnce(null);
      prisma.chat.create.mockResolvedValueOnce({ id: 'c2' });
      const res = await chatService.createChatForSwap('s1');
      expect(res.id).toBe('c2');
      expect(prisma.chat.create).toHaveBeenCalledWith({ data: { swapId: 's1' } });
    });
  });

  describe('sendMessage', () => {
    it('sends message successfully with default msgType', async () => {
      prisma.chat.findUnique.mockResolvedValue({
        id: 'c1',
        isActive: true,
        swap: { initiatorId: 'u1', receiverId: 'u2' }
      });
      messageRepository.createMessage.mockResolvedValue({ id: 'm1' });

      const res = await chatService.sendMessage('c1', 'u1', { content: 'hello' });
      expect(res.id).toBe('m1');
      expect(messageRepository.createMessage).toHaveBeenCalledWith(expect.objectContaining({
        msgType: 'TEXT'
      }));
    });

    it('throws 404 if chat not found', async () => {
      prisma.chat.findUnique.mockResolvedValue(null);
      await expect(chatService.sendMessage('c1', 'u1', { content: 'hi' })).rejects.toThrow('Chat not found');
    });

    it('throws if chat is inactive', async () => {
      prisma.chat.findUnique.mockResolvedValue({ isActive: false });
      await expect(chatService.sendMessage('c1', 'u1', { content: 'hi' })).rejects.toThrow('Chat is inactive');
    });

    it('throws if user is not participant', async () => {
      prisma.chat.findUnique.mockResolvedValue({
        isActive: true,
        swap: { initiatorId: 'u1', receiverId: 'u2' }
      });
      await expect(chatService.sendMessage('c1', 'u3', { content: 'hi' })).rejects.toThrow('User is not a participant of this chat');
    });
  });

  describe('getMessages', () => {
    it('returns messages for participant', async () => {
      prisma.chat.findUnique.mockResolvedValue({
        swap: { initiatorId: 'u1', receiverId: 'u2' }
      });
      messageRepository.getMessagesByCursor.mockResolvedValue([{ id: 'm1' }]);

      const res = await chatService.getMessages('c1', 'u1', { limit: 10 });
      expect(res).toHaveLength(1);
    });

    it('throws if chat not found', async () => {
      prisma.chat.findUnique.mockResolvedValue(null);
      await expect(chatService.getMessages('c1', 'u1', {})).rejects.toThrow('Chat not found');
    });

    it('throws if user is not participant', async () => {
      prisma.chat.findUnique.mockResolvedValue({
        swap: { initiatorId: 'u1', receiverId: 'u2' }
      });
      await expect(chatService.getMessages('c1', 'u3', {})).rejects.toThrow('User is not a participant');
    });
  });

  describe('markMessagesRead', () => {
    it('returns count when participant', async () => {
      prisma.chat.findUnique.mockResolvedValue({
        swap: { initiatorId: 'u1', receiverId: 'u2' }
      });
      messageRepository.markRead.mockResolvedValue(5);
      const res = await chatService.markMessagesRead('c1', 'u1');
      expect(res).toBe(5);
    });

    it('returns 0 if chat not found', async () => {
      prisma.chat.findUnique.mockResolvedValue(null);
      const res = await chatService.markMessagesRead('c1', 'u1');
      expect(res).toBe(0);
    });

    it('returns 0 if not participant', async () => {
      prisma.chat.findUnique.mockResolvedValue({
        swap: { initiatorId: 'u1', receiverId: 'u2' }
      });
      const res = await chatService.markMessagesRead('c1', 'u3');
      expect(res).toBe(0);
    });
  });

  describe('getUnreadCount', () => {
    it('calls repository', async () => {
      messageRepository.getUnreadCounts.mockResolvedValue(10);
      const res = await chatService.getUnreadCount('u1');
      expect(res).toBe(10);
      expect(messageRepository.getUnreadCounts).toHaveBeenCalledWith('u1');
    });
  });

  describe('archiveChat', () => {
    it('sets isActive to false', async () => {
      prisma.chat.update.mockResolvedValue({ id: 'c1', isActive: false });
      const res = await chatService.archiveChat('c1');
      expect(res.isActive).toBe(false);
      expect(prisma.chat.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { isActive: false }
      });
    });
  });
});
