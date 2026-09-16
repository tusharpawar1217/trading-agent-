import { TrendingUp } from 'lucide-react';

function PairSelector({ pairs, selectedPair, onPairChange }) {
  return (
    <div className="card">
      <div className="flex-between">
        <div>
          <h2 className="card-title">Currency Pair</h2>
          <p className="text-muted">Select a forex pair to analyze</p>
        </div>
        
        <select 
          className="select" 
          value={selectedPair || ''} 
          onChange={(e) => onPairChange(e.target.value)}
        >
          {pairs.map(pair => (
            <option key={pair.symbol} value={pair.symbol}>
              {pair.symbol} - {pair.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default PairSelector;
