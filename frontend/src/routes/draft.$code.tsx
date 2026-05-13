import { DraftSelector } from '../components/DraftSelector';
import { createFileRoute } from '@tanstack/react-router';

export const route = createFileRoute('/draft/$code')({
  component: Draft,
});

function Draft() {
  return <DraftSelector />;
}