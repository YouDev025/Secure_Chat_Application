# Secure Chat Application

A full-stack secure messaging demo built with React, TypeScript, Express, Socket.IO, Prisma, and PostgreSQL. It includes account registration, JWT authentication, real-time one-to-one messaging, encrypted message storage, and a polished chat interface with light/dark themes.

> Security note: this project is a strong learning foundation, not a production-ready encrypted messenger yet. Messages are encrypted in the browser with AES-GCM before being sent to the server, but the current shared key is deterministically derived from user IDs. Before using this in production, replace that demo key derivation with a real end-to-end encryption protocol and move private key storage out of `localStorage`.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [View Database Tables](#view-database-tables)
- [Running the App](#running-the-app)
- [API Reference](#api-reference)
- [Socket Events](#socket-events)
- [Security Model](#security-model)
- [Testing](#testing)
- [Production Checklist](#production-checklist)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [License](#license)

## Features

- User registration and login with email/password credentials.
- Password hashing with Argon2.
- JWT-protected REST endpoints and Socket.IO connections.
- Real-time private messaging with Socket.IO.
- Browser-side message encryption using the Web Crypto API and AES-GCM.
- Encrypted message persistence in PostgreSQL.
- Prisma schema for users, sessions, and messages.
- Contact list with authenticated user discovery.
- Responsive chat UI built with React and Vite.
- Light and dark theme support.
- Docker Compose PostgreSQL service for local development.
- Socket-based e2e smoke script for messaging flow validation.

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- Socket.IO Client
- Axios
- Lucide React icons
- Web Crypto API

### Backend

- Node.js
- Express 5
- TypeScript
- Socket.IO
- Prisma ORM
- PostgreSQL
- Argon2
- JSON Web Tokens
- Helmet, CORS, Morgan

### Tooling

- Docker Compose
- npm
- ts-node-dev

## Architecture

```text
Browser
  |-- React UI
  |-- Auth context stores session data
  |-- Web Crypto encrypts/decrypts chat messages
  |
  | REST: /api/auth/*
  | Socket.IO: authenticated realtime channel
  v
Express + Socket.IO Backend
  |-- Registers and authenticates users
  |-- Verifies JWTs for API and socket access
  |-- Stores encrypted message payloads
  v
PostgreSQL
  |-- User records
  |-- Session records
  |-- Encrypted messages and IVs
```

## Project Structure

```text
.
|-- backend/
|   |-- prisma/
|   |   `-- schema.prisma
|   |-- src/
|   |   |-- controllers/
|   |   |   `-- auth.ts
|   |   |-- lib/
|   |   |   `-- prisma.ts
|   |   |-- middleware/
|   |   |   `-- auth.ts
|   |   |-- routes/
|   |   |   `-- auth.ts
|   |   |-- app.ts
|   |   `-- index.ts
|   |-- .env.example
|   `-- package.json
|-- frontend/
|   |-- src/
|   |   |-- components/
|   |   |   |-- Auth.tsx
|   |   |   `-- Chat.tsx
|   |   |-- context/
|   |   |   `-- AuthContext.tsx
|   |   |-- utils/
|   |   |   `-- crypto.ts
|   |   |-- App.tsx
|   |   `-- main.tsx
|   |-- .env.example
|   `-- package.json
|-- scripts/
|   `-- e2e-socket.mjs
|-- docker-compose.yml
`-- README.md
```

## Prerequisites

Install these before running the app:

- Node.js 18 or newer
- npm
- Docker Desktop or a local PostgreSQL server

## Quick Start

Clone the project and install dependencies:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

Create local environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Start PostgreSQL:

```bash
docker compose up -d
```

Prepare Prisma:

```bash
cd backend
npx prisma generate
npx prisma db push
```

Start the backend:

```bash
npm run dev
```

In a second terminal, start the frontend:

```bash
cd frontend
npm run dev
```

Open the app:

```text
http://localhost:5173
```

## Environment Variables

### Backend

Create `backend/.env` from `backend/.env.example`.

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/secure_chat?schema=public
JWT_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
```

Recommended local secret generation:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Frontend

Create `frontend/.env` from `frontend/.env.example`.

```env
VITE_BACKEND_URL=http://localhost:5000
```

Never commit real `.env` files, production credentials, JWT secrets, or database URLs.

## Database Setup

The Docker Compose file starts PostgreSQL 15 with these local defaults:

```text
Host: localhost
Port: 5432
Database: secure_chat
Username: postgres
Password: postgres
```

Apply the Prisma schema:

```bash
cd backend
npx prisma db push
```

Open Prisma Studio:

```bash
cd backend
npx prisma studio
```

Reset local database data:

```bash
cd backend
npx prisma db push --force-reset
```

## View Database Tables

Use Prisma Studio to open a browser-based database viewer for the local PostgreSQL data.

First, make sure PostgreSQL is running:

```bash
docker compose up -d
```

If the tables do not exist yet, apply the Prisma schema:

```bash
cd backend
npx prisma db push
```

Then start Prisma Studio:

```bash
npx prisma studio
```

Open the URL printed in the terminal, usually:

```text
http://localhost:5555
```

You should see the main tables/models:

- `User`
- `Session`
- `Message`

## Running the App

### Backend

```bash
cd backend
npm run dev
```

Backend URL:

```text
http://localhost:5000
```

Health check:

```text
GET http://localhost:5000/health
```

### Frontend

```bash
cd frontend
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

### Production Build

Backend:

```bash
cd backend
npm run build
npm start
```

Frontend:

```bash
cd frontend
npm run build
npm run preview
```

## API Reference

Base URL:

```text
http://localhost:5000
```

### Health Check

```http
GET /health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2026-05-20T12:00:00.000Z"
}
```

### Register

```http
POST /api/auth/register
Content-Type: application/json
```

Request:

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "Password123!",
  "publicKey": "{...}"
}
```

Successful response:

```json
{
  "message": "User registered successfully"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

Request:

```json
{
  "email": "alice@example.com",
  "password": "Password123!"
}
```

Successful response:

```json
{
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "username": "alice",
    "email": "alice@example.com",
    "publicKey": "{...}"
  }
}
```

### List Users

```http
GET /api/auth/users
Authorization: Bearer <token>
```

Successful response:

```json
[
  {
    "id": "user-id",
    "username": "bob",
    "publicKey": "{...}"
  }
]
```

## Socket Events

Socket connections require a valid JWT:

```ts
const socket = io("http://localhost:5000", {
  auth: { token }
});
```

### Client Emits

`send_message`

```json
{
  "receiverId": "receiver-user-id",
  "encryptedContent": "base64-encrypted-message",
  "iv": "base64-iv"
}
```

`get_messages`

```json
{
  "withUserId": "other-user-id"
}
```

### Server Emits

`receive_message`

Sent to the receiver when they are online.

`message_sent_confirm`

Sent to the sender after the message is stored.

`chat_history`

Sent after requesting conversation history.

`error`

Sent when a socket operation fails.

## Security Model

What is already implemented:

- Passwords are hashed with Argon2 before storage.
- REST user listing is protected by JWT middleware.
- Socket.IO connections are authenticated with JWTs.
- Messages are encrypted in the browser before being sent to the backend.
- The database stores encrypted message content plus the AES-GCM IV.
- Helmet is enabled for basic HTTP security headers.
- CORS is restricted to the configured frontend origin.

Important limitations:

- Current message key derivation is demo-grade and based on sorted user IDs.
- The generated private key is stored in `localStorage`.
- Refresh-token/session persistence exists in the schema but is not fully wired into auth flows.
- MFA fields exist in the schema but MFA is not implemented yet.
- There is no rate limiting, account lockout, device management, or audit logging yet.

For production encryption, use a reviewed protocol such as Signal-style X3DH plus Double Ratchet, or a well-maintained library that implements an equivalent modern protocol.

## Testing

The repository currently includes a Socket.IO smoke script.

Start the database and backend first, then run:

```bash
node scripts/e2e-socket.mjs
```

The script:

- Registers two test users.
- Logs them in.
- Opens two authenticated socket connections.
- Sends an encrypted payload from Alice to Bob.
- Prints socket confirmations and received events.

Recommended next tests:

- Backend unit tests for auth validation and JWT middleware.
- Integration tests for registration, login, and user listing.
- Socket tests for authenticated and unauthenticated clients.
- Frontend tests for login, registration, contact selection, and send-message behavior.
- Crypto utility tests for encrypt/decrypt success and failure cases.

## Production Checklist

Before deploying beyond a demo environment:

- Replace demo message key derivation with real end-to-end encryption.
- Store private keys in a safer browser storage strategy, ideally protected by a user secret.
- Enforce strong password policy and add rate limiting.
- Add refresh-token rotation and session revocation.
- Add MFA flow or remove unused MFA schema fields.
- Use HTTPS everywhere.
- Set strict production CORS origins.
- Use managed PostgreSQL with backups and least-privilege credentials.
- Add structured logging and monitoring.
- Add CI checks for type safety, linting, tests, and dependency scanning.
- Rotate any exposed secrets immediately.

## Troubleshooting

### PostgreSQL connection fails

Confirm Docker is running:

```bash
docker compose ps
```

Confirm `DATABASE_URL` matches `docker-compose.yml`.

### Prisma client errors

Regenerate Prisma client:

```bash
cd backend
npx prisma generate
```

Push the schema:

```bash
cd backend
npx prisma db push
```

### Frontend cannot reach backend

Check `frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:5000
```

Check backend CORS origin in `backend/.env`:

```env
FRONTEND_URL=http://localhost:5173
```

### Socket authentication fails

Log in again and confirm the frontend has a valid token in local storage. Also verify `JWT_SECRET` is stable while the backend is running.

### Port already in use

Change backend port in `backend/.env`:

```env
PORT=5001
```

Then update frontend backend URL:

```env
VITE_BACKEND_URL=http://localhost:5001
```

## Roadmap

- Real E2EE key exchange and per-conversation secrets.
- Refresh-token rotation and session management.
- MFA enrollment and verification.
- Read receipts and typing indicators.
- File and image attachments.
- Message deletion and edit history.
- Group chats.
- User profile settings.
- Automated test suite and CI pipeline.
- Deployment manifests for production hosting.

## License

This project currently uses the ISC license declared in the package manifests.
