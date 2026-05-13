import { createRootRoute } from '@tanstack/react-router';
import { MainMenu } from '../components/MainMenu';

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  return (
    <div className="app-container">
      <MainMenu />
    </div>
  );
}