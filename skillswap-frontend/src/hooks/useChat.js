import { useQuery } from '@tanstack/react-query';
import { chatAPI } from '../services/api.service';

export const useChat = (swapId) => {
  const messagesQuery = useQuery({
    queryKey: ['chat-messages', swapId],
    queryFn: () => chatAPI.getMessages(swapId),
    enabled: Boolean(swapId),
    staleTime: 10_000,
  });

  const unreadCountQuery = useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: () => chatAPI.getUnreadCount(),
    staleTime: 10_000,
  });

  return {
    messages: messagesQuery.data || [],
    unreadCount: unreadCountQuery.data?.count || 0,
    isLoading: messagesQuery.isLoading || unreadCountQuery.isLoading,
    error: messagesQuery.error || unreadCountQuery.error,
    refetchMessages: messagesQuery.refetch,
    refetchUnreadCount: unreadCountQuery.refetch,
  };
};
