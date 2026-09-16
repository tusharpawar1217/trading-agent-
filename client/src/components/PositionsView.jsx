import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, XCircle } from 'lucide-react';
import { getAllPositions, savePosition } from '../services/storageService';
import { updatePositionPnL, closePosition, checkExitConditions } from '../services/tradingService';

function PositionsView({ currentPrices }) {
  const [positions, setPositions] = useState([]);
  const [filter, setFilter] = useState('open'); // 'open', 'closed', 'all'

  useEffect(() => {
    loadPositions();
  }, []);

  // Update open positions with current prices
  useEffect(() => {
    if (currentPrices && Object.keys(currentPrices).length > 0) {
      updateOpenPositions();
    }
  }, [currentPrices]);

  const loadPositions = () => {
    const allPositions = getAllPositions();
    setPositions(allPositions);
  };

  const updateOpenPositions = () => {
    setPositions(prev => prev.map(pos => {
      if (pos.status === 'open' && currentPrices[pos.pair]) {
        const currentPrice = currentPrices[pos.pair];
        const updated = updatePositionPnL(pos, currentPrice);
        
        // Check if stop loss or take profit was hit
        const exitCondition = checkExitConditions(updated, currentPrice);
        if (exitCondition) {
          const closed = closePosition(updated, exitCondition.price, exitCondition.reason);
          savePosition(closed);
          return closed;
        }
        
        return updated;
      }
      return pos;
    }));
  };

  const handleClosePosition = (position) => {
    if (!currentPrices[position.pair]) {
      alert('Current price not available for this pair');
      return;
    }

    const currentPrice = currentPrices[position.pair];
    const closed = closePosition(position, currentPrice, 'manual');
    savePosition(closed);
    loadPositions();
  };

  const filteredPositions = positions.filter(p => {
    if (filter === 'open') return p.status === 'open';
    if (filter === 'closed') return p.status === 'closed';
    return true;
  });

  const openPositions = positions.filter(p => p.status === 'open');
  const closedPositions = positions.filter(p => p.status === 'closed');

  return (
    <div className="card">
      <div className="flex-between mb-2">
        <div>
          <h2 className="card-title">Paper Positions</h2>
          <p className="text-muted">
            {openPositions.length} open • {closedPositions.length} closed
          </p>
        </div>

        <div className="flex">
          {['open', 'closed', 'all'].map(f => (
            <button
              key={f}
              className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f)}
              style={{ marginLeft: '0.5rem' }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredPositions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          <p>No {filter} positions</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredPositions.map(position => (
            <PositionCard
              key={position.id}
              position={position}
              onClose={handleClosePosition}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PositionCard({ position, onClose }) {
  const isWinning = position.pnl.unrealized > 0 || position.pnl.realized > 0;
  const pnl = position.status === 'open' ? position.pnl.unrealized : position.pnl.realized;
  const pnlPips = position.pnl.pips;

  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: '8px',
      padding: '1rem',
      borderLeft: `4px solid ${position.direction === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)'}`
    }}>
      <div className="flex-between mb-1">
        <div className="flex" style={{ alignItems: 'center', gap: '0.5rem' }}>
          {position.direction === 'BUY' ? (
            <TrendingUp size={20} color="var(--accent-green)" />
          ) : (
            <TrendingDown size={20} color="var(--accent-red)" />
          )}
          <strong>{position.pair} {position.direction}</strong>
          <span className={`badge ${position.status === 'open' ? 'badge-blue' : 'badge-yellow'}`}>
            {position.status}
          </span>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
          }}>
            {pnl >= 0 ? '+' : ''}{pnl?.toFixed(2) || '0.00'} ({pnlPips >= 0 ? '+' : ''}{pnlPips.toFixed(1)} pips)
          </div>
          <div className="text-small text-muted">
            {position.status === 'open' ? 'Unrealized' : 'Realized'} P&L
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: '0.75rem', gap: '0.5rem' }}>
        <div>
          <div className="text-small text-muted">Entry</div>
          <div style={{ fontWeight: 600 }}>{position.entryPrice.toFixed(4)}</div>
        </div>
        
        {position.status === 'open' && position.currentPrice && (
          <div>
            <div className="text-small text-muted">Current</div>
            <div style={{ fontWeight: 600 }}>{position.currentPrice.toFixed(4)}</div>
          </div>
        )}
        
        {position.status === 'closed' && (
          <div>
            <div className="text-small text-muted">Exit</div>
            <div style={{ fontWeight: 600 }}>{position.exitPrice.toFixed(4)}</div>
          </div>
        )}

        <div>
          <div className="text-small text-muted">Stop Loss</div>
          <div style={{ fontWeight: 600, color: 'var(--accent-red)' }}>
            {position.stopLoss.toFixed(4)}
          </div>
        </div>

        <div>
          <div className="text-small text-muted">Take Profit</div>
          <div style={{ fontWeight: 600, color: 'var(--accent-green)' }}>
            {position.takeProfit.toFixed(4)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="text-small text-muted">
          Opened: {new Date(position.entryTime).toLocaleString()}
          {position.status === 'closed' && (
            <> • Closed: {new Date(position.exitTime).toLocaleString()} ({position.closeReason})</>
          )}
        </div>

        {position.status === 'open' && (
          <button
            className="btn btn-secondary"
            onClick={() => onClose(position)}
            style={{ padding: '0.25rem 0.75rem' }}
          >
            <XCircle size={14} />
            Close
          </button>
        )}
      </div>
    </div>
  );
}

export default PositionsView;
