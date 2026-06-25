# Context & Scope — POS Architecture

## Project Overview

A modern point-of-sale and CRM system for jewellery retail. Replaces an existing WinForms application. Greenfield design, though data must be mappable to an existing legacy database schema.

## Business Context

**Domain**: Jewellery retail stores
- Single-store and multi-store businesses
- All data centralised eventually (inventory, customers, sales)
- Future requirement: offline resilience — a store can process sales while disconnected and sync when reconnected

**Users**: Jewellery sales staff at the counter. The UI must feel modern, fast, and intuitive — a clear departure from the dated WinForms experience.

## MVP Scope (Weeks, not months)

| Feature | Scope | Notes |
|---------|-------|-------|
| Customer management | CRU (no Delete) | Create, Read, Update |
| Item management | CRU (no Delete) | Products with jewellery-specific attributes |
| Sales processing | Create + Read | Sale + sale lines, cash payment only |
| Receipt printing | Basic text receipt | Cash payment receipt |
| Reporting | Sales by date range | Simple date-filtered report |

**Deliberate exclusions from MVP** (for later):
- Offline sync
- Multi-store management
- Card/EFTPOS payments
- Layby / deposits
- Repair jobs / quotes
- Inventory adjustments
- User authentication / roles
- Tax codes / GST configuration

## Architectural Principles

1. **Own-data-first**: The system owns its data model and schema. A mapping layer converts to/from the legacy database schema when needed. This decoupling means if the partnership with the legacy vendor ends, the POS runs independently with zero schema changes.

2. **Offline-ready by design**: The local data layer is architected from day one with sync primitives (change tracking, timestamps, soft deletes) even though the sync engine itself is post-MVP.

3. **Responsive first**: Every interaction (item lookup, customer search, sale line entry) must feel instant. No spinners for local operations. The UI targets <50ms feedback for all local operations.

4. **Developer velocity for after-hours work**: Choose technologies that maximise output per evening session. Familiar ecosystems (React, TypeScript, SQL) with modern tooling.

## Tech Stack (MVP)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | **React** (JavaScript) | Modern, responsive, huge ecosystem. User has existing React experience (Edge60 project). |
| Styling | **Tailwind CSS** | Rapid UI development, utility-first, consistent design. |
| Backend | **Node.js / Express** | Familiar ecosystem, simple REST API. Serves the React app and provides the REST API for CRUD operations. |
| API style | **REST over HTTP** | Simple, well-understood. Frontend fetches data from Express routes. |
| Database | **SQL Server** | Already installed at each location (MINISFORUM\SQLEXPRESS for dev). The existing `EdgeWalkerHall` database on this instance holds the legacy schema we must integrate with. |
| DB driver | **mssql** (Node.js) | Microsoft SQL Server driver for Node.js. Uses `Trusted_Connection=True` for local auth. |
| Receipt printing | **Express + OS print** | Render a receipt template to a print-friendly format, send to the local default printer via a Node.js print library or a simple shell command. |

### Why this stack

- **Familiar tools**: You already work with React and SQL Server daily. No ramp-up on Tauri, Rust, or SQLite.
- **Rapid iteration**: Node/Express + React hot-reload gives sub-second feedback. Perfect for after-hours sessions.
- **Local-first simplicity**: The Express server and SQL Server both run on localhost. No network latency, no auth ceremony for development.
- **SQL Server leverages existing infrastructure**: Each store already has SQL Server installed. The `EdgeWalkerHall` database is already on your dev machine — we can run both schemas side by side.

### Future considerations that don't affect the MVP

| Concern | Post-MVP plan |
|---------|--------------|
| Offline resilience | Add a local SQLite cache or service worker. The data layer will be designed with sync primitives (change tracking fields) from day one. |
| Multi-store centralisation | A central API + database. Each store's local Express instance pushes/pulls changes. |
| Barcode scanner hardware | USB scanners present as keyboard input to the browser — no special integration needed. |
| EFTPOS/Card payments | Integrate with a payment gateway API at the sale-processing layer. |

## Directory Structure

```
c:\repos\pos\
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page-level views (Sale, Customers, Items, Reports)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API client (fetch calls to Express)
│   │   └── App.jsx
│   ├── index.html
│   └── package.json
├── server/                  # Node.js / Express backend
│   ├── src/
│   │   ├── routes/          # Express route handlers
│   │   ├── controllers/     # Business logic
│   │   ├── models/          # Database access layer
│   │   ├── db/              # Connection pool, schema scripts
│   │   ├── printing/        # Receipt generation
│   │   └── mapping/         # Legacy DB schema adapter (future)
│   ├── package.json
│   └── .env                 # Connection string
├── database/
│   └── migrations/          # SQL Server schema migration scripts
├── docs/
│   ├── architecture/        # Architecture documents
│   └── inventory.md         # Code inventory
├── AGENTS.md
└── ARCHITECT.md
```

## Next Steps

Pass 2 — **Data Architecture**: Define the domain model, SQLite schema, and entity relationships for the MVP.

Shall I proceed to Pass 2 and define the data model?