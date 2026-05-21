import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuth, useUser, UserButton } from '@clerk/clerk-react';
import { useAuthSession } from '../hooks/useAuthSession';
import { AuthModal } from '../components/AuthModal';
import './../styles/Splash.css';

export const Route = createFileRoute('/splash')({
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated, isSyncing, playerName } = useAuthSession();

  return (
    <div className="splash-container">
      <div className="splash-background">
        <img
          src="../../public/assets/background/back2.gif"
          alt="Background"
          className="background-image"
        />
      </div>

      <div className="splash-content">
        <div className="splash-logo">
          <img
            src="/assets/Title.png"
            alt="Pokémon Patacon"
            className="splash-logo-img"
            onError={(e) => {
              const elem = e.target as HTMLImageElement;
              elem.style.display = 'none';
            }}
          />
        </div>
        <h1 className="splash-subtitle">PATACON</h1>

        {isAuthenticated && !isSyncing && playerName && (
          <p className="splash-welcome">Bienvenido, {playerName}</p>
        )}

        <button
          className="splash-start-btn"
          onClick={() => navigate({ to: '/menu' })}
          disabled={isSyncing}
        >
          {isSyncing ? 'SINCRONIZANDO...' : 'COMENZAR'}
        </button>
      </div>

      <div className="splash-bottom-actions">
        {isSignedIn ? (
          <div className="splash-user-section">
            <UserButton afterSignOutUrl="/splash" />
            <span className="splash-user-name">
              {user?.firstName || 'Cuenta'}
            </span>
          </div>
        ) : (
          <button className="splash-icon-btn" onClick={() => setShowAuthModal(true)}>
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <span>CUENTA</span>
          </button>
        )}

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />

        <button className="splash-icon-btn" onClick={() => navigate({ to: '/pokedex' })}>
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span>POKÉDEX</span>
        </button>
      </div>

      <div className="splash-version">v2.0 • RUBY STYLE</div>
    </div>
  );
}
