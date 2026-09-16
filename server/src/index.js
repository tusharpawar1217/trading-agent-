import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import marketDataRoutes from './routes/marketData.js';
import signalRoutes from './routes/signals.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/market-data', marketDataRoutes);
app.use('/api/signals', signalRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`FX Desk API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Check for API keys
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY not set - LLM commentary will be unavailable');
    console.warn('   Get your free API key at: https://makersuite.google.com/app/apikey');
  }
});
