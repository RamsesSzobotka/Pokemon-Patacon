import { createRootRoute, Outlet } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAuthSession } from '../hooks/useAuthSession';
import ClickSound from '../components/ClickSound';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const queryClient = React.useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            retry: 1,
          },
        },
      }),
    []
  );

  const { isSyncing } = useAuthSession();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <ClickSound />
    </QueryClientProvider>
  );
}