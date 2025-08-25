import { io } from "socket.io-client";

const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL || "http://localhost:3001";
console.log("[socket] Connecting to:", SIGNALING_URL);

export const socket = io(SIGNALING_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"]
});

// Add connection event listeners for debugging
socket.on("connect", () => {
  console.log("[socket] Connected to backend:", SIGNALING_URL);
});

socket.on("disconnect", (reason) => {
  console.log("[socket] Disconnected from backend:", reason);
});

socket.on("connect_error", (error) => {
  console.error("[socket] Connection error:", error);
});
