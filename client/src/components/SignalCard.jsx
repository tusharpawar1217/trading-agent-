import { TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

function SignalCard({ signalData, onApprove, onDismiss }) {
  const { signal, commentary } = signalData;

  const verdictIcon = {
    BUY: <TrendingUp size={32} color="var(--accent-green)" />,
    SELL: <TrendingDown size={32} color="var(--accent-red)" />,
    HOLD: <Minus size={32} color="var(--text-secondary)" />
  };

  const verdictColor = {
    BUY: 'var(--accent-green)',
    SELL: 'var(--accent-red)',
    HOLD: 'var(--text-secondary)'
  };

  return (
    <div className="card">
      <div className="flex-between mb-2">
        <div className="flex" style={{ alignItems: 'center', gap: '1rem' }}>
          {verdictIcon[signal.verdict]}
          <div>
            <h2 className="card-title" style={{ color: verdictColor[signal.verdict] }}>
              {signal.verdict} Signal
            </h2>
            <p className="text-muted">{signal.pair} • Generated {new Date(signal.timestamp).toLocaleString()}</p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: verdictColor[signal.verdict] }}>
            {signal.confidence.toFixed(0)}%
          </div>
          <p className="text-small text-muted">Confidence</p>
        </div>
      </div>

      <div className="grid grid-2 mb-2">
        <div style={{ 
          background: 'var(--bg-tertiary)', 
          padding: '1rem', 
          borderRadius: '6px' 
        }}>
          <div className="text-muted text-small">Score</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {signal.score > 0 ? '+' : ''}{signal.score}
          </div>
        </div>

        <div style={{ 
          background: 'var(--bg-tertiary)', 
          padding: '1rem', 
          borderRadius: '6px' 
        }}>
          <div className="text-muted text-small">Current Price</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {signal.marketData.currentPrice.toFixed(4)}
          </div>
        </div>
      </div>

      {/* Rules that fired */}
      <div className="mb-2">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          Rules Triggered ({signal.reasons.length})
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {signal.reasons.map((reason, index) => (
            <div
              key={index}
              style={{
                background: 'var(--bg-tertiary)',
                padding: '0.75rem',
                borderRadius: '6px',
                borderLeft: `4px solid ${reason.score > 0 ? 'var(--accent-green)' : 'var(--accent-red)'}`
              }}
            >
              <div className="flex-between">
                <div>
                  <strong>{reason.rule}</strong>
                  <span className="text-muted"> • {reason.condition}</span>
                </div>
                <span className={`badge ${reason.score > 0 ? 'badge-green' : 'badge-red'}`}>
                  {reason.score > 0 ? '+' : ''}{reason.score}
                </span>
              </div>
              <div className="text-small text-muted" style={{ marginTop: '0.25rem' }}>
                {reason.interpretation}
              </div>
              <div className="text-small" style={{ marginTop: '0.25rem', fontFamily: 'monospace' }}>
                Value: {reason.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested levels (if not HOLD) */}
      {signal.verdict !== 'HOLD' && signal.suggestedLevels && (
        <div className="mb-2">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Suggested Levels
          </h3>
          <div className="grid grid-2">
            <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '6px' }}>
              <div className="text-muted text-small">Entry</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {signal.suggestedLevels.entry.toFixed(4)}
              </div>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '6px' }}>
              <div className="text-muted text-small">Stop Loss</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--accent-red)' }}>
                {signal.suggestedLevels.stopLoss.toFixed(4)}
              </div>
              <div className="text-small text-muted">Risk: {signal.suggestedLevels.riskPips.toFixed(1)} pips</div>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '6px' }}>
              <div className="text-muted text-small">Take Profit</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--accent-green)' }}>
                {signal.suggestedLevels.takeProfit.toFixed(4)}
              </div>
              <div className="text-small text-muted">Reward: {signal.suggestedLevels.rewardPips.toFixed(1)} pips</div>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '6px' }}>
              <div className="text-muted text-small">Risk:Reward</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                1:{signal.suggestedLevels.riskRewardRatio.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LLM Commentary (if available) */}
      {commentary && !commentary.error && (
        <div className="mb-2" style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid var(--accent-blue)',
          borderRadius: '6px',
          padding: '1rem'
        }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent-blue)' }}>
            AI Commentary
          </h3>
          <p className="text-small" style={{ lineHeight: 1.6, marginBottom: '0.5rem' }}>
            {commentary.text}
          </p>
          <p className="text-small text-muted">
            ⚠️ {commentary.disclaimer}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        {signal.verdict !== 'HOLD' ? (
          <>
            <button
              className="btn btn-primary"
              onClick={() => onApprove(signal)}
              style={{ flex: 1, background: 'var(--accent-green)' }}
            >
              <CheckCircle size={16} />
              Approve & Open Paper Position
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onDismiss(signal)}
              style={{ flex: 1 }}
            >
              <XCircle size={16} />
              Dismiss Signal
            </button>
          </>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={() => onDismiss(signal)}
            style={{ width: '100%' }}
          >
            <AlertTriangle size={16} />
            Dismiss HOLD Signal
          </button>
        )}
      </div>
    </div>
  );
}

export default SignalCard;
