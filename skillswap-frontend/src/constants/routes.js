export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  matches: '/matches',
  swapDetail: (swapId = ':swapId') => `/swaps/${swapId}`,
  profile: '/profile',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
};
