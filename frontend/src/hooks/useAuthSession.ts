import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { socket } from '../websocket';

const API_BASE = 'http://localhost:3000/api';

export interface UseAuthSessionReturn {
  isAuthenticated: boolean;
  isSyncing: boolean;
  sessionId: string | null;
  playerName: string | null;
  shinyPack: boolean;
}

export function useAuthSession(): UseAuthSessionReturn {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(socket.getSessionId());
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [shinyPack, setShinyPack] = useState<boolean>(false);

  useEffect(() => {
    if (!isSignedIn) {
      // Anonymous flow: use whatever session_id is already set
      setSessionId(socket.getSessionId());
      return;
    }

    let cancelled = false;

    /**
     * Guarda el player_name en localStorage (para que MainMenu y otros
     * componentes lo tengan disponible sin esperar la sincronización asíncrona).
     */
    function persistPlayerName(name: string) {
      try {
        localStorage.setItem('patacon_player_name', name);
      } catch {
        // localStorage puede no estar disponible (entorno seguro, etc.)
      }
    }

    async function syncSession() {
      setIsSyncing(true);
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        // Try to get existing session_id from backend
        const getResponse = await fetch(`${API_BASE}/auth/session`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const getData = await getResponse.json();

        // Obtener player_name desde:
        // 1. SSO (Google/GitHub): user.fullName de Clerk
        // 2. Email sign-up: sessionStorage (guardado por AuthModal)
        const ssoPlayerName = user?.fullName || user?.firstName || null;
        const pendingUsername = sessionStorage.getItem('patacon_pending_username');
        const playerName = pendingUsername || ssoPlayerName || undefined;

        if (getData.session_id) {
          // Session exists - restore it and update player_name if needed
          if (playerName) {
            const postResp = await fetch(`${API_BASE}/auth/session`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                session_id: getData.session_id,
                player_name: playerName,
              }),
            });
            const postData = await postResp.json();
            if (!cancelled && postData?.user?.player_name) {
              setPlayerName(postData.user.player_name);
              persistPlayerName(postData.user.player_name);
                setShinyPack(!!postData.user.shiny_pack);
            }
          } else {
            // Si no hay player_name nuevo pero el GET devolvió uno, usarlo
            if (!cancelled && getData?.user?.player_name) {
              setPlayerName(getData.user.player_name);
              persistPlayerName(getData.user.player_name);
              setShinyPack(!!getData.user.shiny_pack);
            }
          }
          socket.setSessionId(getData.session_id);
          if (!cancelled) {
            setSessionId(getData.session_id);
          }
          // Limpiar pending username después de usarlo
          sessionStorage.removeItem('patacon_pending_username');
        } else {
          // No persisted session - create one with current session_id
          const currentSessionId = socket.getSessionId();
          const body: Record<string, any> = { session_id: currentSessionId };
          if (playerName) {
            body.player_name = playerName;
          }
          const postResp = await fetch(`${API_BASE}/auth/session`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          const postData = await postResp.json();
          if (!cancelled && postData?.user?.player_name) {
            setPlayerName(postData.user.player_name);
            persistPlayerName(postData.user.player_name);
            setShinyPack(!!postData.user.shiny_pack);
          }
          if (!cancelled) {
            setSessionId(currentSessionId);
          }
          // Limpiar pending username después de usarlo
          sessionStorage.removeItem('patacon_pending_username');
        }
      } catch (error) {
        console.error('[AuthSession] Error syncing session:', error);
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    }

    syncSession();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, user]);

  return {
    isAuthenticated: !!isSignedIn,
    isSyncing,
    sessionId,
    playerName,
    shinyPack,
  };
}
