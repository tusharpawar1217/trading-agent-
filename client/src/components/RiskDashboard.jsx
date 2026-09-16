/**
 * Risk Dashboard Component
 * 
 * Displays circuit breaker status and provides reset controls
 */

import React, { useState, useEffect } from 'react';

function RiskDashboard() {
  const [breakers, setBreakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resetReason, setResetReason] = useState('');
  const [selectedBreaker, setSelectedBreaker] = useState(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/risk/status');
      const data = await response.json();
      
      if (data.success) {
        setBreakers(data.breakers);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch risk status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetBreaker = async (name) => {
    if (!resetReason.trim()) {
      alert('Please provide a reason for resetting the circuit breaker');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/risk/reset/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: resetReason }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Circuit breaker '${name}' has been reset`);
        setResetReason('');
        setSelectedBreaker(null);
        fetchStatus(); // Refresh status
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Failed to reset circuit breaker: ' + err.message);
    }
  };

  const resetAll = async () => {
    if (!resetReason.trim()) {
      alert('Please provide a reason for resetting all circuit breakers');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to reset ALL circuit breakers? This action should only be taken after careful review.'
    );

    if (!confirmed) return;

    try {
      const response = await fetch('http://localhost:3001/api/risk/reset-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: resetReason, confirm: true }),
      });

      const data = await response.json();

      if (data.success) {
        alert('All circuit breakers have been reset');
        setResetReason('');
        setSelectedBreaker(null);
        fetchStatus(); // Refresh status
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Failed to reset circuit breakers: ' + err.message);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading && breakers.length === 0) {
    return <div style={styles.container}>Loading risk status...</div>;
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <strong>Error:</strong> {error}
          <button onClick={fetchStatus} style={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const trippedCount = breakers.filter(b => b.status.tripped).length;
  const healthStatus = trippedCount === 0 ? 'healthy' : 'warning';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Risk Management Dashboard</h2>
        <div style={{
          ...styles.healthBadge,
          background: healthStatus === 'healthy' ? '#4CAF50' : '#FF9800',
        }}>
          {healthStatus === 'healthy' ? '✓ All Systems Operational' : `⚠ ${trippedCount} Breaker(s) Tripped`}
        </div>
      </div>

      <div style={styles.breakersGrid}>
        {breakers.map((breaker) => (
          <div
            key={breaker.name}
            style={{
              ...styles.breakerCard,
              borderColor: breaker.status.tripped ? '#f44336' : '#4CAF50',
            }}
          >
            <div style={styles.breakerHeader}>
              <h3 style={styles.breakerName}>{breaker.name}</h3>
              <span
                style={{
                  ...styles.statusBadge,
                  background: breaker.status.tripped ? '#f44336' : '#4CAF50',
                }}
              >
                {breaker.status.tripped ? 'TRIPPED' : 'ACTIVE'}
              </span>
            </div>

            <div style={styles.breakerBody}>
              <p><strong>Type:</strong> {breaker.type}</p>
              
              {breaker.status.reason && (
                <p><strong>Reason:</strong> {breaker.status.reason}</p>
              )}

              {breaker.status.value !== undefined && (
                <p><strong>Current Value:</strong> {breaker.status.value}</p>
              )}

              {breaker.status.threshold !== undefined && (
                <p><strong>Threshold:</strong> {breaker.status.threshold}</p>
              )}

              {breaker.status.tripped && (
                <button
                  onClick={() => setSelectedBreaker(breaker.name)}
                  style={styles.resetButton}
                >
                  Reset This Breaker
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {(selectedBreaker || trippedCount > 1) && (
        <div style={styles.resetPanel}>
          <h3>Reset Circuit Breaker</h3>
          <textarea
            value={resetReason}
            onChange={(e) => setResetReason(e.target.value)}
            placeholder="Enter reason for reset (required)..."
            style={styles.textarea}
            rows={3}
          />
          <div style={styles.resetButtons}>
            {selectedBreaker && (
              <button
                onClick={() => resetBreaker(selectedBreaker)}
                style={styles.confirmButton}
                disabled={!resetReason.trim()}
              >
                Reset {selectedBreaker}
              </button>
            )}
            {trippedCount > 1 && (
              <button
                onClick={resetAll}
                style={{ ...styles.confirmButton, background: '#FF5722' }}
                disabled={!resetReason.trim()}
              >
                Reset All ({trippedCount} breakers)
              </button>
            )}
            <button
              onClick={() => {
                setSelectedBreaker(null);
                setResetReason('');
              }}
              style={styles.cancelButton}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={styles.footer}>
        <small>Last updated: {new Date().toLocaleTimeString()}</small>
        <button onClick={fetchStatus} style={styles.refreshButton}>
          Refresh
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  healthBadge: {
    padding: '8px 16px',
    borderRadius: '20px',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  breakersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  },
  breakerCard: {
    border: '3px solid',
    borderRadius: '8px',
    padding: '16px',
    background: 'white',
  },
  breakerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  breakerName: {
    margin: 0,
    fontSize: '18px',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  breakerBody: {
    fontSize: '14px',
  },
  resetButton: {
    marginTop: '12px',
    padding: '8px 16px',
    background: '#FF5722',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  resetPanel: {
    background: '#fff3cd',
    border: '2px solid #ffc107',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
  },
  textarea: {
    width: '100%',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '14px',
    marginBottom: '12px',
  },
  resetButtons: {
    display: 'flex',
    gap: '12px',
  },
  confirmButton: {
    padding: '10px 20px',
    background: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: '10px 20px',
    background: '#9E9E9E',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '20px',
    borderTop: '1px solid #ccc',
  },
  refreshButton: {
    padding: '6px 12px',
    background: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  error: {
    background: '#ffebee',
    border: '1px solid #f44336',
    padding: '16px',
    borderRadius: '4px',
    color: '#c62828',
  },
  retryButton: {
    marginLeft: '12px',
    padding: '6px 12px',
    background: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default RiskDashboard;
