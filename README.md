# Waymark

Waymark is a realtime group trip planner that brings itinerary planning and shared expenses into one workspace.

Plan the trip together on a freeform canvas, organize it day by day, collect places and activities, and track shared costs with Tricount-style balances and settlement suggestions.

> Waymark is in early development. The repository currently contains the project scaffold; the product features below describe the planned MVP.

## Product Direction

Waymark is designed for groups planning a trip together, not for one person building an itinerary and sending it around afterward.

The first version will combine:

- A freeform planning canvas for ideas and arrangements
- A day-by-day itinerary timeline
- Places and activities with map links
- Shared trip participants
- Live board updates and online presence
- Activity history showing what changed
- Equal and custom expense splits
- Per-person balances
- Minimized settlement suggestions

The product goal is simple:

> Plan the trip together. Track the money automatically.

The agreed domain rules are documented in [`docs/domain-model.md`](docs/domain-model.md). That document defines ownership, guest identity, invite lifecycle, shared editing, expense calculations, settlement state, activity history, and persistent versus realtime state.

## MVP Scope

### Trip Workspace

- Create a trip with a name, destination, dates, and timezone
- Invite people with a shareable link
- Join with a lightweight guest identity
- View trip members and their participation status
- Edit shared trip content without manually refreshing

### Planning

- Add draggable planning cards to a freeform canvas
- Record ideas, places, activities, bookings, and notes
- Organize confirmed plans into a day-by-day timeline
- Attach map links and useful external URLs
- Move items between the canvas and itinerary

### Expenses

- Add an expense with a description, amount, payer, and participants
- Split an expense equally
- Split an expense using custom shares
- Show each participant's current balance
- Calculate a small set of suggested settlements
- Keep expense calculations transparent and inspectable

### Collaboration

- Show who is currently online
- Broadcast shared edits in realtime
- Record an activity history for important changes
- Reconnect clients and recover the latest trip state

## Deliberately Out Of Scope

The following are not part of the first milestone:

- Payment processing or bank integrations
- Chat and reactions
- Receipt OCR
- Recurring expenses
- Advanced foreign-exchange workflows
- General-purpose project boards
- Multiple board templates
- A full social network

These may become useful later, but the first release should prove the core trip-planning and expense-sharing loop first.

## Technology

Waymark currently uses the Better-T-Stack scaffold:

- TypeScript
- SvelteKit
- Tailwind CSS
- oRPC for type-safe APIs and OpenAPI integration
- Drizzle ORM
- PostgreSQL
- Better Auth
- pnpm workspaces
- Turborepo

The planned realtime layer will support shared trip state, presence, reconnection, and conflict-safe updates. The exact transport and state model will be documented as the implementation develops.

## Repository Structure

```text
waymark/
├── apps/
│   └── web/         # SvelteKit web application
├── packages/
│   ├── api/         # API routes and business logic
│   ├── auth/        # Authentication configuration
│   ├── db/          # Database schema and queries
│   ├── env/         # Environment validation
│   └── config/      # Shared tooling configuration
├── docs/
│   └── domain-model.md # Product entities and MVP invariants
└── README.md
```

## Getting Started

### Requirements

- Node.js 20 or newer
- pnpm 10 or newer
- PostgreSQL

### Install

```bash
pnpm install
```

### Configure the database

Create or update the environment file used by the web application with a PostgreSQL connection string. The exact environment variables may change while the product foundation is being implemented.

Then apply the current schema:

```bash
pnpm run db:push
```

### Start development

Run the full workspace:

```bash
pnpm run dev
```

Or run only the web application:

```bash
pnpm run dev:web
```

Open [http://localhost:5173](http://localhost:5173).

## Useful Commands

```bash
pnpm run dev           # Start all development applications
pnpm run dev:web       # Start only the web application
pnpm run build         # Build all applications
pnpm run check-types   # Check TypeScript types
pnpm run db:push       # Push schema changes to PostgreSQL
pnpm run db:generate   # Generate database migrations
pnpm run db:migrate    # Run database migrations
pnpm run db:studio     # Open Drizzle Studio
pnpm run db:start      # Start the local database service, if configured
pnpm run db:stop       # Stop the local database service, if configured
```

## Development Principles

- Keep trip state understandable and recoverable.
- Treat expense calculations as explicit domain logic, not UI-only arithmetic.
- Make realtime updates safe to retry and resilient to reconnects.
- Keep guest access limited to the trip they were invited to.
- Avoid adding payments, chat, or unrelated collaboration features before the MVP loop works.
- Prefer small, testable domain functions for splitting and settlement calculations.

## Roadmap

The initial implementation sequence is:

1. Product foundation and database schema
2. Authentication, trip creation, and invite links
3. Trip membership and access control
4. Canvas cards and shared realtime state
5. Timeline, places, and map links
6. Expense splitting and balances
7. Settlement minimization
8. Presence and activity history
9. Mobile polish, testing, and deployment

## Status

Waymark is currently at the scaffold stage. Product and architecture decisions are being shaped before the first feature milestone is implemented.

## License

License details will be added once the project's distribution model is decided.
