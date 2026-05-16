/**
 * useWebSocket - Hook de React para WebSocket
 * Proporciona acceso al WebSocketManager singleton desde componentes React
 */

import { useState, useEffect, useCallback } from 'react';
import { socket } from '../websocket';

export interface UseWebSocketReturn {
  sendMessage: (message: { type: string; data?: any }) => void;
  lastMessage: any | null;
  isConnected: boolean;
  subscribe: (event: string, handler: (data: any) => void) => () => void;
}

/**
 * Hook para usar WebSocket en componentes React
 */
export function useWebSocket(): UseWebSocketReturn {
  const [lastMessage, setLastMessage] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    // Handler para mensajes recibidos
    const unsubscribeAny = socket.onAny((data) => {
      setLastMessage(data);
    });
    
    // Handler para conexión
    const unsubscribeConnect = socket.onConnect(() => {
      setIsConnected(true);
    });
    
    // Handler para desconexión
    const unsubscribeDisconnect = socket.onDisconnect(() => {
      setIsConnected(false);
    });
    
    // Verificar estado inicial
    setIsConnected(socket.getIsConnected());
    
    // Cleanup - solo necesitamos llamar a las funciones retornadas por on() y onAny()
    return () => {
      unsubscribeAny();
      unsubscribeConnect();
      unsubscribeDisconnect();
    };
  }, []);
  
  /**
   * Enviar mensaje al servidor
   */
  const sendMessage = useCallback((message: { type: string; data?: any }) => {
    socket.send(message);
  }, []);
  
  /**
   * Suscribir a un evento específico
   */
  const subscribe = useCallback((event: string, handler: (data: any) => void) => {
    const unsubscribe = socket.on(event as any, handler);
    return unsubscribe;
  }, []);
  
  return {
    sendMessage,
    lastMessage,
    isConnected,
    subscribe
  };
}