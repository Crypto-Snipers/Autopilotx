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
// Creates a temporary object-URL so fetch() can hit a "real" endpoint in demo.
const makeMockEndpoint = (rows: any[]) => {
  const blob = new Blob([JSON.stringify(rows)], { type: "application/json" });
  return URL.createObjectURL(blob);
};

// Format "12 am, 1 am ..." style ticks
const toHourTick = (d: string | number | Date) =>
  new Date(d).toLocaleTimeString(undefined, { hour: "numeric" }).toLowerCase();

/**
 * ==== Card ===================================================================
 */

type CryptoCardProps = {
  name: string;          // e.g., "Bitcoin"
  symbol: string;        // e.g., "BTC"
  price: number;         // latest price (number)
  change24h: number;     // 24h % change (number)
  apiEndpoint: string;   // endpoint returning [{t: <iso/ms>, c: <close>}...]
  accent?: string;       // optional accent color
};

const CryptoCard = ({
  name,
  symbol,
  price,
  change24h,
  apiEndpoint,
  accent = "#1E3A8A"
}: CryptoCardProps) => {
  const [candles, setCandles] = useState<{ t: string; c: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const chartRef = useRef(null);

  // Use reliable mock candle data for charts
  useEffect(() => {
    let alive = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Set loading state initially
    setLoading(true);

    // Function to process candle data
    const processData = (data: any) => {
      if (!alive) return;

      try {
        if (Array.isArray(data) && data.length > 0) {
          // Convert to our expected format
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

        // Generate fallback data
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

    // Fetch data with a small delay to prevent continuous re-renders
    timeoutId = setTimeout(async () => {
      if (!alive) return;

      try {
        const res = await fetch(apiEndpoint, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        processData(data);
      } catch (e) {
        console.log(`Error fetching chart data for ${symbol}:`, e instanceof Error ? e.message : e);
        setErr("Failed to fetch. Showing sample data.");

        // Generate fallback data on error
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
    }, 1000); // Reduced delay for faster loading

    return () => {
      alive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [apiEndpoint, symbol]);

  // Build chart data & options to match your layout
  const data = useMemo(() => {
    const labels = candles.map((d) => toHourTick(d.t));
    const points = candles.map((d) => d.c);
    return {
      labels,
      datasets: [
        {
          label: `${symbol} 1m`,
          data: points,
          borderColor: accent,           // line color (blue/black per your spec)
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.4,                  // curved line
          fill: true,
          // soft gradient fill under the line
          backgroundColor: (ctx: any) => {
            const { chart } = ctx;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return "rgba(30,58,138,0.08)";
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, `${hexToRgba(accent, 0.18)}`);
            g.addColorStop(1, `${hexToRgba(accent, 0.00)}`);
            return g;
          },
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
          label: (ctx: any) => `${symbol}: ${formatNumber(ctx.parsed.y)}`,
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: "rgba(0,0,0,0.08)",     // subtle grid/border in chart
          borderColor: "rgba(0,0,0,0.25)"
        },
        ticks: { color: "#000", maxTicksLimit: 8, font: { size: 11 } }
      },
      y: {
        grid: {
          color: "rgba(0,0,0,0.08)",
          borderColor: "rgba(0,0,0,0.25)"
        },
        ticks: { color: "#000", font: { size: 11 } }
      }
    },
    elements: { point: { radius: 0 } }
  }), [symbol]);

  const bullish = change24h >= 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col w-full md:w-[32%]">
      {/* Header row: title/symbol + pill */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-semibold text-black">{name}</h3>
            <span className="text-sm text-gray-500">{symbol}</span>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full border ${bullish
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-red-50 text-red-700 border-red-200"
            }`}
        >
          {bullish ? "Bullish" : "Bearish"}
        </span>
      </div>

      {/* Price row */}
      <div className="mt-2 mb-3 flex items-center gap-3">
        <div className="text-3xl md:text-4xl font-bold text-black">
          ${formatNumber(price)}
        </div>
        <div
          className={`text-sm font-medium flex items-center gap-1 ${bullish ? "text-emerald-600" : "text-red-600"
            }`}
        >
          {/* inline arrow */}
          <svg width="14" height="14" viewBox="0 0 24 24" className={bullish ? "" : "rotate-180"}>
            <path d="M7 14l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {Math.abs(change24h).toFixed(2)}%
          <span className="text-gray-500 font-normal">(24H)</span>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative h-56 md:h-64">
        {loading && (
          <div className="absolute inset-0 rounded-lg border border-gray-200 bg-gray-50/60 flex items-center justify-center">
            <div className="animate-pulse text-sm text-gray-500">Loading chart…</div>
          </div>
        )}
        {!!err && !loading && (
          <div className="absolute inset-0 rounded-lg border border-gray-200 bg-red-50/60 flex items-center justify-center">
            <div className="text-sm text-red-700">Failed to fetch. Showing sample data.</div>
          </div>
        )}
        <Line ref={chartRef} data={data} options={options} />
      </div>

      {/* Footer timestamp */}
      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
        Last updated {new Date().toLocaleString()}
      </div>
    </div>
  );
};

/**
 * ==== Page-level wrapper to match your layout =================================
 * - One flex container
 * - On small screens: vertical stack
 * - On md+ screens: three columns
 */
const CryptoMarketOverview = () => {
  // State for cryptocurrency data
  const [btcData, setBtcData] = useState({ price: 0, change24h: 0 });
  const [ethData, setEthData] = useState({ price: 0, change24h: 0 });
  const [solData, setSolData] = useState({ price: 0, change24h: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real API endpoints for cryptocurrency data
  const tickerEndpoint = "https://api.coindcx.com/exchange/ticker";

  // Generate reliable mock candle data for charts
  const generateMockCandlesForSymbol = (symbol: any) => {
    // Get base price based on current ticker data
    let basePrice = symbol === "BTC" ? 110000 :
      symbol === "ETH" ? 4200 : 200; // SOL

    // Generate 24 hourly candles with realistic price movements
    const candles = [];
    const now = new Date();
    let currentPrice = basePrice;
    const volatility = symbol === "BTC" ? 0.008 :
      symbol === "ETH" ? 0.01 : 0.015; // SOL has higher volatility

    for (let i = 24; i > 0; i--) {
      const time = new Date(now);
      time.setHours(now.getHours() - i);

      // Create realistic price movement
      const trend = Math.sin(i / 4) * volatility * basePrice * 0.5;
      const noise = currentPrice * (Math.random() * volatility * 2 - volatility);
      currentPrice = basePrice + trend + noise;

      // Create candle data in the format expected by the chart
      candles.push({
        time: time.getTime(),
        open: currentPrice * (1 - volatility / 2),
        high: currentPrice * (1 + volatility),
        low: currentPrice * (1 - volatility),
        close: currentPrice,
        volume: Math.random() * basePrice * 0.1
      });
    }

    return candles;
  };

  // Create mock endpoints that return reliable chart data
  const btcCandles = useMemo(() => generateMockCandlesForSymbol("BTC"), []);
  const ethCandles = useMemo(() => generateMockCandlesForSymbol("ETH"), []);
  const solCandles = useMemo(() => generateMockCandlesForSymbol("SOL"), []);

  // Create endpoints that return this data
  const btcCandleEP = useMemo(() => makeMockEndpoint(btcCandles), [btcCandles]);
  const ethCandleEP = useMemo(() => makeMockEndpoint(ethCandles), [ethCandles]);
  const solCandleEP = useMemo(() => makeMockEndpoint(solCandles), [solCandles]);

  // Helper function to save data to session storage
  const saveToSessionStorage = (key: string, data: any) => {
    try {
      sessionStorage.setItem(key, JSON.stringify({
        timestamp: Date.now(),
        data
      }));
    } catch (error) {
      console.error(`Error reading from session storage: ${String(error)}`);
      return null;
    }
  };

  // Helper function to get data from session storage
  const getFromSessionStorage = (key: any) => {
    try {
      const storedData = sessionStorage.getItem(key);
      if (!storedData) return null;

      const parsedData = JSON.parse(storedData);
      // Check if data is less than 5 minutes old
      if (Date.now() - parsedData.timestamp < 5 * 60 * 1000) {
        return parsedData.data;
      }
      return null;
    } catch (error) {
      console.error(`Error reading from session storage: ${String(error)}`);
      return null;
    }
  };

  // Add a function to test the candle endpoints
  const testCandleEndpoint = async (endpoint: string) => {
    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      console.log(`Candle endpoint ${endpoint} response:`, data);
      return data;
    } catch (error) {
      console.error(`Error testing candle endpoint ${endpoint}:`, error);
      return null;
    }
  };

  // Fetch real cryptocurrency data with session storage fallback
  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const fetchCryptoData = async () => {
      try {
        setLoading(true);

        // Check session storage first
        const cachedData = getFromSessionStorage('cryptoData');
        if (cachedData) {
          // Use cached data immediately while fetching fresh data
          if (isMounted) {
            setBtcData(cachedData.btc);
            setEthData(cachedData.eth);
            setSolData(cachedData.sol);
            setLoading(false);
          }
        }

        // Fetch fresh data from API
        const response = await fetch(tickerEndpoint);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();

        // Find BTC, ETH, and SOL data in the response
        const btcTicker = data.find((item: any) =>
          item.market === "BTCUSDT" ||
          item.market.includes("BTC") && item.market.includes("USDT")
        );

        const ethTicker = data.find((item: any) =>
          item.market === "ETHUSDT" ||
          item.market.includes("ETH") && item.market.includes("USDT")
        );

        // Get all SOL-related markets for debugging
        const solMarkets = data.filter((item: any) =>
          item.market.includes("SOL") && !item.market.includes("BSOL")
        );

        // Log all markets to help debug
        console.log("Available SOL markets:", solMarkets.map((item: any) => item.market));

        // Try to find the correct Solana market
        // Based on the logs, we need to check for specific markets from the available ones
        let solTicker = null;

        // Try exact matches first
        const exactMatches = ["B-SOL_USDT"];
        for (const match of exactMatches) {
          const ticker = data.find((item: any) => item.market === match);
          if (ticker) {
            solTicker = ticker;
            console.log(`Found Solana ticker with market: ${match}`);
            break;
          }
        }

        // If no exact match, try the first SOL market that's not a wrapped token
        if (!solTicker && solMarkets.length > 0) {
          solTicker = solMarkets[0];
          console.log(`Using first available SOL market: ${solTicker.market}`);
        }

        // Process available data even if some tickers are missing
        if (isMounted) {
          // Create data objects with fallbacks
          if (btcTicker) {
            const btcData = {
              price: parseFloat(btcTicker.last_price),
              change24h: parseFloat(btcTicker.change_24_hour)
            };
            setBtcData(btcData);
            // Save individual data to session storage
            saveToSessionStorage('cryptoData_btc', btcData);
          }

          if (ethTicker) {
            const ethData = {
              price: parseFloat(ethTicker.last_price),
              change24h: parseFloat(ethTicker.change_24_hour)
            };
            setEthData(ethData);
            saveToSessionStorage('cryptoData_eth', ethData);
          }

          if (solTicker) {
            // For Solana, add extra validation and handle different formats
            const rawPrice = parseFloat(solTicker.last_price);
            const rawChange = parseFloat(solTicker.change_24_hour);

            // Check if we need to adjust the price based on market type
            let adjustedPrice = rawPrice;
            let adjustedChange = rawChange;

            // Handle different market types (INR vs USDT)
            if (solTicker.market.includes('INR')) {
              // If price is in INR, convert to approximate USD (1 INR ≈ 0.012 USD)
              adjustedPrice = rawPrice * 0.012;
              console.log(`Converting SOL price from INR (${rawPrice}) to USD (${adjustedPrice})`);
            } else if (rawPrice < 1) {
              // If price is unusually low for SOL in USD, it might be in different units
              // Current SOL price should be around $150, so if it's below $1, multiply by 1000
              adjustedPrice = rawPrice * 1000;
              console.log(`Adjusting unusually low SOL price: ${rawPrice} → ${adjustedPrice}`);
            }

            // Validate Solana data (accept any positive price after adjustment)
            if (adjustedPrice > 0) {
              const solData = {
                price: adjustedPrice,
                change24h: adjustedChange
              };
              setSolData(solData);
              saveToSessionStorage('cryptoData_sol', solData);
              console.log("Valid Solana data found after adjustment:", solData);
            } else {
              console.warn("Invalid Solana price detected even after adjustment:", adjustedPrice);
              // Try to get cached Solana data
              const cachedSolData = getFromSessionStorage('cryptoData_sol');
              if (cachedSolData) {
                setSolData(cachedSolData);
              } else {
                // Use hardcoded fallback for Solana
                setSolData({ price: 150, change24h: 0.5 });
              }
            }
          } else {
            // No Solana ticker found, use cached or fallback
            console.warn("No Solana ticker found in API response");
            const cachedSolData = getFromSessionStorage('cryptoData_sol');
            if (cachedSolData) {
              setSolData(cachedSolData);
            } else {
              // Use hardcoded fallback for Solana
              setSolData({ price: 150, change24h: 0.5 });
            }
          }

          // Clear any error since we processed data successfully
          setError(null);
        } else {
          throw new Error("Could not find all required cryptocurrency data");
        }
      } catch (err) {
        console.error("Error fetching cryptocurrency data:", err);

        if (isMounted) {
          setError(String(err));

          // If no cached data, generate fallback data
          if (!getFromSessionStorage('cryptoData')) {
            const btcData = { price: 65000 + Math.random() * 2000 - 1000, change24h: (Math.random() * 3 - 0.5) };
            const ethData = { price: 3500 + Math.random() * 200 - 100, change24h: (Math.random() * 3 - 0.5) };
            const solData = { price: 150 + Math.random() * 15 - 7.5, change24h: (Math.random() * 3 - 0.5) };

            setBtcData(btcData);
            setEthData(ethData);
            setSolData(solData);

            // Save even the fallback data to session storage
            saveToSessionStorage('cryptoData', { btc: btcData, eth: ethData, sol: solData });
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);

          // Schedule next update after 5 seconds
          timeoutId = setTimeout(fetchCryptoData, 5000);
        }
      }
    };

    // Start fetching data
    fetchCryptoData();

    // Cleanup function
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []); // Empty dependency array to run only once on mount

  return (
    <div className="w-full">
      {/* Top header (like your image) */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-black">Crypto Market Overview</h2>
        <p className="text-sm text-gray-600">Daily price performance over 24 hours</p>
        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            Error loading data: {error}. Using fallback data.
          </div>
        )}
      </div>

      {/* The single parent flex row (stacks on small) */}
      <div className="flex flex-col md:flex-row md:flex-wrap gap-6">
        {loading ? (
          // Loading state - show skeleton cards
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col w-full md:w-[32%] animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-10 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-56 bg-gray-100 rounded mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col w-full md:w-[32%] animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-10 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-56 bg-gray-100 rounded mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col w-full md:w-[32%] animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-10 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-56 bg-gray-100 rounded mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
          </>
        ) : (
          // Loaded state - show actual crypto cards
          <>
            <CryptoCard
              name="Bitcoin" symbol="BTC"
              price={btcData.price} change24h={btcData.change24h}
              apiEndpoint={btcCandleEP}
              accent="#1E3A8A" // blue line
            />
            <CryptoCard
              name="Ethereum" symbol="ETH"
              price={ethData.price} change24h={ethData.change24h}
              apiEndpoint={ethCandleEP}
              accent="#111827" // near-black line
            />
            <CryptoCard
              name="Solana" symbol="SOL"
              price={solData.price} change24h={solData.change24h}
              apiEndpoint={solCandleEP}
              accent="#1E3A8A" // blue again (stick to your "black/blue" request)
            />
          </>
        )}
      </div>
    </div>
  );
};

export default CryptoMarketOverview;

/**
 * ==== Small utilities =========================================================
 */
function formatNumber(n: any) {
  try { return Number(n).toLocaleString(); } catch { return n; }
}
function hexToRgba(hex: string, alpha: number = 1): string {
  // accepts "#1E3A8A" or "rgb(a)" — keeps it simple
  if (!hex || typeof hex !== "string") return `rgba(0,0,0,${alpha})`;
  if (hex.startsWith("rgb")) return hex; // assume already rgb(a)
  const v = hex.replace("#", "").trim();
  const bigint = parseInt(v.length === 3 ? v.split("").map(x => x + x).join("") : v, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

