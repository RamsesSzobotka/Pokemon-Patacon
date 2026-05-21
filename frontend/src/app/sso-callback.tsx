import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/sso-callback')({
  component: SSOCallback,
});

function SSOCallback() {
  return (
    <div className="sso-callback-container">
      <AuthenticateWithRedirectCallback redirectUrl="/splash" />
    </div>
  );
}
