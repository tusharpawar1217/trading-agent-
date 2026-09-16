import { useState } from 'react';
import { TrendingUp, RefreshCw, Sparkles } from 'lucide-react';
import { generateSignal } from '../services/api';

function SignalGenerator({ pair, onSignalGenerated }) {
  const [loading, setLoading] = useState(false);
  const [includeLLM, setIncludeLLM] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerateSignal = async () => {
    if (!pair) {
      setError('Please select a currency pair first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await generateSignal(pair, includeLLM);
      onSignalGenerated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="flex-between mb-2">
        <div>
          <h2 className="card-title">Signal Generation</h2>
          <p className="text-muted">Generate rule-based trading signal for {pair || 'selected pair'}</p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleGenerateSignal}
          disabled={loading || !pair}
        >
          <RefreshCw size={16} />
          {loading ? 'Generating...' : 'Generate Signal'}
        </button>
      </div>

      <div className="flex" style={{ alignItems: 'center', marginTop: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeLLM}
            onChange={(e) => setIncludeLLM(e.target.checked)}
          />
          <Sparkles size={16} color="var(--accent-blue)" />
          <span>Include LLM commentary (optional, slower)</span>
        </label>
      </div>

      {error && (
        <div className="error" style={{ marginTop: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        background: 'rgba(245, 158, 11, 0.1)',
        borderRadius: '6px',
        border: '1px solid var(--accent-yellow)',
      }}>
        <p className="text-small" style={{ color: 'var(--accent-yellow)' }}>
          <strong>Paper Trading Only:</strong> This signal generation is for testing and learning.
          No real money is involved. All positions are simulated.
        </p>
      </div>
    </div>
  );
}

export default SignalGenerator;
