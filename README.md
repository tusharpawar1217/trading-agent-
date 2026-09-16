# FX Desk

A local-first forex trading dashboard for paper trading and signal analysis.

## ⚠️ Safety Constraints

- **NO REAL TRADING**: This application does not and cannot place real trades or move real money
- All execution paths require explicit human approval before any action is recorded
- API keys and credentials are server-side only (never in client code)
- All agent decisions are logged with full reasoning for audit trails

## Tech Stack

- **Frontend**: React + Vite, recharts for charts, lucide-react for icons
- **Backend**: Node.js + Express (holds secrets, proxies external APIs)
- **Storage**: localStorage (designed for easy migration to SQLite)
- **Deployment**: Docker Compose for local development

## Quick Start

### Using Docker (Recommended)

```bash
# Build and start all services
npm run docker:build
npm run docker:up

# Stop services
npm run docker:down
```

Access the dashboard at http://localhost:5173

### Local Development

```bash
# Install dependencies for all packages
npm run install:all

# Run both client and server in development mode
npm run dev

# Or run separately:
npm run dev:client  # Frontend on http://localhost:5173
npm run dev:server  # API on http://localhost:3001
```

### Running Tests

```bash
npm test
```

## Project Structure

```
fx-desk/
├── client/          # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
├── server/          # Express API
│   ├── src/
│   │   ├── adapters/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=3001
NODE_ENV=development

# Add API keys here (never in client code):
# ANTHROPIC_API_KEY=your_key_here
# OANDA_API_KEY=your_key_here
# OANDA_ACCOUNT_ID=your_account_here
```

## Development Phases

- [x] **Phase 1**: Market data & indicators
- [x] **Phase 2**: Signal agent (paper only)
- [ ] **Phase 3**: Trade journal & analytics
- [ ] **Phase 4**: Promotion gate
- [ ] **Phase 5**: Live execution scaffold

## Data Providers

### Current: Frankfurter API (ECB)
- Free, no API key required
- Daily close data for major FX pairs
- Base: EUR

### Future: Swap points for real intraday data
The market data service is designed with an adapter pattern to easily swap providers:
- OANDA v20 API (retail forex)
- Alpha Vantage
- Twelve Data
- Your broker's API

See `server/src/services/marketData.js` for the adapter interface.
