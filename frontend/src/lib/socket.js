import { io } from 'socket.io-client'
export const socket = io(import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001')


