/**
 * WebSocket Singleton (NUEVA ARQUITECTURA)
 * Una sola conexión WebSocket persistente por cliente
 * Reutilizable para múltiples salas
 */

// ==================== CONFIGURATION ====================
const WS_URL = 'ws://localhost:3000/ws';
const RECONNECT_BASE_DELAY = 1000; // 1 segundo inicial
const RECONNECT_MAX_DELAY = 30000; // 30 segundos máximo
const MAX_RECONNECT_ATTEMPTS = 10;

// ==================== TYPES ====================
type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;

interface WSEventMap {
  'connected': (data: any) => void;
  'disconnected': (data: any) => void;
  'room:created': (data: any) => void;
  'room:joined': (data: any) => void;
  'room:left': (data: any) => void;
  'room:closed': (data: any) => void;
  'room:reconnected': (data: any) => void;
  'player:joined': (data: any) => void;
  'player:left': (data: any) => void;
  'player:reconnected': (data: any) => void;
  'room:state': (data: any) => void;
  'draft:started': (data: any) => void;
  'draft:picked': (data: any) => void;
  'draft:picks': (data: any) => void;
  'draft:state': (data: any) => void;
  'draft:completed': (data: any) => void;
  'battle:starting': (data: any) => void;
  'error': (data: any) => void;
  'pong': (data: any) => void;
  'ping': (data: any) => void;
}

type WSEventType = keyof WSEventMap;

// ==================== WEBSOCKET MANAGER ====================
class WebSocketManager {
  private static instance: WebSocketManager;
  private socket: WebSocket | null = null;
  private sessionId: string = '';
  private currentRoomCode: string | null = null;

  // Reconnection state
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting = false;

  // Event handlers
  private eventHandlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private disconnectionHandlers: Set<ConnectionHandler> = new Set();

  // State
  private isConnected = false;
  private isConnecting = false;

  private constructor() {
    // Cargar sessionId del localStorage o generar uno nuevo
    this.sessionId = localStorage.getItem('patacon_session_id') || '';
    if (!this.sessionId) {
      this.sessionId = crypto.randomUUID();
      localStorage.setItem('patacon_session_id', this.sessionId);
    }

    // Cargar última sala del sessionStorage
    this.currentRoomCode = sessionStorage.getItem('patacon_room_code') || null;
  }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Inicializar la conexión WebSocket (una sola vez)
   */
  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log('[WS] Ya conectado o conectando');
      return;
    }

    if (this.isConnecting) {
      console.log('[WS] Conexión en progreso...');
      return;
    }

    this.isConnecting = true;

    const wsUrl = `${WS_URL}?session_id=${encodeURIComponent(this.sessionId)}`;
    console.log('[WS] Conectando a:', wsUrl);

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('[WS] Conexión establecida');
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;

      // Notificar handlers de conexión
      this.connectionHandlers.forEach(handler => handler());

      // Si había una sala anterior, intentar reconectar
      if (this.currentRoomCode) {
        this.send({
          type: 'RECONNECT',
          data: { roomCode: this.currentRoomCode }
        });
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (e) {
        console.error('[WS] Error parsing message:', e);
      }
    };

    this.socket.onclose = (event) => {
      console.log(`[WS] Conexión cerrada (code: ${event.code})`);
      this.isConnected = false;
      this.isConnecting = false;

      // Notificar handlers de desconexión
      this.disconnectionHandlers.forEach(handler => handler());

      // Auto-reconectar si no fue un cierre intencional
      if (event.code !== 1000 && event.code !== 1001) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error('[WS] Error:', error);
    };
  }

  /**
   * Reconexión automática con exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[WS] Máximo de reintentos alcanzado');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Calcular delay con exponential backoff
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      RECONNECT_MAX_DELAY
    );

    console.log(`[WS] Reconectando en ${delay}ms (intento ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    this.reconnectTimer = setTimeout(() => {
      this.isReconnecting = false;
      this.connect();
    }, delay);
  }

  /**
   * Enviar mensaje al servidor
   */
  public send(message: { type: string; data?: any }): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[WS] No conectado, no se puede enviar mensaje');
      return false;
    }

    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (e) {
      console.error('[WS] Error enviando mensaje:', e);
      return false;
    }
  }

  /**
   * Cerrar conexión intencionalmente
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close(1000, 'User disconnect');
      this.socket = null;
    }

    this.isConnected = false;
  }

  /**
   * Procesar mensaje recibido
   */
  private handleMessage(message: { type: string; data?: any; message?: any }): void {
    const { type, data } = message;
    console.log(`[WS:handleMessage] Type: ${type}, Handler exists: ${this.eventHandlers.has(type)}, Number of handlers: ${this.eventHandlers.get(type)?.size || 0}`);

    const payload = type === 'error'
      ? (data ?? message.message ?? message)
      : data;

    // Notificar a los handlers registrados para este tipo de evento
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      console.log(`[WS:handleMessage] Executing ${handlers.size} handler(s) for ${type}`);
      handlers.forEach(handler => handler(payload));
    }

    // También notificar a handlers generales
    const allHandlers = this.eventHandlers.get('*');
    if (allHandlers) {
      allHandlers.forEach(handler => handler(message));
    }
  }

  // ==================== ROOM MANAGEMENT ====================

  /**
   * Crear una nueva sala
   */
  public createRoom(playerName: string): boolean {
    return this.send({
      type: 'CREATE_ROOM',
      data: { player_name: playerName }
    });
  }

  /**
   * Unirse a una sala existente
   */
  public joinRoom(roomCode: string, playerName: string): boolean {
    this.currentRoomCode = roomCode.toUpperCase();
    sessionStorage.setItem('patacon_room_code', this.currentRoomCode);

    return this.send({
      type: 'JOIN_ROOM',
      data: {
        roomId: this.currentRoomCode,
        player_name: playerName
      }
    });
  }

  /**
   * Salir de la sala actual
   */
  public leaveRoom(): boolean {
    const success = this.send({ type: 'LEAVE_ROOM' });

    if (success) {
      this.currentRoomCode = null;
      sessionStorage.removeItem('patacon_room_code');
    }

    return success;
  }

  /**
   * Guardar el código de sala actual (para reconexión)
   */
  public setCurrentRoom(roomCode: string): void {
    this.currentRoomCode = roomCode.toUpperCase();
    sessionStorage.setItem('patacon_room_code', this.currentRoomCode);
  }

  // ==================== EVENT HANDLING ====================

  /**
   * Suscribirse a un tipo de evento específico
   */
  public on<E extends WSEventType>(event: E, handler: WSEventMap[E]): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler as MessageHandler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler as MessageHandler);
      }
    };
  }

  /**
   * Suscribirse a todos los eventos
   */
  public onAny(handler: (message: { type: string; data?: any }) => void): () => void {
    return this.on('*' as any, handler);
  }

  /**
   * Suscribirse a eventos de conexión
   */
  public onConnect(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  /**
   * Suscribirse a eventos de desconexión
   */
  public onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectionHandlers.add(handler);
    return () => {
      this.disconnectionHandlers.delete(handler);
    };
  }

  // ==================== STATE ====================

  public getSessionId(): string {
    return this.sessionId;
  }

  public getCurrentRoom(): string | null {
    return this.currentRoomCode;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getIsConnecting(): boolean {
    return this.isConnecting;
  }
}

// ==================== EXPORT SINGLETON ====================
export const socket = WebSocketManager.getInstance();

// ==================== CONVENIENCE METHODS ====================
// Estos métodos permiten usar el socket de forma más simple

export const connect = () => socket.connect();
export const disconnect = () => socket.disconnect();
export const send = (message: { type: string; data?: any }) => socket.send(message);
export const createRoom = (playerName: string) => socket.createRoom(playerName);
export const joinRoom = (roomCode: string, playerName: string) => socket.joinRoom(roomCode, playerName);
export const leaveRoom = () => socket.leaveRoom();
export const getSessionId = () => socket.getSessionId();
export const getCurrentRoom = () => socket.getCurrentRoom();
export const isConnected = () => socket.getIsConnected();

// ==================== TYPE EXPORTS ====================
export type { WSEventType, WSEventMap };