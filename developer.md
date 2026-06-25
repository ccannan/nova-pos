# POS Developer Context

## Project Overview

A modern point-of-sale and CRM system for jewellery retail to replace an existing WinForms application. This is a greenfield MVP targeting **weeks, not months** of development time for after-hours work sessions.

## Domain & Business Context

### Target Users
- Jewellery sales staff at retail counter
- Single-store (MVP) expanding to multi-store (post-MVP)
- Users expect modern, fast, intuitive interface — departure from dated WinForms

### MVP Scope (Deliberately Limited)
- **Customer management**: Create, Read, Update (no Delete)
- **Item management**: Create, Read, Update (no Delete)  
- **Sales processing**: Create + Read (cash payment only)
- **Receipt printing**: Basic text receipt
- **Reporting**: Sales by date range

### Explicitly Excluded from MVP
- Offline sync (architecture ready, implementation post-MVP)
- Multi-store management
- Card/EFTPOS payments
- Layby/deposits
- Repair jobs/quotes
- Inventory adjustments
- User authentication/roles
- Tax codes/GST configuration

## Technical Architecture

### Technology Stack
- **Frontend**: React + Tailwind CSS (Vite dev server)
- **Backend**: Node.js + Express (REST API)
- **Database**: SQL Server (`NovaPOS` database)
- **Driver**: `mssql` Node.js package
- **Authentication**: `Trusted_Connection=True` for local dev
- **Testing**: Jest + Supertest (backend), React Testing Library (frontend)

### Project Structure
```
c:\repos\pos\
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page views (Sale, Customers, Items, Reports)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API client (fetch to Express)
│   │   └── App.jsx
├── server/                     # Express backend
│   ├── src/
│   │   ├── routes/             # Express route handlers
│   │   ├── controllers/        # Business logic
│   │   ├── models/             # Database access layer
│   │   ├── db/                 # Connection pool, schema scripts
│   │   ├── printing/           # Receipt generation
│   │   └── mapping/            # Legacy DB adapter (future)
├── database/
│   └── migrations/             # SQL Server schema scripts
└── tests/                      # Test suites (already written)
```

## Data Architecture Fundamentals

### Database Design Principles
1. **Own-data-first**: `NovaPOS` database completely separate from legacy `EdgeWalkerHall`
2. **Design vs Instance separation**: `Item` = design template, `InventoryItem` = physical instance
3. **Offline-ready**: Audit fields (`CreatedAt`, `UpdatedAt`, `IsDeleted`) on all tables
4. **UUID primary keys**: `uniqueidentifier` with `NEWSEQUENTIALID()` for future sync
5. **Store-aware**: Core entities tagged with `StoreId`
6. **Soft delete**: `IsDeleted` bit on transactional data, `IsActive` on lookup tables

### Core Entities
- **Customer**: Contact and preference information
- **Supplier**: Jewellery suppliers and brands
- **Category**: Product categorization
- **Item**: Product design templates (Supplier + DesignNo + attributes)
- **InventoryItem**: Physical inventory instances of Items
- **Sale**: Transaction header with customer and totals
- **SaleLine**: Individual items sold within a Sale
- **SaleTender**: Payment information (separate from sale lines)

### Key Business Rules
- Stock count = `COUNT(InventoryItem WHERE StatusId = 'Available')`
- Prices stored in cents (integers) to avoid floating point issues
- All timestamps in UTC using `GETUTCDATE()`
- History tracking for Item and InventoryItem changes
- Legacy mapping via nullable `LegacyKey` columns

## Development Workflow

### Test-Driven Development
All tests are already written by the Tester agents:
- Backend tests: Jest + Supertest (API endpoints, database operations)
- Frontend tests: React Testing Library (component behavior, user interactions)

### Development Order (from dependency analysis)
**Wave 1 - Foundation:**
1. `db-schema` - Database creation and migration scripts
2. `express-bootstrap` - Server setup with middleware

**Wave 2 - Data Layer (7 parallel modules):**
- `customer-model`, `item-model`, `inventory-model`
- `sale-model`, `supplier-model`, `lookup-models`
- `database-utils`

**Wave 3 - API Layer (8 parallel modules):**
- Customer, Item, Inventory, Sale APIs
- Lookup APIs, Receipt generation
- Error handling, Database connection

**Waves 4-6**: Frontend components, integration, and final features

### Performance Requirements
- **Local operations < 50ms**: Item lookup, customer search, sale line entry
- **No spinners for local data**: Everything cached/local where possible
- **Sub-second feedback**: Hot reload for development iterations

## Database Connection

### Development Setup
- **Instance**: `localhost\SQLEXPRESS` (already installed)
- **Database**: `NovaPOS` (separate from existing `EdgeWalkerHall`)
- **Authentication**: Windows Integrated (`Trusted_Connection=True`)
- **Driver**: `mssql` package with connection pooling

### Connection String Pattern
```javascript
{
    server: 'localhost\\SQLEXPRESS',
    database: 'NovaPOS',
    options: {
        trustedConnection: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
}
```

## API Design Standards

### Request/Response Patterns
- **Success responses**: Appropriate 2xx status with JSON data
- **Error responses**: 4xx/5xx with `{ error: 'CODE', message: 'description', fields?: {} }`
- **Validation errors**: 400 with field-level details
- **Resource creation**: 201 with created resource
- **Resource updates**: 200 with updated resource

### Endpoint Conventions
- `GET /api/customers` - List with optional query filters
- `GET /api/customers/:id` - Get single resource
- `POST /api/customers` - Create new resource  
- `PUT /api/customers/:id` - Update existing resource
- No DELETE endpoints (soft delete only)

## Frontend Development Guidelines

### Component Architecture
- **Reusable components**: Button, Input, Modal, Table, etc.
- **Page components**: Sale, Customers, Items, Reports
- **Custom hooks**: API calls, local state management
- **Service layer**: API client functions

### State Management
- Component-level state with `useState`
- API state with custom hooks or React Query
- Global state via Context API if needed
- Form state management with controlled components

### User Experience Requirements
- **Responsive design**: Works on tablets and desktop
- **Intuitive navigation**: Clear page flow for sales staff
- **Fast interactions**: Optimistic updates where possible
- **Error handling**: User-friendly error messages
- **Loading states**: Minimal but clear when needed

## Security & Data Integrity

### Input Validation
- All API endpoints validate request data
- SQL queries use parameterization (never string concatenation)
- Client-side validation for user experience
- Server-side validation as source of truth

### Data Protection
- No user authentication in MVP (single-user system)
- SQL Server Windows auth for database access
- Audit trails via history tables
- Soft delete for data retention

## Integration Points

### Legacy Database (Post-MVP)
- `EdgeWalkerHall` database exists on same SQL Server instance
- Mapping layer will bridge schemas via `LegacyKey` columns
- No direct modification of legacy tables
- Read-only access for data migration/sync

### Receipt Printing
- Generate receipt text/HTML in Express
- Use Node.js printing library or shell command
- Target local default printer
- Simple text format for MVP

## Testing Integration

### Running Tests
- Backend: `npm run test:backend` (Jest + Supertest)
- Frontend: `npm run test:frontend` (React Testing Library)
- Full suite: `npm test`

### Test Database
- Dedicated test instance or separate test database
- Test data seeding through database utilities
- Clean up after each test run
- Tests must pass in parallel execution

## Development Success Criteria

### Backend Complete When:
- All backend tests pass
- Database schema matches specifications
- API endpoints return correct responses
- Error handling provides appropriate status codes
- Performance meets < 50ms local operation target

### Frontend Complete When:
- All frontend tests pass
- Component UI matches design specifications  
- User interactions work as tested
- API integration handles loading/error states
- Responsive design works on target devices

### Integration Complete When:
- Full user workflows function end-to-end
- Receipt printing works on development machine
- Performance targets met for all local operations
- Ready for deployment to target POS hardware

## Handoff Notes

This POS system is architected for rapid MVP delivery while maintaining extensibility for post-MVP features like offline sync, multi-store support, and payment integration. The separation of concerns between database design, API layer, and frontend components allows for parallel development once the foundation is established.