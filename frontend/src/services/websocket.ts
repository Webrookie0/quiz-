type WebSocketMessage = {
  type: string;
  payload?: any;
  message?: string;
};

type WebSocketCallbacks = {
  onJoinedRoom?: (data: any) => void;
  onPlayerJoined?: (data: any) => void;
  onPlayerLeft?: (data: any) => void;
  onAdminStatus?: (data: any) => void;
  onGameStarted?: (data: any) => void;
  onNextQuestion?: (data: any) => void;
  onGameCompleted?: (data: any) => void;
  onAnswerRecorded?: (data: any) => void;
  onError?: (error: string) => void;
};

class WebSocketService {
  private ws: WebSocket | null = null;
  private callbacks: WebSocketCallbacks = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private messageQueue: WebSocketMessage[] = [];

  connect(url: string) {
    // If already connected/connecting to the same URL, might want to avoid reconnecting,
    // but for now, we'll assume a fresh connect is desired or handle it simply.
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.ws = null;
      this.attemptReconnect(url);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.callbacks.onError?.('WebSocket connection error');
    };
  }

  private attemptReconnect(url: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect(url);
      }, 1000 * this.reconnectAttempts);
    }
  }

  private handleMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'joined-room':
        this.callbacks.onJoinedRoom?.(message.payload);
        break;
      case 'player-joined':
        this.callbacks.onPlayerJoined?.(message.payload);
        break;
      case 'player-left':
        this.callbacks.onPlayerLeft?.(message.payload);
        break;
      case 'admin-status':
        this.callbacks.onAdminStatus?.(message.payload);
        break;
      case 'game-started':
        this.callbacks.onGameStarted?.(message.payload);
        break;
      case 'next-question':
        this.callbacks.onNextQuestion?.(message.payload);
        break;
      case 'game-completed':
        this.callbacks.onGameCompleted?.(message.payload);
        break;
      case 'answer-recorded':
        this.callbacks.onAnswerRecorded?.(message.payload);
        break;
      case 'error':
        this.callbacks.onError?.(message.message || 'Unknown error');
        break;
      case 'room-deleted':
        this.callbacks.onError?.((message.payload?.message as string) || 'Room deleted');
        break;
    }
  }

  send(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.log('WebSocket not ready, queuing message:', message.type);
      this.messageQueue.push(message);
    }
  }

  private flushMessageQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        console.log('Sending queued message:', message.type);
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  setCallbacks(callbacks: WebSocketCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks = {};
    this.messageQueue = [];
  }
}

const websocketService = new WebSocketService();
export default websocketService;


