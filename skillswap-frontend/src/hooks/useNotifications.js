import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifAPI } from '../services/api.service';

export const useNotifications = (params = {}) => {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notifAPI.getNotifications(params),
    staleTime: 15_000,
  });

  const unreadCountQuery = useQuery({
    queryKey: ['notification-unread-count'],
    queryFn: () => notifAPI.getUnreadCount(),
    staleTime: 10_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId) => notifAPI.markRead(notificationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notification-unread-count'] }),
      ]);
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notifAPI.markAllRead(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notification-unread-count'] }),
      ]);
    },
  });

  return {
    notifications: notificationsQuery.data?.notifications || notificationsQuery.data || [],
    pagination: notificationsQuery.data?.pagination || null,
    unreadCount: unreadCountQuery.data?.count || 0,
    isLoading: notificationsQuery.isLoading || unreadCountQuery.isLoading,
    error: notificationsQuery.error || unreadCountQuery.error,
    refetchNotifications: notificationsQuery.refetch,
    refetchUnreadCount: unreadCountQuery.refetch,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
  };
};
