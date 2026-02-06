type WebSocketMessage = {
	type: string;
	data: any;
};

export class WebSocketService {
	private ws: WebSocket | null = null;
	private listeners: Map<string, ((data: any) => void)[]> = new Map();

	connect(url: string) {
		this.disconnect();

		this.ws = new WebSocket(url);

		this.ws.onopen = () => {
			console.log("WebSocket connected");
		};

		this.ws.onerror = (error) => {
			console.error("WebSocket error:", error);
		};

		this.ws.onclose = () => {
			console.log("WebSocket disconnected");
		};

		this.ws.onmessage = (event) => {
			try {
				const message: WebSocketMessage = JSON.parse(event.data);
				this.listeners.get(message.type)?.forEach((cb) => cb(message.data));
			} catch (error) {
				console.error("Failed to parse WebSocket message:", error);
			}
		};
	}

	subscribe(type: string, callback: (data: any) => void) {
		if (!this.listeners.has(type)) this.listeners.set(type, []);
		this.listeners.get(type)!.push(callback);

		// Return unsubscribe function
		return () => {
			const callbacks = this.listeners.get(type);
			if (callbacks) {
				const index = callbacks.indexOf(callback);
				if (index > -1) {
					callbacks.splice(index, 1);
				}
			}
		};
	}

	disconnect() {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.listeners.clear();
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}
}

