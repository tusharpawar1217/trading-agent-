import { useState, useEffect } from 'react';
import { TrendingUp, Activity, BarChart3 } from 'lucide-react';
import PairSelector from './components/PairSelector';
import ChartView from './components/ChartView';
import IndicatorPanel from './components/IndicatorPanel';
import SignalGenerator from './components/SignalGenerator';
import SignalCard from './components/SignalCard';
import PositionsView from './components/PositionsView';
import { fetchAvailablePairs, fetchHistoricalData } from './services/api';
import { createPosition } from './services/tradingService';
import { saveSignal, savePosition } from './services/storageService';

function App() {
  const [pairs, setPairs] = useState([]);
  const [selectedPair, setSelectedPair] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis', 'trading', 'positions'
  const [currentSignal, setCurrentSignal] = useState(null);
  const [currentPrices, setCurrentPrices] = useState({});

  // Load available pairs on mount
  useEffect(() => {
    loadPairs();
  }, []);

  // Load market data when pair changes
  useEffect(() => {
    if (selectedPair) {
      loadMarketData(selectedPair);
    }
  }, [selectedPair]);

  const loadPairs = async () => {
    try {
      const data = await fetchAvailablePairs();
      setPairs(data);
      if (data.length > 0) {
        setSelectedPair(data[0].symbol);
      }
    } catch (err) {
      setError('Failed to load currency pairs: ' + err.message);
    }
  };

  const loadMarketData = async (pair) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchHistoricalData(pair, 90);
      setMarketData(data);
      
      // Update current price for this pair
      if (data.data && data.data.length > 0) {
        const latestCandle = data.data[data.data.length - 1];
        setCurrentPrices(prev => ({
          ...prev,
          [pair]: latestCandle.close
        }));
      }
    } catch (err) {
      setError('Failed to load market data: ' + err.message);
      setMarketData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSignalGenerated = (signalData) => {
    setCurrentSignal(signalData);
    setActiveTab('trading');
  };

  const handleApproveSignal = (signal) => {
    try {
      // Create paper position
      const position = createPosition({
        pair: signal.pair,
        direction: signal.verdict,
        entryPrice: signal.suggestedLevels.entry,
        stopLoss: signal.suggestedLevels.stopLoss,
        takeProfit: signal.suggestedLevels.takeProfit,
        size: 10000, // Default position size
        signal: signal,
        notes: `Auto-generated from signal (confidence: ${signal.confidence.toFixed(0)}%)`
      });

      // Save to storage
      savePosition(position);
      saveSignal(signal, 'approved', position);

      // Clear current signal and switch to positions view
      setCurrentSignal(null);
      setActiveTab('positions');
      
      alert(`Paper position opened: ${signal.verdict} ${signal.pair}`);
    } catch (err) {
      alert('Error opening position: ' + err.message);
    }
  };

  const handleDismissSignal = (signal) => {
    // Save as dismissed
    saveSignal(signal, 'dismissed');
    setCurrentSignal(null);
    alert('Signal dismissed and logged');
  };

  return (
    <div className="container">
      <header style={{ 
        padding: '2rem 0', 
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '2rem' 
      }}>
        <div className="flex-between">
          <div className="flex" style={{ alignItems: 'center' }}>
            <TrendingUp size={32} color="var(--accent-blue)" />
            <div style={{ marginLeft: '1rem' }}>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                FX Desk
              </h1>
              <p className="text-muted">
                Local-first forex trading dashboard • Paper trading only
              </p>
            </div>
          </div>
          <div className="badge badge-blue">Phase 2: Signal Agent</div>
        </div>
      </header>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <PairSelector
        pairs={pairs}
        selectedPair={selectedPair}
        onPairChange={setSelectedPair}
      />

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '0.5rem'
      }}>
        <button
          className={`btn ${activeTab === 'analysis' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('analysis')}
        >
          <BarChart3 size={16} />
          Market Analysis
        </button>
        <button
          className={`btn ${activeTab === 'trading' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('trading')}
        >
          <Activity size={16} />
          Signal Generation
        </button>
        <button
          className={`btn ${activeTab === 'positions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('positions')}
        >
          <TrendingUp size={16} />
          Paper Positions
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'analysis' && (
        <>
          {loading && (
            <div className="loading">
              Loading market data...
            </div>
          )}

          {!loading && marketData && (
            <>
              <ChartView marketData={marketData} />
              <IndicatorPanel marketData={marketData} />
            </>
          )}

          {!loading && !marketData && selectedPair && (
            <div className="card">
              <p className="text-muted">No data available</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'trading' && (
        <>
          <SignalGenerator
            pair={selectedPair}
            onSignalGenerated={handleSignalGenerated}
          />

          {currentSignal && (
            <SignalCard
              signalData={currentSignal}
              onApprove={handleApproveSignal}
              onDismiss={handleDismissSignal}
            />
          )}
        </>
      )}

      {activeTab === 'positions' && (
        <PositionsView currentPrices={currentPrices} />
      )}
    </div>
  );
}

export default App;
