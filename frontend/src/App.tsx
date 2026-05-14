import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainMenu from './components/MainMenu';
import PokédexView from './components/PokédexView';
import Draft from './components/Draft';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/pokedex" element={
          <div className="pokedex-page">
            <PokédexView />
          </div>
        } />
        <Route path="/draft/:roomCode" element={<Draft />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
