import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useTheme } from "@/context/ThemeContext";

// Register required Chart.js components
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Filler);

/* =========================================================================
   Helper Functions
   ========================================================================= */

// Format large numbers neatly
const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "-";
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
  return Number(num).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Create light gradient fill
const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Format timestamps to "12 am", "1 am" style
const toHourTick = (d) =>
  new Date(d).toLocaleTimeString(undefined, { hour: "numeric" }).toLowerCase();

// CryptoCard Component

const CryptoCard = ({
  name,
  symbol,
  apiEndpoint,
  accent = "#1E3A8A", // default blue
}) => {
  const { theme } = useTheme(); // Access current theme
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [price, setPrice] = useState(0);
  const [change24h, setChange24h] = useState(0);
  const chartRef = useRef(null);

  useEffect(() => {
    let alive = true;
    let timeoutId = null;

    setLoading(true);

    const processData = (data) => {
      if (!alive) return;

      try {
        if (Array.isArray(data) && data.length > 0) {
          const normalized = data.map((candle) => ({
            t: new Date(candle.time).toISOString(),
            c: candle.close,
          }));

          setCandles(normalized);
          setErr(null);

          // Calculate latest price & 24h change
          const first = normalized[0]?.c;
          const last = normalized[normalized.length - 1]?.c;
          if (first && last) {
            setPrice(last);
            setChange24h(((last - first) / first) * 100);
          }
        } else {
          throw new Error("Invalid data format");
        }
      } catch (e) {
        console.error(`Error processing chart data for ${symbol}:`, e);
        setErr("Error processing chart data");
      } finally {
        if (alive) setLoading(false);
      }
    };

    timeoutId = setTimeout(async () => {
      if (!alive) return;
      try {
        const res = await fetch(apiEndpoint, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        processData(data);
      } catch (e) {
        console.log(`Error fetching chart data for ${symbol}:`, e.message);
        setErr("Failed to fetch data");
        setLoading(false);
      }
    }, 800);

    return () => {
      alive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [apiEndpoint, symbol]);

  // Prepare chart data
  const data = useMemo(() => {
    const labels = candles.map((d) => toHourTick(d.t));
    const points = candles.map((d) => d.c);
    return {
      labels,
      datasets: [
        {
          label: `${symbol} 1m`,
          data: points,
          borderColor: accent,
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return "rgba(30,58,138,0.08)";
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, `${hexToRgba(accent, 0.1)}`);
            g.addColorStop(1, `${hexToRgba(accent, 0.1)}`);
            return g;
          },
        },
      ],
    };
  }, [candles, accent, symbol]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: "index",
          intersect: false,
          displayColors: false,
          callbacks: {
            label: (ctx) => `${symbol}: ${formatNumber(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)'
          },
          ticks: {
            color: theme === 'dark' ? '#9ca3af' : '#000',
            maxTicksLimit: 8,
            font: { size: 11 }
          },
        },
        y: {
          grid: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)'
          },
          ticks: {
            color: theme === 'dark' ? '#9ca3af' : '#000',
            font: { size: 11 }
          },
        },
      },
      elements: { point: { radius: 0 } },
    }),
    // --- CHANGE: Added theme to the dependency array to trigger re-renders on theme change ---
    [symbol, theme]
  );

  const bullish = change24h >= 0;

  return (
    <div className="bg-neutral-50 dark:bg-muted border border-slate-200 dark:border-border rounded-xl shadow-md p-5 flex flex-col w-full hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-foreground">{name}</h3>
          <span className="text-sm text-slate-400 dark:text-muted-foreground">{symbol}</span>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full border ${bullish
            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            : "bg-red-500/10 text-red-600 border-red-500/20"
            }`}
        >
          {bullish ? "Bullish" : "Bearish"}
        </span>
      </div>

      <div className="mt-2 mb-3 flex items-center gap-3">
        <div className="text-3xl font-bold text-slate-900 dark:text-foreground">
          ${formatNumber(price)}
        </div>
        <div
          className={`text-sm font-medium flex items-center gap-1 ${bullish ? "text-emerald-500" : "text-red-500"
            }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" className={bullish ? "" : "rotate-180"}>
            <path
              d="M7 14l5-5 5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{Math.abs(change24h).toFixed(2)}%</span>
          <span className="text-slate-500 dark:text-muted-foreground font-normal text-xs">(24H)</span>
        </div>
      </div>

      <div className="relative h-48">
        {(loading || err) && (
          <div className="absolute inset-0 rounded-lg bg-white/80 dark:bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
            {loading ? (
              <div className="animate-pulse text-sm text-slate-500 dark:text-muted-foreground">
                Loading Chart...
              </div>
            ) : (
              <div className="text-sm text-red-500 text-center px-2">{err}</div>
            )}
          </div>
        )}
        <Line ref={chartRef} data={data} options={options} />
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-border text-xs text-slate-400 dark:text-muted-foreground">
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
};

// CryptoMarketOverview Component

export default function CryptoMarketOverview() {
  return (
    <div className="w-full font-sans p-4 bg-white dark:bg-background rounded-2xl border border-slate-200 dark:border-border shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-foreground">
          Crypto Market Overview
        </h2>
        <p className="text-sm text-slate-500 dark:text-muted-foreground">
          Live price performance over 48 hours
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6">
        <CryptoCard
          name="Bitcoin"
          symbol="BTC"
          apiEndpoint="https://public.coindcx.com/market_data/candles?pair=B-BTC_USDT&interval=1m"
          accent="#05b289"
        />
        <CryptoCard
          name="Ethereum"
          symbol="ETH"
          apiEndpoint="https://public.coindcx.com/market_data/candles?pair=B-ETH_USDT&interval=1m"
          accent="#208b3a"
        />
        <CryptoCard
          name="Solana"
          symbol="SOL"
          apiEndpoint="https://public.coindcx.com/market_data/candles?pair=B-SOL_USDT&interval=1m"
          accent="#34a0a4"
        />
      </div>
    </div>
  );
}

