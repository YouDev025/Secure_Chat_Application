import axios from 'axios';
import { io } from 'socket.io-client';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

async function registerUser(username, email, password) {
  try {
    const res = await axios.post(`${BACKEND}/api/auth/register`, { username, email, password, publicKey: '{}' });
    console.log(`Registered ${username}:`, res.status);
  } catch (err) {
    if (err.response) console.log(`Register ${username} failed:`, err.response.data);
    else console.error(err);
  }
}

async function loginUser(email, password) {
  const res = await axios.post(`${BACKEND}/api/auth/login`, { email, password });
  return res.data;
}

function connectSocket(token, name) {
  const socket = io(BACKEND, { auth: { token }, transports: ['websocket'] });
  socket.on('connect', () => console.log(`${name} connected:`, socket.id));
  socket.on('connect_error', (err) => console.error(`${name} connect_error:`, err.message || err));
  socket.on('receive_message', (msg) => console.log(`${name} received message:`, msg));
  socket.on('message_sent_confirm', (msg) => console.log(`${name} message_sent_confirm:`, msg));
  socket.on('chat_history', (history) => console.log(`${name} chat history length:`, history.length));
  socket.on('error', (e) => console.error(`${name} socket error:`, e));
  return socket;
}

(async () => {
  try {
    // Register users
    await registerUser('e2e_alice', 'e2e_alice@example.com', 'Password123!');
    await registerUser('e2e_bob', 'e2e_bob@example.com', 'Password123!');

    // Login
    const alice = await loginUser('e2e_alice@example.com', 'Password123!');
    console.log('Alice token length:', alice.token?.length || 0);
    const bob = await loginUser('e2e_bob@example.com', 'Password123!');
    console.log('Bob token length:', bob.token?.length || 0);

    // Connect sockets
    const aliceSocket = connectSocket(alice.token, 'Alice');
    const bobSocket = connectSocket(bob.token, 'Bob');

    // Wait for connections
    await new Promise((res) => setTimeout(res, 1000));

    // Alice sends message to Bob
    console.log('Alice sending message to Bob...');
    aliceSocket.emit('send_message', {
      receiverId: bob.user.id,
      encryptedContent: 'dmF1bCB0ZXN0IG1lc3NhZ2U=',
      iv: 'aW5pdHZlY3Rvcg=='
    });

    // Wait to observe events
    await new Promise((res) => setTimeout(res, 2000));

    aliceSocket.disconnect();
    bobSocket.disconnect();

    console.log('E2E socket test complete');
    process.exit(0);
  } catch (err) {
    console.error('E2E test error:', err);
    process.exit(1);
  }
})();
