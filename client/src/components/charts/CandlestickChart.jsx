/**
 * Candlestick Chart Component
 * 
 * Displays OHLC data with candlestick visualization using Chart.js
 * Supports multiple timeframes and signal overlays
 */

import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';

// Register Chart.js components
ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  CandlestickController,
  CandlestickElement
);

/**
 * Format OHLC data for candlestick chart
 */
function formatCandlestickData(candles) {
  return candles.map(candle => ({
    x: candle.timestamp,
    o: candle.open,
    h: candle.high,
    l: candle.low,
    c: candle.close,
  }));
}

/**
 * Format signal markers
 */
function formatSignalMarkers(signals) {
  return signals.map(signal => ({
    x: signal.timestamp,
    y: signal.entryPrice,
    type: signal.direction, // 'BUY' or 'SELL'
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
  }));
}

function CandlestickChart({ 
  candles = [], 
  signals = [],
  width = 800,
  height = 400,
  title = 'Price Chart',
}) {
  const chartRef = useRef(null);

  if (!candles || candles.length === 0) {
    return (
      <div style={{ 
        width, 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px solid #ccc',
        borderRadius: '4px',
        background: '#f9f9f9',
      }}>
        <p>No data available</p>
      </div>
    );
  }

  const candlestickData = formatCandlestickData(candles);
  const signalMarkers = formatSignalMarkers(signals);

  // Separate BUY and SELL signals
  const buySignals = signalMarkers.filter(s => s.type === 'BUY');
  const sellSignals = signalMarkers.filter(s => s.type === 'SELL');

  const chartData = {
    datasets: [
      {
        label: 'Price',
        type: 'candlestick',
        data: candlestickData,
        borderColor: {
          up: '#26a69a',
          down: '#ef5350',
          unchanged: '#999',
        },
        backgroundColor: {
          up: 'rgba(38, 166, 154, 0.5)',
          down: 'rgba(239, 83, 80, 0.5)',
          unchanged: 'rgba(153, 153, 153, 0.5)',
        },
      },
      {
        label: 'Buy Signal',
        type: 'scatter',
        data: buySignals,
        backgroundColor: '#00C853',
        borderColor: '#00C853',
        borderWidth: 2,
        pointRadius: 8,
        pointStyle: 'triangle',
        rotation: 0,
      },
      {
        label: 'Sell Signal',
        type: 'scatter',
        data: sellSignals,
        backgroundColor: '#D50000',
        borderColor: '#D50000',
        borderWidth: 2,
        pointRadius: 8,
        pointStyle: 'triangle',
        rotation: 180,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const dataPoint = context.raw;
            if (dataPoint.o !== undefined) {
              // Candlestick
              return [
                `Open: ${dataPoint.o.toFixed(5)}`,
                `High: ${dataPoint.h.toFixed(5)}`,
                `Low: ${dataPoint.l.toFixed(5)}`,
                `Close: ${dataPoint.c.toFixed(5)}`,
              ];
            } else {
              // Signal marker
              return [
                `${dataPoint.type} Signal`,
                `Entry: ${dataPoint.y.toFixed(5)}`,
                `Stop Loss: ${dataPoint.stopLoss?.toFixed(5) || 'N/A'}`,
                `Take Profit: ${dataPoint.takeProfit?.toFixed(5) || 'N/A'}`,
              ];
            }
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MMM dd',
          },
        },
        title: {
          display: true,
          text: 'Time',
        },
      },
      y: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Price',
        },
        ticks: {
          callback: function(value) {
            return value.toFixed(5);
          },
        },
      },
    },
  };

  return (
    <div style={{ width, height }}>
      <Chart
        ref={chartRef}
        type='candlestick'
        data={chartData}
        options={options}
      />
    </div>
  );
}

export default CandlestickChart;
