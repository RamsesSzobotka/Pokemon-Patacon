import { createApp } from '@tanstack/react-start';
import { createRouter as createRouterRaw } from '@tanstack/react-router';
import { Route as rootRoute } from './src/routes/__root';
import { route as indexRoute } from './src/routes/index';
import { route as roomRoute } from './src/routes/room.$code';
import { route as draftRoute } from './src/routes/draft.$code';
import { route as battleRoute } from './src/routes/battle.$code';

const router = createRouterRaw({
  routeTree: rootRoute.addChildren([
    indexRoute,
    roomRoute,
    draftRoute,
    battleRoute,
  ]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export const App = createApp(router);