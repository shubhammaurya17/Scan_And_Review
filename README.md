# ReputeAI

AI-powered customer feedback and Google review assistance platform for local businesses.

## Quick Start

```bash
npm install
npm run db:setup
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001
- Demo business: http://localhost:5173/review/bellas-kitchen

## Demo Credentials

- **Admin:** admin@reputeai.com / admin123
- **Business Owner:** demo@reputeai.com / demo123

## Architecture

- `shared/` — TypeScript types and constants
- `server/` — Express.js API with Prisma ORM
- `client/` — React + Vite + Tailwind + shadcn/ui

## Environment

Copy `.env.example` to `server/.env` and configure as needed.
