import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:8080' : '';

export const socket = io(SOCKET_URL, {
  path: '/socket.io',
  reconnection: true,
  reconnectionDelay: 1000,
});

