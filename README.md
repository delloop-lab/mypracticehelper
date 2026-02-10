# My Practice Helper

A comprehensive practice management application for therapists, featuring client management, scheduling, voice notes, session documentation, and revenue tracking.

## Features

- 📋 **Client Management** - Track client information, sessions, and history
- 🎙️ **Voice Notes** - Record and transcribe session notes with AI assistance
- 📅 **Scheduling** - Manage appointments and sessions
- ⏰ **Reminders** - Never miss important follow-ups
- 📝 **Session Notes** - HIPAA-compliant documentation
- 💰 **Revenue Tracking** - Monitor payments and fees collected
- 📄 **Document Management** - Secure document storage
- 💾 **Backup & Restore** - Complete data backup functionality

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4, Framer Motion
- **UI Components**: Radix UI
- **Backend**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Version Control**: GitHub

## Getting Started

### Prerequisites

- Node.js 20+ installed
- Supabase account
- GitHub account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/my-practice-helper.git
cd my-practice-helper
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

See the [deployment workflow](.agent/workflows/deploy-online.md) for detailed instructions on deploying to production.

Quick steps:
1. Set up Supabase database
2. Push code to GitHub
3. Deploy to Vercel
4. Configure environment variables

## Database Setup

Run the SQL schema in your Supabase project (found in the deployment workflow) to create all necessary tables:
- clients
- sessions
- session_notes
- recordings
- payments
- reminders

## Key Documentation

- **[Recordings: Data Integrity Rules](RECORDINGS_DATA_INTEGRITY.md)** — Must-read for anyone working on audio recordings.

## Security & Compliance

- HIPAA-compliant data handling
- Row Level Security (RLS) enabled
- Secure authentication
- Encrypted data transmission

## License

Private - All rights reserved

## Support

For issues or questions, please contact the development team.
