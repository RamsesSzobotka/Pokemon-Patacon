import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/')({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate({ to: '/splash', replace: true });
  }, [navigate]);
  
  return null;
}