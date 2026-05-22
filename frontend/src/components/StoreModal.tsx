import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import '../styles/Store.css';

interface Props {
  sessionId: string;
  onClose: () => void;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function StoreModal({ sessionId, onClose }: Props) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [owned, setOwned] = useState<boolean | null>(null);
  const { isSignedIn } = useAuth();

  useEffect(() => {
    let cancelled = false;
    async function fetchProfile() {
      if (!isSignedIn) {
        setOwned(false);
        return;
      }
      try {
        const token = await getToken();
        const resp = await fetch(`${API_BASE}/api/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await resp.json();
        if (!cancelled && data?.user) {
          setOwned(!!data.user.shiny_pack);
        }
      } catch (err) {
        console.error('Error fetching profile in store:', err);
        setOwned(false);
      }
    }

    fetchProfile();

    return () => { cancelled = true; };
  }, [isSignedIn, getToken]);

  const handleBuyShiny = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/api/store/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ product: 'shiny_pack', session_id: sessionId }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.url) {
        alert('Error creating checkout session');
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      console.error('Store error:', err);
      alert('Error iniciando compra');
      setLoading(false);
    }
  };

  return (
    <div className="store-modal-overlay">
      <div className="store-modal-card">
        <button className="store-close" onClick={onClose}>✕</button>
        <h2>🛒 Tienda</h2>
        <p className="store-sub">Paquetes Premium</p>

        <div className="product-card">
          <h3>✨ Shiny Pokémon Pack</h3>
          <h4>Desbloquea los hermosos sprites shiny alternativos para todos tus Pokémon en batalla. Haz que tu equipo brille de manera única.</h4>
          <div className="product-footer">
            <strong>$59.99 USD</strong>
            {owned === null ? (
              <button className="btn btn-primary" disabled>Comprobando...</button>
            ) : owned === true ? (
              <button className="btn btn-secondary" disabled>✓ Comprado</button>
            ) : (
              <button className="btn btn-primary" onClick={handleBuyShiny} disabled={loading || !isSignedIn}>
                {loading ? 'Redirigiendo...' : 'Comprar'}
              </button>
            )}
          </div>
          {owned === true && (
            <div className="product-status">
              <span className="status-icon"></span>
              Activo en tu cuenta
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
