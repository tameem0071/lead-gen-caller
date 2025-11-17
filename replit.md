# Lead Generation & Outbound Calling System

## Overview

A lightweight B2B lead generation and automated outbound calling system that captures business leads through a web chat widget and places AI-assisted introductory phone calls via Twilio. The system consists of a public-facing lead capture form and an admin dashboard for monitoring leads and call sessions.

**Core Functionality:**
- Lead capture through a multi-step web form (business name, contact, phone, product category, brand)
- Automatic outbound call initiation via Twilio after lead submission
- Real-time call session monitoring with status tracking (INTRO, DIALING, COMPLETED, FAILED)
- Admin dashboard for viewing all leads and call sessions
- Rate limiting to prevent duplicate calls (1-minute cooldown per phone number)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
**Framework:** React with TypeScript using Vite as the build tool

**UI Component System:** shadcn/ui components built on Radix UI primitives
- Component library configuration in `components.json` with New York style variant
- Tailwind CSS for styling with custom design system (see `design_guidelines.md`)
- System-based design approach prioritizing clarity and professional trust over decoration
- Typography: Inter font family with specific size/weight hierarchy
- Spacing system: Strict Tailwind units (2, 4, 6, 8, 12, 16)

**State Management:** 
- TanStack Query (React Query) for server state management and API caching
- Query client configured with infinite stale time and no automatic refetching
- Local React state with `react-hook-form` for form management

**Routing:** Wouter for lightweight client-side routing
- `/` - Lead generation form (public)
- `/admin` - Admin dashboard (no authentication currently implemented)
- `/404` - Not found page

**Form Validation:** Zod schemas shared between client and server via `@shared/schema`
- E.164 phone number format validation
- Field-level validation with `@hookform/resolvers`

### Backend Architecture
**Framework:** Express.js with TypeScript running on Node.js

**API Design:** RESTful endpoints under `/api` prefix
- `POST /api/leads` - Create lead and auto-trigger call
- `GET /api/leads` - List all leads
- `POST /api/call/start` - Create call session
- `POST /api/call/:callId/dial` - Manually dial a call
- `GET /api/calls` - List all call sessions
- `GET /api/call/:id/status` - Get specific call session status

**Data Storage Strategy:**
- Interface-based storage layer (`IStorage`) for future database swap
- Current implementation: In-memory storage (`MemStorage`) using Maps
- Designed for easy migration to PostgreSQL with Drizzle ORM (schema already defined)
- Schema includes UUID primary keys, timestamps, and proper relationships

**Call Session State Machine:**
- INTRO → DIALING → COMPLETED/FAILED
- State transitions managed through `updateCallSession` method
- Twilio call SID and status tracked for integration

**Middleware & Logging:**
- JSON body parsing with raw buffer access (for potential webhook signature verification)
- Request/response logging with duration tracking
- Automatic truncation of long log lines (80 char max)
- Comprehensive startup logging for deployment diagnostics
- Health check endpoints at `/health` and `/` for platform monitoring

**Deployment Configuration:**
- Server binds to `0.0.0.0:5000` with port reuse enabled
- Health check endpoint at `/health` returns status, timestamp, and uptime
- Comprehensive error handling in async initialization with process exit on failure
- Detailed startup logging for diagnosing deployment issues
- **Platform Support:** Code works on both Replit and external hosting (Render, Fly.io, Railway)
  - Environment detection: Uses `RENDER_EXTERNAL_HOSTNAME` or `REPLIT_DEV_DOMAIN`
  - Twilio credential fallback: Replit Connectors → Environment variables
- **Production Deployment Recommendation:** Render.com or similar WebSocket-friendly platform
  - **Known Issue:** Replit's infrastructure closes external server-to-server WebSocket connections
  - Twilio ConversationRelay requires persistent WebSockets for entire call duration (minutes)
  - Render.com provides proper WebSocket support and free tier
  - See `RENDER_DEPLOYMENT_GUIDE.md` for complete deployment instructions
  - `render.yaml` included for one-click deployment

### Data Schema (Drizzle ORM)

**Tables:**
- `leads` - Business lead information
  - UUID primary key
  - Business details (name, contact, phone, product category, brand)
  - Source tracking (defaults to "web_widget")
  - Created timestamp

- `callSessions` - Call tracking and transcript storage
  - UUID primary key
  - Foreign key to lead
  - Business context (duplicated from lead for denormalization)
  - State machine field (INTRO/DIALING/COMPLETED/FAILED)
  - Transcript array for conversation history
  - Captured data field for structured information
  - Twilio integration fields (SID, status)
  - Created/updated timestamps

**Validation:**
- E.164 phone number format required (+12345678900)
- Required fields: businessName, productCategory, brandName
- Optional: contactName, captured data

### External Dependencies

**Twilio Integration:**
- Voice API for outbound calling via ConversationRelay
- ElevenLabs ultra-realistic voice synthesis (Adam - professional male)
- TwiML generation with ConversationRelay configuration
- WebSocket-based real-time conversation handling
- Credential management via Replit Connectors API
- Dynamic credential fetching (account SID, API key, API secret, phone number)
- Authentication: API key-based (not account SID + auth token)

**Voice System (ElevenLabs + ConversationRelay):**
- **Architecture:** Twilio ConversationRelay → WebSocket → GPT-4 → ElevenLabs TTS
- **Voice Quality:** ElevenLabs "Adam" voice (voice ID: `pNInz6obpgDQGcFmaJgB`)
- **Speech Synthesis:** Ultra-realistic generative AI voice (75ms latency)
- **AI Model:** GPT-4o for intelligent conversation (temperature 1.0, max 100 tokens)
- **Conversation Style:** "Alex" personality - casual, friendly, brief responses
- **WebSocket Protocol:** Handles `setup`, `prompt`, `interrupt`, `dtmf`, `error`, `stop` events
- **Response Format:** `{ token: "...", last: true }` for Twilio ConversationRelay
- **Endpoints:**
  - `POST /voice/twiml` - TwiML endpoint with ConversationRelay configuration
  - `WebSocket /voice/relay` - Real-time conversation handler
- **No SSML Required:** Plain text responses automatically converted to natural speech

**Replit Platform Services:**
- Connector system for secure credential storage (Twilio)
- Identity token (`REPL_IDENTITY`) or renewal token (`WEB_REPL_RENEWAL`) for authentication
- Environment variable-based configuration (`DATABASE_URL`, `REPLIT_CONNECTORS_HOSTNAME`)
- Development tooling: Vite plugins for error overlay, cartographer, dev banner

**Database (Configured but not connected):**
- Drizzle ORM with PostgreSQL dialect
- Neon Database serverless driver (`@neondatabase/serverless`)
- Migration directory: `./migrations`
- Schema file: `./shared/schema.ts`
- Connection via `DATABASE_URL` environment variable

**Third-Party Libraries:**
- UI: Radix UI component primitives, Tailwind CSS, class-variance-authority
- Forms: react-hook-form, @hookform/resolvers, zod
- Date handling: date-fns
- API: express, twilio SDK
- Development: tsx for TypeScript execution, esbuild for production builds

**Build & Deployment:**
- Development: `tsx` for hot-reload TypeScript execution
- Production build: Vite for frontend, esbuild for backend bundling
- Static assets served from `dist/public`
- Single compiled backend file: `dist/index.js`
- ESM module format throughout