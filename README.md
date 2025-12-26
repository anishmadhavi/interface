# Interface - WhatsApp Business Platforms

A multi-tenant SaaS platform for managing WhatsApp Business communications.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **Storage:** Cloudflare R2
- **Hosting:** Cloudflare Pages
- **Payments:** Cashfree

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- Cloudflare account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/anishmadhavi/interface.git
cd interface
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env.local
```

4. Update `.env.local` with your credentials (see below)

5. Run development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

### Required for Phase 1

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get these from: Supabase Dashboard → Settings → API

## Project Structure

```
interface/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui components
│   │   └── common/      # Shared components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility libraries
│   │   ├── supabase/    # Supabase clients
│   │   └── utils.ts     # Helper functions
│   ├── types/           # TypeScript types
│   └── constants/       # App constants
├── supabase/
│   └── migrations/      # Database migrations
└── public/              # Static assets
```

## Development Phases

- [x] Phase 1: Foundation (Project setup, Auth, Dashboard)
- [ ] Phase 2: Core Messaging (WhatsApp API, Inbox)
- [ ] Phase 3: Templates & Campaigns
- [ ] Phase 4: Billing & Payments
- [ ] Phase 5: Integrations
- [ ] Phase 6: Analytics & Polish

## License

Proprietary - TechSoftwares
