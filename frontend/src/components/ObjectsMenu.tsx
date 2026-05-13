import { useBattle } from '../stores/battle';

interface ObjectsMenuProps {
  onClose: () => void;
}

export function ObjectsMenu({ onClose }: ObjectsMenuProps) {
  const { state, useItem } = useBattle();
  const items = state?.player1Items;

  const handleUsePotion = () => {
    if (items && items.potions > 0) {
      useItem('potion');
      onClose();
    }
  };

  const handleUseRevive = () => {
    if (items && items.revives > 0) {
      useItem('revive');
      onClose();
    }
  };

  return (
    <div className="objects-menu">
      <h3>Objetos</h3>
      <div className="items-list">
        <button
          className="item-button"
          onClick={handleUsePotion}
          disabled={!items?.potions}
        >
          <span>Poción Total</span>
          <span>{items?.potions}/3</span>
        </button>
        <button
          className="item-button"
          onClick={handleUseRevive}
          disabled={!items?.revives}
        >
          <span>Revivir</span>
          <span>{items?.revives}/2</span>
        </button>
      </div>
      <button className="close-button" onClick={onClose}>Cerrar</button>
    </div>
  );
}