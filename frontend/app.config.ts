import { createRouter as createRouterRaw } from '@tanstack/react-router';
import { Route as rootRoute } from './src/routes/__root';

const router = createRouterRaw({
  routeTree: rootRoute,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export { router };