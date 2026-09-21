# ChatGem / NURJAHON AI

Modern AI chat app (ChatGPT-style) built with **Next.js App Router**, TypeScript, and Tailwind CSS.

## Features

- Streaming chat UI (`/app/chat`) with dark / light theme
- Markdown + GFM tables + syntax-highlighted code blocks + copy buttons
- Typing indicator while the model streams
- Conversations with unique IDs, New Chat, sidebar history
- Guest chat without an account (`nj_guest_id` cookie)
- Auth (email + Google/GitHub OAuth when configured)
- API keys stay **server-side only** (never in the browser)

## Storage (important)

**Runtime data today uses local JSON files** under `.data/` (chats, messages, users, projects, … via `src/lib/local-store.ts`).

Prisma schema (`prisma/schema.prisma`) models `User`, `Conversation`/`Chat`, and `Message` for a future PostgreSQL migration. Until you wire Prisma into the repositories, **you do not need a live database** to run chat.

## Install

```bash
npm install
cp .env.example .env
```

## Environment variables

Edit `.env` and set at least one AI provider:

```env
# Required for live AI replies (pick one or more)
OPENAI_API_KEY=sk-...
# or
GROQ_API_KEY=gsk_...

AUTH_SECRET=generate-a-long-random-string
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
```

Optional: OAuth, Stripe, web search — see `.env.example`.

Never commit `.env`. Keys must not appear in frontend code.

## Database (optional / future)

```bash
# Generate Prisma client (safe even if DATABASE_URL is empty)
npm run db:generate

# When you are ready for PostgreSQL:
# 1) Set DATABASE_URL in .env
# 2) npm run db:push
# 3) Migrate repositories from local-store → Prisma (not done by default)
```

Until then, chat history is stored in `.data/*.json`. Keep `.data/` out of git.

## Run (development)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Start free** or go to `/app/chat`.

Google Sign-In: use a normal browser (Chrome/Edge), not Cursor Simple Browser.

## Production build

```bash
npm run build
npm start
```

Or use the included Docker setup if present.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Chat UX notes

- **Enter** — send message  
- **Shift+Enter** — new line  
- Send is disabled / stop while streaming  
- Auto-scroll to the latest message  
- Theme toggle in the chat header and sidebar  

## Project layout (high level)

```
src/app/api/chat/     SSE chat endpoint (keys server-side)
src/features/chat/    Chat UI, markdown, hooks
src/lib/local-store.ts  JSON persistence (.data/)
prisma/schema.prisma  Future relational schema
```
