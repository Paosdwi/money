const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:4000/ws";

export interface StreamSubscriptionOptions {
  topic: string;
  payload?: Record<string, unknown>;
  reconnect?: boolean;
}

export type MessageHandler<T> = (data: T) => void;

export async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

export function createWebSocket<T>(
  options: StreamSubscriptionOptions,
  onMessage: MessageHandler<T>,
  onStatus?: (status: "connected" | "disconnected" | "error") => void
): () => void {
  let socket: WebSocket | null = null;
  let retryCount = 0;
  let isManuallyClosed = false;

  const connect = () => {
    socket = new WebSocket(WS_BASE_URL);

    socket.addEventListener("open", () => {
      retryCount = 0;
      socket?.send(JSON.stringify(options));
      onStatus?.("connected");
    });

    socket.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(event.data) as T;
        onMessage(parsed);
      } catch (error) {
        console.error("Failed to parse websocket message", error);
      }
    });

    socket.addEventListener("close", () => {
      onStatus?.("disconnected");
      if (!isManuallyClosed && options.reconnect !== false) {
        retryCount += 1;
        const timeout = Math.min(1000 * 2 ** retryCount, 30_000);
        setTimeout(connect, timeout);
      }
    });

    socket.addEventListener("error", () => {
      onStatus?.("error");
    });
  };

  connect();

  return () => {
    isManuallyClosed = true;
    socket?.close();
  };
}
