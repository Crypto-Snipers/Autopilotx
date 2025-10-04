import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Filler
} from "chart.js";
import { Line } from "react-chartjs-2";

// Register only what we need
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Filler);

/**
 * ==== Helpers ================================================================
 */
const makeMockEndpoint = (rows) => {
  const blob = new Blob([JSON.stringify(rows)], { type: "application/json" });
  return URL.createObjectURL(blob);
};

const toHourTick = (d) =>
  new Date(d).toLocaleTimeString(undefined, { hour: "numeric" }).toLowerCase();

function formatNumber(n) {
  try {
    return Number(n).toLocaleString();
  } catch {
    return n;
  }
}
function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== "string") return `rgba(0,0,0,${alpha})`;
  if (hex.startsWith("rgb")) return hex;
  const v = hex.replace("#", "").trim();
  const bigint = parseInt(v.length === 3 ? v.split("").map(x => x + x).join("") : v, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * ==== CryptoCard =============================================================
 */
const CryptoCard = ({
  name,
  symbol,
  price,
  change24h,
  apiEndpoint,
  accent = "#3b82f6"
}) => {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let alive = true;
    let timeoutId = null;
    setLoading(true);

    const processData = (data) => {
      if (!alive) return;
      try {
        if (Array.isArray(data) && data.length > 0) {
          const normalized = data.map(candle => ({
            t: new Date(candle.time).toISOString(),
            c: candle.close
          }));
          setCandles(normalized);
          setErr(null);
        } else {
          throw new Error("Invalid data format");
        }
      } catch (e) {
        console.error(`Error processing chart data for ${symbol}:`, e);
        setErr("Error processing chart data");
        const basePrice = symbol === "BTC" ? 110000 : symbol === "ETH" ? 4200 : 200;
        const volatility = symbol === "BTC" ? 0.008 : symbol === "ETH" ? 0.01 : 0.015;
        const fallbackData = [];
        const now = new Date();
        for (let i = 24; i > 0; i--) {
          const time = new Date(now);
          time.setHours(now.getHours() - i);
          fallbackData.push({
            t: time.toISOString(),
            c: basePrice * (1 + Math.sin(i / 4) * volatility)
          });
        }
        setCandles(fallbackData);
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
        setErr("Failed to fetch. Showing sample data.");
        const basePrice = symbol === "BTC" ? 110000 : symbol === "ETH" ? 4200 : 200;
        const volatility = symbol === "BTC" ? 0.008 : symbol === "ETH" ? 0.01 : 0.015;
        const fallbackData = [];
        const now = new Date();
        for (let i = 24; i > 0; i--) {
          const time = new Date(now);
          time.setHours(now.getHours() - i);
          fallbackData.push({
            t: time.toISOString(),
            c: basePrice * (1 + Math.sin(i / 4) * volatility)
          });
        }
        setCandles(fallbackData);
        if (alive) setLoading(false);
      }
    }, 1000);

    return () => {
      alive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [apiEndpoint, symbol]);

  const data = useMemo(() => {
    const labels = candles.map((d) => toHourTick(d.t));
    const points = candles.map((d) => d.c);
    return {
      labels,
      datasets: [
        {
          label: `${symbol} 1m`,
          data: points,
          borderColor: "rgb(255, 204, 0)",
          pointRadius: 0,
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          backgroundColor: "rgb(245, 205, 112, 0.34)",
        },
      ],
    };
  }, [candles, accent, symbol]);

  const options = useMemo(() => ({
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
        }
      }
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.25)" },
        ticks: { color: "#ffff", maxTicksLimit: 8, font: { size: 12 } }
      },
      y: {
        grid: { color: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.25)" },
        ticks: { color: "#ffff", font: { size: 12 } }
      }
    },
    elements: { point: { radius: 0 } }
  }), [symbol]);

  const bullish = change24h >= 0;

  return (
    <div className="bg-[#171f34] rounded-2xl border border-[#171f34] shadow-sm p-4 flex flex-col w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <h3 className="   md font-semibold text-white">{name}</h3>
            <span className="text-sm text-white">{symbol}</span>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full border ${
            bullish
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {bullish ? "Bullish" : "Bearish"}
        </span>
      </div>

      {/* Price */}
      <div className="mt-2 mb-3 flex items-center gap-3">
        <div className="text-3xl md:text-xl font-bold text-white">
          ${formatNumber(price)}
        </div>
        <div
          className={`text-sm font-medium flex items-center gap-1 ${
            bullish ? "text-emerald-600" : "text-red-600"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" className={bullish ? "" : "rotate-180"}>
            <path d="M7 14l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs">{Math.abs(change24h).toFixed(2)}%</span>
          <span className="text-white font-normal text-xs">(24H)</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-32 md:h-40">
        {loading && (
          <div className="absolute inset-0 rounded-lg border border-[#171f34] bg-[#171f34]/60 flex items-center justify-center">
            <div className="animate-pulse text-sm text-gray-500">Loading chart…</div>
          </div>
        )}
        {!!err && !loading && (
          <div className="absolute inset-0 rounded-lg border border-[#171f34] bg-[#171f34]/60 flex items-center justify-center">
            <div className="text-sm text-red-700">Failed to fetch. Showing sample data.</div>
          </div>
        )}
        <Line ref={chartRef} data={data} options={options} />
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-[#171f34] text-sm text-white">
        Last updated {new Date().toLocaleString()}
      </div>
    </div>
  );
};

/**
 * ==== CryptoMarketOverview ===================================================
 */
const CryptoMarketOverview = () => {
  const [btcData, setBtcData] = useState({ price: 0, change24h: 0 });
  const [ethData, setEthData] = useState({ price: 0, change24h: 0 });
  const [solData, setSolData] = useState({ price: 0, change24h: 0 });
  const [loading, setLoading] = useState(true);

  const generateMockCandlesForSymbol = (symbol) => {
    let basePrice = symbol === "BTC" ? 110000 : symbol === "ETH" ? 4200 : 200;
    const candles = [];
    const now = new Date();
    let currentPrice = basePrice;
    const volatility = symbol === "BTC" ? 0.008 : symbol === "ETH" ? 0.01 : 0.015;
    for (let i = 24; i > 0; i--) {
      const time = new Date(now);
      time.setHours(now.getHours() - i);
      const trend = Math.sin(i / 4) * volatility * basePrice * 0.5;
      const noise = currentPrice * (Math.random() * volatility * 2 - volatility);
      currentPrice = basePrice + trend + noise;
      candles.push({
        time: time.getTime(),
        close: currentPrice
      });
    }
    return candles;
  };

  const btcCandles = useMemo(() => generateMockCandlesForSymbol("BTC"), []);
  const ethCandles = useMemo(() => generateMockCandlesForSymbol("ETH"), []);
  const solCandles = useMemo(() => generateMockCandlesForSymbol("SOL"), []);

  const btcCandleEP = useMemo(() => makeMockEndpoint(btcCandles), [btcCandles]);
  const ethCandleEP = useMemo(() => makeMockEndpoint(ethCandles), [ethCandles]);
  const solCandleEP = useMemo(() => makeMockEndpoint(solCandles), [solCandles]);

  useEffect(() => {
    // mock fetch: just set fake data after delay
    setTimeout(() => {
      setBtcData({ price: 65230, change24h: 2.45 });
      setEthData({ price: 3120, change24h: -0.85 });
      setSolData({ price: 145, change24h: 5.12 });
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="w-full">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">Crypto Market Overview</h2>
        <p className="text-sm text-white">Daily price performance over 24 hours</p>
      </div>
      {/* One card per row */}
      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex flex-col animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-10 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-56 bg-gray-100 rounded mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </>
        ) : (
          <>
            <CryptoCard
              name="Bitcoin" symbol="BTC"
              price={btcData.price} change24h={btcData.change24h}
              apiEndpoint={btcCandleEP} accent="#2563EB"
            />
            <CryptoCard
              name="Ethereum" symbol="ETH"
              price={ethData.price} change24h={ethData.change24h}
              apiEndpoint={ethCandleEP} accent="#4B4B4B"
            />
            <CryptoCard
              name="Solana" symbol="SOL"
              price={solData.price} change24h={solData.change24h}
              apiEndpoint={solCandleEP} accent="#2563EB"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default CryptoMarketOverview;
