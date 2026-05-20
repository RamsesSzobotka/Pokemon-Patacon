import { createFileRoute, useNavigate } from '@tanstack/react-router';
import './../styles/Splash.css';

export const Route = createFileRoute('/splash')({
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();

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

        <button
          className="splash-start-btn"
          onClick={() => navigate({ to: '/menu' })}
        >
          COMENZAR
        </button>
      </div>

      <div className="splash-bottom-actions">
        <button className="splash-icon-btn" onClick={() => {}}>
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          <span>CUENTA</span>
        </button>

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