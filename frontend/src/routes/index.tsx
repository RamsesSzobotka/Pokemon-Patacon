import { MainMenu } from '../components/MainMenu';
import { createFileRoute } from '@tanstack/react-router';

export const route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return <MainMenu />;
}