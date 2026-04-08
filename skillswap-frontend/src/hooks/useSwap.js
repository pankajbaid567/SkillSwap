import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { swapAPI } from '../services/api.service';

export const useSwap = (swapId, params = {}) => {
  const queryClient = useQueryClient();

  const swapQuery = useQuery({
    queryKey: ['swap', swapId],
    queryFn: () => swapAPI.getSwapById(swapId),
    enabled: Boolean(swapId),
  });

  const swapsQuery = useQuery({
    queryKey: ['swaps', params],
    queryFn: () => swapAPI.getSwaps(params),
    staleTime: 30_000,
  });

  const activeSwapsQuery = useQuery({
    queryKey: ['active-swaps'],
    queryFn: () => swapAPI.getActiveSwaps(),
    staleTime: 30_000,
  });

  const createSwapMutation = useMutation({
    mutationFn: (payload) => swapAPI.createSwap(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swaps'] }),
        queryClient.invalidateQueries({ queryKey: ['active-swaps'] }),
      ]);
    },
  });

  const acceptSwapMutation = useMutation({
    mutationFn: (id) => swapAPI.acceptSwap(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swaps'] }),
        queryClient.invalidateQueries({ queryKey: ['swap', swapId] }),
        queryClient.invalidateQueries({ queryKey: ['active-swaps'] }),
      ]);
    },
  });

  const cancelSwapMutation = useMutation({
    mutationFn: ({ id, reason }) => swapAPI.cancelSwap(id, { reason }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swaps'] }),
        queryClient.invalidateQueries({ queryKey: ['swap', swapId] }),
        queryClient.invalidateQueries({ queryKey: ['active-swaps'] }),
      ]);
    },
  });

  const completeSwapMutation = useMutation({
    mutationFn: (id) => swapAPI.confirmComplete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['swap', swapId] }),
  });

  const scheduleSessionMutation = useMutation({
    mutationFn: ({ id, payload }) => swapAPI.scheduleSession(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['swap', swapId] }),
  });

  return {
    swap: swapQuery.data || null,
    swaps: swapsQuery.data?.swaps || swapsQuery.data || [],
    activeSwaps: activeSwapsQuery.data?.swaps || activeSwapsQuery.data || [],
    isLoading: swapQuery.isLoading || swapsQuery.isLoading || activeSwapsQuery.isLoading,
    error: swapQuery.error || swapsQuery.error || activeSwapsQuery.error,
    refetchSwap: swapQuery.refetch,
    refetchSwaps: swapsQuery.refetch,
    refetchActiveSwaps: activeSwapsQuery.refetch,
    createSwap: createSwapMutation.mutateAsync,
    acceptSwap: acceptSwapMutation.mutateAsync,
    cancelSwap: cancelSwapMutation.mutateAsync,
    confirmComplete: completeSwapMutation.mutateAsync,
    scheduleSession: scheduleSessionMutation.mutateAsync,
  };
};
