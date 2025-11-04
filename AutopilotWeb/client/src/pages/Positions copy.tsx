"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Lowheader from "@/components/Lowheader";
import { useTheme } from "@/context/ThemeContext";

interface PositionRowProps {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: string;
  entryPrice: string;
  markPrice: string;
  pnl: string;
  pnlPercent: string;
  leverage: number;
  liquidationPrice: number;
  ltp: number;
}

function PositionRow_1({ position, theme }: { position: any; theme: string }) {
  const unrealizedProfit = parseFloat(position.unrealizedProfit || '0');
  const isProfit = unrealizedProfit >= 0;

  const pnlClass = isProfit ? 'text-green-500' : 'text-red-400';

  return (
    <tr className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-muted`}>
      <td className="py-3 px-4">
        <div className="flex items-center">
          <div className="w-1 h-8 bg-green-500 mr-2 rounded-sm"></div>
          <div>
            <div className={"text-foreground font-medium"}>
              {position.symbol}
            </div>
            <div className="text-sm text-green-600">Isolated {position.leverage}x</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={"text-foreground font-medium"}>
          {position.positionSide}
        </span>
      </td>
      <td className={`py-3 px-4 text-foreground`}>
        {position.positionAmt} {position.symbol.split('-')[0]}
      </td>
      <td className={`py-3 px-4 text-foreground`}>
        {position.avgPrice}
      </td>
      <td className={`py-3 px-4 text-foreground`}>
        {position.ltp}
      </td>
      <td className="py-3 px-4">
        <div className={`${pnlClass} font-medium`}>
          {isProfit ? '+' : ''}{unrealizedProfit.toFixed(4)} USDT
        </div>
      </td>
    </tr>
  );
}

export default function Positions() {
  const { theme } = useTheme();

  // Demo data
  const demoPositions = [
    { positionId: '1', symbol: 'BTCUSDT', positionSide: 'LONG', positionAmt: '0.005', avgPrice: '40000', ltp: '40500', leverage: 10, unrealizedProfit: '25.5' },
    { positionId: '2', symbol: 'ETHUSDT', positionSide: 'SHORT', positionAmt: '0.2', avgPrice: '2500', ltp: '2450', leverage: 5, unrealizedProfit: '10.75' },
    { positionId: '3', symbol: 'ETHUSDT', positionSide: 'LONG', positionAmt: '1.0', avgPrice: '350', ltp: '345', leverage: 3, unrealizedProfit: '-5.0' },
  ];

  return (
    <div className={`flex min-h-screen transition-colors duration-300 dark:bg-[#2d3139] bg-neutral-50`}>
      <Sidebar />
      <div className="flex-1 md:ml-[14rem] flex flex-col">
        <Header />
        <Lowheader />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <h1 className={`text-2xl font-semibold dark:text-foreground`}>
              Positions
            </h1>
          </div>

          {demoPositions.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-[#06a57f]">
              <table className="w-full">
                <thead>
                  <tr className={`text-left bg-[#05b289] text-white" : "bg-[#06a57f] text-white font-semibold `}>
                    <th className="py-3 px-4">Contract</th>
                    <th className="py-3 px-4">Position</th>
                    <th className="py-3 px-4">Value</th>
                    <th className="py-3 px-4">Entry price</th>
                    <th className="py-3 px-4">Current price</th>
                    <th className="py-3 px-4">Unrealised P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {demoPositions.map(pos => (
                    <PositionRow_1 key={pos.positionId} position={pos} theme={theme} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 flex flex-col items-center justify-center h-64 space-y-4">
              <svg> </svg>
              <p className={"font-medium dark:text-foreground"}>No data available</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
