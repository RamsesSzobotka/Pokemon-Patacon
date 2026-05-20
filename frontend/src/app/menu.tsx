import { createFileRoute } from '@tanstack/react-router';
import MainMenu from '../components/MainMenu';

export const Route = createFileRoute('/menu')({
  component: Menu,
});

function Menu() {
  return <MainMenu />;
}