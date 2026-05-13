import { useState } from 'react';
import './MainMenu.css';
import MenuPrincipal from './screens/MenuPrincipal';
import CreateRoom from './screens/CreateRoom';
import JoinRoom from './screens/JoinRoom';
import Pokedex from './screens/Pokedex';

type Screen = 'menu' | 'create' | 'join' | 'pokedex';

interface RoomHistory {
  code: string;
  time: string;
}

export function MainMenu() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('menu');
  const [history] = useState<RoomHistory[]>([
    { code: 'AB3F2K', time: 'hace 5 minutos' },
    { code: 'XY7K2L', time: 'hace 1 hora' },
    { code: 'ZA9B1M', time: 'hace 3 horas' },
  ]);

  const handleBackToMenu = () => {
    setCurrentScreen('menu');
  };

  return (
    <div className="main-menu-wrapper">
      {currentScreen === 'menu' && (
        <MenuPrincipal
          onCreateRoom={() => setCurrentScreen('create')}
          onJoinRoom={() => setCurrentScreen('join')}
          onPokedex={() => setCurrentScreen('pokedex')}
          onHistoryClick={(code) => {
            // Aquí se podría implementar lógica para ir a sala desde historial
            console.log('Sala histórica:', code);
          }}
          history={history}
        />
      )}
      {currentScreen === 'create' && (
        <CreateRoom onBack={handleBackToMenu} />
      )}
      {currentScreen === 'join' && (
        <JoinRoom onBack={handleBackToMenu} />
      )}
      {currentScreen === 'pokedex' && (
        <Pokedex onBack={handleBackToMenu} />
      )}
    </div>
  );
}