# Aspect Foundation & Walking Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Aspect monorepo as an end-to-end "walking skeleton": a Fastify server that serves the React PWA and pushes a live status message over a WebSocket, a React client that connects and displays that status with a Motion animation, shared TypeScript contracts, full test coverage of the logic, and CI.

**Architecture:** A pnpm workspace monorepo with three packages: `packages/shared` (TypeScript types/contracts shared by both sides), `apps/server` (Fastify HTTP + WebSocket; the future sole HA client and config store), and `apps/web` (React + Vite + Motion PWA; the future dashboard). In this plan the server has no HA connection yet — it emits a synthetic status so we can prove the full client↔server pipe, build, and CI before layering HA, caching, and the dashboard on top in later plans.

**Tech Stack:** Node 22, pnpm 9, TypeScript 5.7 (ESM, strict), Fastify 5 + `@fastify/websocket` + `@fastify/static`, `ws` (test client), Vite 6 + React 19 + `@vitejs/plugin-react`, `vite-plugin-pwa`, Zustand 5, Motion 11 (`motion/react`), Vitest 3 + `@testing-library/react` + jsdom, tsup + tsx, GitHub Actions.

---

## File Structure

```
package.json                      Root workspace scripts (private)
pnpm-workspace.yaml               Declares packages/* and apps/*
tsconfig.base.json                Shared strict TS compiler options
.nvmrc                            Node 22
.github/workflows/ci.yml          typecheck + test + build on push/PR

packages/shared/
  package.json                    name "@aspect/shared", exports src/index.ts
  tsconfig.json
  src/index.ts                    barrel re-export
  src/messages.ts                 WS message contracts + factories
  src/messages.test.ts            tests for factories/guards

apps/server/
  package.json                    name "@aspect/server"
  tsconfig.json
  tsup.config.ts                  prod bundle config
  vitest.config.ts
  src/app.ts                      buildApp(): Fastify instance (no listen)
  src/server.ts                   entry point: build + listen
  src/config.ts                   env-driven runtime config (port, web dir)
  src/routes/health.ts            GET /health
  src/ws/statusChannel.ts         /ws channel: push status, broadcast helper
  src/static.ts                   serve built web assets in production
  test/health.test.ts
  test/statusChannel.test.ts
  test/helpers/wsTestClient.ts    spin up app, connect a ws client

apps/web/
  package.json                    name "@aspect/web"
  tsconfig.json
  tsconfig.node.json              for vite config typecheck
  vite.config.ts                  react + PWA + dev proxy to server
  vitest.config.ts                jsdom env
  index.html
  public/icons/                   PWA icons (placeholder pngs)
  src/main.tsx                    React root
  src/App.tsx                     status pill UI (Motion)
  src/store/connectionStore.ts    Zustand: connection + server status
  src/store/connectionStore.test.ts
  src/server-client/messageHandler.ts   pure: raw msg -> store update
  src/server-client/messageHandler.test.ts
  src/server-client/socket.ts     WebSocket wrapper w/ reconnect backoff
  src/App.test.tsx                smoke render test
  src/test/setup.ts               testing-library jsdom setup
```

**Boundary rationale:** `packages/shared` is the single source of truth for the wire contract so the server and client can never drift. On the client, message *parsing/decision* logic (`messageHandler.ts`) is split from the *transport* (`socket.ts`) so the decision logic is pure and unit-testable without a live socket. On the server, `app.ts` builds the Fastify instance without listening so tests can use `fastify.inject()` and an ephemeral port.

---

## Task 1: Initialize the monorepo root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.nvmrc`

- [ ] **Step 1: Create `.nvmrc`**

```
22
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

- [ ] **Step 3: Create the root `package.json`**

```json
{
  "name": "aspect",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "pnpm --parallel --filter @aspect/server --filter @aspect/web dev",
    "build": "pnpm --filter @aspect/web build && pnpm --filter @aspect/server build",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "test:run": "pnpm -r test:run"
  },
  "devDependencies": {
    "typescript": "5.7.2"
  }
}
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 5: Install pnpm and verify the workspace resolves**

Run: `corepack enable && pnpm install`
Expected: pnpm installs with no errors and creates `pnpm-lock.yaml` (no packages yet beyond root typescript).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .nvmrc pnpm-lock.yaml
git commit -m "chore: initialize pnpm monorepo workspace"
```

---

## Task 2: Shared WebSocket contracts package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/messages.ts`
- Test: `packages/shared/src/messages.test.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@aspect/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "devDependencies": {
    "typescript": "5.7.2",
    "vitest": "3.0.5"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "types": []
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write the failing test `packages/shared/src/messages.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  createStatusMessage,
  isServerToClientMessage,
  type StatusMessage,
} from './messages.js';

describe('createStatusMessage', () => {
  it('builds a status message with a timestamp', () => {
    const before = Date.now();
    const msg = createStatusMessage('online', true);
    expect(msg.type).toBe('status');
    expect(msg.status).toBe('online');
    expect(msg.haConnected).toBe(true);
    expect(msg.ts).toBeGreaterThanOrEqual(before);
  });
});

describe('isServerToClientMessage', () => {
  it('accepts a valid status message', () => {
    const msg: StatusMessage = createStatusMessage('degraded', false);
    expect(isServerToClientMessage(msg)).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isServerToClientMessage({ type: 'nope' })).toBe(false);
    expect(isServerToClientMessage(null)).toBe(false);
    expect(isServerToClientMessage('status')).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @aspect/shared test:run`
Expected: FAIL — cannot resolve `./messages.js` / exports not defined.

- [ ] **Step 5: Implement `packages/shared/src/messages.ts`**

```ts
/** High-level health of the Aspect server. */
export type ServerStatus = 'connecting' | 'online' | 'degraded';

/** Pushed by the server to every client whenever its status changes. */
export interface StatusMessage {
  type: 'status';
  status: ServerStatus;
  /** Whether the server currently holds a live Home Assistant connection. */
  haConnected: boolean;
  /** Unix epoch milliseconds when the message was created. */
  ts: number;
}

/** Union of every message the server can send to a client. */
export type ServerToClientMessage = StatusMessage;

/** Sent by a client immediately after connecting. */
export interface HelloMessage {
  type: 'hello';
  clientId: string;
}

/** Union of every message a client can send to the server. */
export type ClientToServerMessage = HelloMessage;

export function createStatusMessage(
  status: ServerStatus,
  haConnected: boolean,
): StatusMessage {
  return { type: 'status', status, haConnected, ts: Date.now() };
}

export function isServerToClientMessage(
  value: unknown,
): value is ServerToClientMessage {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'status' &&
    typeof candidate.status === 'string' &&
    typeof candidate.haConnected === 'boolean' &&
    typeof candidate.ts === 'number'
  );
}
```

- [ ] **Step 6: Create the barrel `packages/shared/src/index.ts`**

```ts
export * from './messages.js';
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @aspect/shared test:run`
Expected: PASS (4 tests).

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @aspect/shared typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): add server/client websocket message contracts"
```

---

## Task 3: Server scaffold with health route

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/vitest.config.ts`
- Create: `apps/server/src/config.ts`
- Create: `apps/server/src/app.ts`
- Create: `apps/server/src/routes/health.ts`
- Test: `apps/server/test/health.test.ts`

- [ ] **Step 1: Create `apps/server/package.json`**

```json
{
  "name": "@aspect/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "@aspect/shared": "workspace:*",
    "@fastify/static": "8.0.3",
    "@fastify/websocket": "11.0.1",
    "fastify": "5.1.0"
  },
  "devDependencies": {
    "@types/node": "22.10.1",
    "@types/ws": "8.5.13",
    "tsup": "8.3.5",
    "tsx": "4.19.2",
    "typescript": "5.7.2",
    "vitest": "3.0.5",
    "ws": "8.18.0"
  }
}
```

- [ ] **Step 2: Create `apps/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `apps/server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `apps/server/src/config.ts`**

```ts
export interface AspectConfig {
  /** Port the HTTP/WebSocket server listens on. */
  port: number;
  /** Host interface to bind. */
  host: string;
  /** Absolute path to the built web assets, or null in dev. */
  webDir: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AspectConfig {
  return {
    port: env.PORT ? Number.parseInt(env.PORT, 10) : 8099,
    host: env.HOST ?? '0.0.0.0',
    webDir: env.ASPECT_WEB_DIR ?? null,
  };
}
```

- [ ] **Step 5: Write the failing test `apps/server/test/health.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /health', () => {
  it('returns ok status as JSON', async () => {
    app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm --filter @aspect/server test:run`
Expected: FAIL — `../src/app.js` has no export `buildApp`.

- [ ] **Step 7: Create `apps/server/src/routes/health.ts`**

```ts
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok' }));
}
```

- [ ] **Step 8: Create `apps/server/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoutes } from './routes/health.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(healthRoutes);
  return app;
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `pnpm --filter @aspect/server test:run`
Expected: PASS (1 test).

- [ ] **Step 10: Commit**

```bash
git add apps/server pnpm-lock.yaml
git commit -m "feat(server): scaffold fastify app with health route"
```

---

## Task 4: Server WebSocket status channel

**Files:**
- Create: `apps/server/src/ws/statusChannel.ts`
- Modify: `apps/server/src/app.ts`
- Create: `apps/server/test/helpers/wsTestClient.ts`
- Test: `apps/server/test/statusChannel.test.ts`

- [ ] **Step 1: Create the test helper `apps/server/test/helpers/wsTestClient.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';

/** Starts the app on an ephemeral port and returns its base ws URL. */
export async function listen(app: FastifyInstance): Promise<string> {
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  // address looks like http://127.0.0.1:54321
  return address.replace('http://', 'ws://');
}

/** Opens a ws connection and resolves with the first parsed JSON message. */
export function firstMessage(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.on('message', (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (err) {
        reject(err);
      } finally {
        socket.close();
      }
    });
    socket.on('error', reject);
  });
}
```

- [ ] **Step 2: Write the failing test `apps/server/test/statusChannel.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { isServerToClientMessage } from '@aspect/shared';
import { buildApp } from '../src/app.js';
import { listen, firstMessage } from './helpers/wsTestClient.js';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /ws', () => {
  it('sends a status message immediately on connect', async () => {
    app = await buildApp();
    const base = await listen(app);
    const msg = await firstMessage(`${base}/ws`);
    expect(isServerToClientMessage(msg)).toBe(true);
    expect((msg as { type: string }).type).toBe('status');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @aspect/server test:run statusChannel`
Expected: FAIL — connection to `/ws` is rejected (route not registered).

- [ ] **Step 4: Create `apps/server/src/ws/statusChannel.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import {
  createStatusMessage,
  type ServerStatus,
  type ServerToClientMessage,
} from '@aspect/shared';

/**
 * Tracks connected clients and lets the rest of the server broadcast status.
 * In this plan the status is synthetic ("online", haConnected=false). Later
 * plans replace the source with the real Home Assistant connection state.
 */
export class StatusHub {
  private readonly clients = new Set<WebSocket>();
  private status: ServerStatus = 'online';
  private haConnected = false;

  add(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on('close', () => this.clients.delete(socket));
    this.send(socket, createStatusMessage(this.status, this.haConnected));
  }

  setStatus(status: ServerStatus, haConnected: boolean): void {
    this.status = status;
    this.haConnected = haConnected;
    const msg = createStatusMessage(status, haConnected);
    for (const socket of this.clients) this.send(socket, msg);
  }

  private send(socket: WebSocket, msg: ServerToClientMessage): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
  }
}

export async function statusChannel(app: FastifyInstance): Promise<void> {
  const hub = new StatusHub();
  app.decorate('statusHub', hub);
  app.get('/ws', { websocket: true }, (socket) => {
    hub.add(socket);
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    statusHub: StatusHub;
  }
}
```

- [ ] **Step 5: Register the websocket plugin and channel in `apps/server/src/app.ts`**

Replace the entire file with:

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { healthRoutes } from './routes/health.js';
import { statusChannel } from './ws/statusChannel.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket);
  await app.register(healthRoutes);
  await app.register(statusChannel);
  return app;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @aspect/server test:run`
Expected: PASS (health + statusChannel = 2 tests).

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @aspect/server typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/server pnpm-lock.yaml
git commit -m "feat(server): add websocket status channel with broadcast hub"
```

---

## Task 5: Server production entry, static serving, and bundle

**Files:**
- Create: `apps/server/src/static.ts`
- Create: `apps/server/src/server.ts`
- Create: `apps/server/tsup.config.ts`

- [ ] **Step 1: Create `apps/server/src/static.ts`**

```ts
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';

/**
 * Serves the built web app from `webDir` and falls back to index.html for
 * client-side routes. No-op when webDir is null (development uses Vite).
 */
export async function registerStatic(
  app: FastifyInstance,
  webDir: string | null,
): Promise<void> {
  if (!webDir || !existsSync(webDir)) return;
  await app.register(fastifyStatic, { root: path.resolve(webDir) });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/ws') || req.url.startsWith('/health')) {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    reply.sendFile('index.html');
  });
}
```

- [ ] **Step 2: Wire static serving into `apps/server/src/app.ts`**

Replace the file with:

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { healthRoutes } from './routes/health.js';
import { statusChannel } from './ws/statusChannel.js';
import { registerStatic } from './static.js';

export interface BuildAppOptions {
  webDir?: string | null;
}

export async function buildApp(
  opts: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket);
  await app.register(healthRoutes);
  await app.register(statusChannel);
  await registerStatic(app, opts.webDir ?? null);
  return app;
}
```

- [ ] **Step 3: Create the entry point `apps/server/src/server.ts`**

```ts
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ webDir: config.webDir });
  await app.listen({ port: config.port, host: config.host });
  // eslint-disable-next-line no-console
  console.log(`Aspect server listening on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Create `apps/server/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  noExternal: ['@aspect/shared'],
});
```

- [ ] **Step 5: Verify the production build succeeds**

Run: `pnpm --filter @aspect/server build`
Expected: `apps/server/dist/server.js` is produced with no errors.

- [ ] **Step 6: Verify the server boots and health responds**

Run: `node apps/server/dist/server.js & sleep 1 && curl -s http://127.0.0.1:8099/health && kill %1`
Expected: prints `{"status":"ok"}`.

(On Windows PowerShell, run `node apps/server/dist/server.js` in one terminal and `curl http://127.0.0.1:8099/health` in another, then stop the process.)

- [ ] **Step 7: Commit**

```bash
git add apps/server pnpm-lock.yaml
git commit -m "feat(server): add prod entry point, static serving and tsup bundle"
```

---

## Task 6: Web app scaffold (Vite + React + PWA)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/public/icons/icon-192.png` and `icon-512.png` (placeholders)

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@aspect/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "@aspect/shared": "workspace:*",
    "motion": "11.15.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "zustand": "5.0.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.1.0",
    "@types/react": "19.0.1",
    "@types/react-dom": "19.0.2",
    "@vitejs/plugin-react": "4.3.4",
    "jsdom": "25.0.1",
    "typescript": "5.7.2",
    "vite": "6.0.3",
    "vite-plugin-pwa": "0.21.1",
    "vitest": "3.0.5"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/web/tsconfig.node.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create `apps/web/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Aspect',
        short_name: 'Aspect',
        description: 'A gorgeous Home Assistant dashboard for the whole family.',
        theme_color: '#16161a',
        background_color: '#16161a',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:8099', ws: true },
      '/health': { target: 'http://127.0.0.1:8099' },
    },
  },
});
```

- [ ] **Step 5: Create `apps/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />
    <meta name="theme-color" content="#16161a" />
    <title>Aspect</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create placeholder PWA icons**

Run (from repo root):

```bash
mkdir -p apps/web/public/icons
# 1x1 transparent PNG placeholder, replaced with real icons in a later plan
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > apps/web/public/icons/icon-192.png
cp apps/web/public/icons/icon-192.png apps/web/public/icons/icon-512.png
```

- [ ] **Step 7: Create `apps/web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Install dependencies**

Run: `pnpm install`
Expected: installs web deps with no errors. (`App.js` import will resolve once Task 8 creates `App.tsx`.)

- [ ] **Step 9: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold vite + react + pwa app shell"
```

---

## Task 7: Connection store and message handler (client logic)

**Files:**
- Create: `apps/web/src/store/connectionStore.ts`
- Test: `apps/web/src/store/connectionStore.test.ts`
- Create: `apps/web/src/server-client/messageHandler.ts`
- Test: `apps/web/src/server-client/messageHandler.test.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`

- [ ] **Step 1: Create `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 2: Create `apps/web/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Write the failing test `apps/web/src/store/connectionStore.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useConnectionStore } from './connectionStore.js';

describe('connectionStore', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      link: 'disconnected',
      serverStatus: null,
      haConnected: false,
    });
  });

  it('starts disconnected with no server status', () => {
    const state = useConnectionStore.getState();
    expect(state.link).toBe('disconnected');
    expect(state.serverStatus).toBeNull();
  });

  it('updates link state', () => {
    useConnectionStore.getState().setLink('connected');
    expect(useConnectionStore.getState().link).toBe('connected');
  });

  it('applies a status message', () => {
    useConnectionStore.getState().applyStatus('online', true);
    const state = useConnectionStore.getState();
    expect(state.serverStatus).toBe('online');
    expect(state.haConnected).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @aspect/web test:run connectionStore`
Expected: FAIL — `./connectionStore.js` not found.

- [ ] **Step 5: Implement `apps/web/src/store/connectionStore.ts`**

```ts
import { create } from 'zustand';
import type { ServerStatus } from '@aspect/shared';

/** Whether the browser currently holds a socket to the Aspect server. */
export type LinkState = 'disconnected' | 'connecting' | 'connected';

interface ConnectionState {
  link: LinkState;
  serverStatus: ServerStatus | null;
  haConnected: boolean;
  setLink: (link: LinkState) => void;
  applyStatus: (status: ServerStatus, haConnected: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  link: 'disconnected',
  serverStatus: null,
  haConnected: false,
  setLink: (link) => set({ link }),
  applyStatus: (serverStatus, haConnected) => set({ serverStatus, haConnected }),
}));
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @aspect/web test:run connectionStore`
Expected: PASS (3 tests).

- [ ] **Step 7: Write the failing test `apps/web/src/server-client/messageHandler.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { handleRawMessage } from './messageHandler.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { createStatusMessage } from '@aspect/shared';

describe('handleRawMessage', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      link: 'connected',
      serverStatus: null,
      haConnected: false,
    });
  });

  it('applies a valid status message to the store', () => {
    handleRawMessage(JSON.stringify(createStatusMessage('degraded', true)));
    const state = useConnectionStore.getState();
    expect(state.serverStatus).toBe('degraded');
    expect(state.haConnected).toBe(true);
  });

  it('ignores invalid json without throwing', () => {
    expect(() => handleRawMessage('not json')).not.toThrow();
    expect(useConnectionStore.getState().serverStatus).toBeNull();
  });

  it('ignores well-formed json that is not a known message', () => {
    handleRawMessage(JSON.stringify({ type: 'mystery' }));
    expect(useConnectionStore.getState().serverStatus).toBeNull();
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `pnpm --filter @aspect/web test:run messageHandler`
Expected: FAIL — `./messageHandler.js` not found.

- [ ] **Step 9: Implement `apps/web/src/server-client/messageHandler.ts`**

```ts
import { isServerToClientMessage } from '@aspect/shared';
import { useConnectionStore } from '../store/connectionStore.js';

/**
 * Parses a raw socket payload and applies it to the store. Pure with respect
 * to the socket: safe to unit-test without a live connection. Silently
 * ignores anything that is not a recognized server message.
 */
export function handleRawMessage(raw: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isServerToClientMessage(parsed)) return;
  useConnectionStore.getState().applyStatus(parsed.status, parsed.haConnected);
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `pnpm --filter @aspect/web test:run messageHandler`
Expected: PASS (3 tests).

- [ ] **Step 11: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): add connection store and pure message handler"
```

---

## Task 8: Socket transport and App UI with Motion

**Files:**
- Create: `apps/web/src/server-client/socket.ts`
- Create: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Implement `apps/web/src/server-client/socket.ts`**

```ts
import { handleRawMessage } from './messageHandler.js';
import { useConnectionStore } from '../store/connectionStore.js';

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 10_000;

/**
 * Maintains a resilient WebSocket to the Aspect server. Reconnects with
 * exponential backoff and routes every payload through handleRawMessage.
 * Returns a disposer that closes the socket and stops reconnecting.
 */
export function connectToServer(url?: string): () => void {
  const target = url ?? defaultUrl();
  let socket: WebSocket | null = null;
  let backoff = INITIAL_BACKOFF_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const open = (): void => {
    useConnectionStore.getState().setLink('connecting');
    socket = new WebSocket(target);

    socket.onopen = () => {
      backoff = INITIAL_BACKOFF_MS;
      useConnectionStore.getState().setLink('connected');
    };
    socket.onmessage = (event) => handleRawMessage(String(event.data));
    socket.onclose = () => {
      useConnectionStore.getState().setLink('disconnected');
      if (!disposed) scheduleReconnect();
    };
    socket.onerror = () => socket?.close();
  };

  const scheduleReconnect = (): void => {
    timer = setTimeout(open, backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
  };

  open();

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    socket?.close();
  };
}

function defaultUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}
```

- [ ] **Step 2: Write the failing smoke test `apps/web/src/App.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App.js';
import { useConnectionStore } from './store/connectionStore.js';

// The App opens a socket on mount; stub it so jsdom doesn't try to connect.
vi.mock('./server-client/socket.js', () => ({
  connectToServer: () => () => undefined,
}));

describe('App', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      link: 'disconnected',
      serverStatus: null,
      haConnected: false,
    });
  });

  it('shows a connecting state before any status arrives', () => {
    render(<App />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('shows the server status once received', () => {
    render(<App />);
    useConnectionStore.getState().setLink('connected');
    useConnectionStore.getState().applyStatus('online', true);
    expect(screen.getByText(/online/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @aspect/web test:run App`
Expected: FAIL — `./App.js` not found.

- [ ] **Step 4: Implement `apps/web/src/App.tsx`**

```tsx
import { useEffect, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { connectToServer } from './server-client/socket.js';
import { useConnectionStore } from './store/connectionStore.js';

export function App(): ReactElement {
  const link = useConnectionStore((s) => s.link);
  const serverStatus = useConnectionStore((s) => s.serverStatus);
  const haConnected = useConnectionStore((s) => s.haConnected);

  useEffect(() => connectToServer(), []);

  const label =
    link !== 'connected' || serverStatus === null
      ? 'Connecting…'
      : `Server ${serverStatus}`;

  const accent =
    serverStatus === 'online'
      ? '#3ddc84'
      : serverStatus === 'degraded'
        ? '#ffb84d'
        : '#8a8a93';

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#16161a',
        color: '#f3f3f5',
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 22px',
            borderRadius: 999,
            background: '#1f1f25',
            border: '1px solid #2a2a31',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          <motion.span
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: accent,
            }}
          />
          {label}
          {haConnected ? ' · HA linked' : ''}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @aspect/web test:run App`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full web test suite and typecheck**

Run: `pnpm --filter @aspect/web test:run && pnpm --filter @aspect/web typecheck`
Expected: all tests pass; no type errors.

- [ ] **Step 7: Verify the production web build succeeds**

Run: `pnpm --filter @aspect/web build`
Expected: `apps/web/dist/` is produced including `manifest.webmanifest` and a service worker, no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): add resilient socket and animated status UI"
```

---

## Task 9: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Build the web app so the server can serve it**

Run: `pnpm --filter @aspect/web build`
Expected: `apps/web/dist/` exists.

- [ ] **Step 2: Start the server pointed at the web build**

Run (PowerShell): `$env:ASPECT_WEB_DIR="apps/web/dist"; node apps/server/dist/server.js`
(Bash: `ASPECT_WEB_DIR=apps/web/dist node apps/server/dist/server.js`)
Expected: logs `Aspect server listening on http://0.0.0.0:8099`.

- [ ] **Step 2b: If `apps/server/dist` is missing, build the server first**

Run: `pnpm --filter @aspect/server build`

- [ ] **Step 3: Open the app in a browser**

Open: `http://127.0.0.1:8099`
Expected: a dark screen with a pill that transitions from "Connecting…" to **"Server online"** with a pulsing green dot, confirming the client received a live status message over the WebSocket.

- [ ] **Step 4: Stop the server**

Stop the `node` process (Ctrl+C, or `kill` the PID).

- [ ] **Step 5: No commit** (verification only). If anything failed, fix in the relevant task before proceeding.

---

## Task 10: Continuous integration

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test:run
      - run: pnpm build
```

- [ ] **Step 2: Verify the same commands pass locally (what CI will run)**

Run: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test:run && pnpm build`
Expected: every step exits 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add typecheck, test and build workflow"
```

---

## Definition of Done

- [ ] `pnpm install` from a clean checkout succeeds.
- [ ] `pnpm typecheck` passes across all three packages.
- [ ] `pnpm test:run` passes (shared, server, web suites).
- [ ] `pnpm build` produces `apps/web/dist` and `apps/server/dist`.
- [ ] Running the built server with `ASPECT_WEB_DIR=apps/web/dist` serves the PWA at `http://127.0.0.1:8099`, and the UI shows "Server online" after connecting over the WebSocket (Task 9).
- [ ] CI workflow is present and green.

## Notes for the Next Plan (Plan 2)

- The `StatusHub` in `apps/server/src/ws/statusChannel.ts` currently emits a synthetic `online`/`haConnected:false` status. Plan 2 replaces the source of truth with the real Home Assistant connection: a `HaConnection` module (built on `home-assistant-js-websocket`) drives `statusHub.setStatus(...)` from real connect/disconnect events, plus a wire-accurate mock HA WebSocket server for tests.
- The `ClientToServerMessage`/`HelloMessage` contract is defined in shared but not yet exchanged; Plan 2/3 will use it for client identification and subscriptions.
```
