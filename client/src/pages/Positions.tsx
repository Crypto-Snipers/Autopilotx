"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Lowheader from "@/components/Lowheader";

interface PositionRowProps {
  position: any;
}

function PositionRow_1({ position }: PositionRowProps) {
  const unrealizedProfit = parseFloat(position.unrealizedProfit || "0");
  const isProfit = unrealizedProfit >= 0;
  const pnlClass = isProfit ? "text-[#06a57f]" : "text-red-500";

  return (
    <tr className="border-b border-[#05b288] hover:bg-muted transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center">
          <div className="w-1 h-8 bg-[#05b288] mr-2 rounded-sm"></div>
          <div>
            <div className="text-foreground">{position.symbol}</div>
            <div className="text-sm text-[#06a57f]">Isolated {position.leverage}x</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-foreground font-medium">{position.positionSide}</td>
      <td className="py-3 px-4 text-foreground">
        {position.positionAmt} {position.symbol.split("-")[0]}
      </td>
      <td className="py-3 px-4 text-foreground">{position.avgPrice}</td>
      <td className="py-3 px-4 text-foreground">{position.ltp}</td>
      <td className="py-3 px-4">
        <div className={`${pnlClass} font-medium`}>
          {isProfit ? "+" : ""}
          {unrealizedProfit.toFixed(4)} USDT
        </div>
      </td>
    </tr>
  );
}

export default function Positions() {
  const demoPositions = [
    { positionId: "1", symbol: "BTC-USDT", positionSide: "LONG", positionAmt: "0.005", avgPrice: "40000", ltp: "40500", leverage: 10, unrealizedProfit: "25.5" },
    { positionId: "2", symbol: "ETH-USDT", positionSide: "SHORT", positionAmt: "0.2", avgPrice: "2500", ltp: "2450", leverage: 5, unrealizedProfit: "10.75" },
    { positionId: "3", symbol: "BNB-USDT", positionSide: "LONG", positionAmt: "1.0", avgPrice: "350", ltp: "345", leverage: 3, unrealizedProfit: "-5.0" },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 md:ml-[14rem] flex flex-col">
        <Header />
        <Lowheader />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Positions</h1>
          </div>

          {demoPositions.length > 0 ? (
            <div className="rounded-lg shadow overflow-hidden border border-[#05b288] bg-card transition-colors duration-300">
              <table className="w-full">
                <thead>
                  <tr className="text-left bg-gradient-to-r from-[#06a57f] via-[#05b289] to-[#05b288] text-white">
                    <th className="py-3 px-4 font-medium">Contract</th>
                    <th className="py-3 px-4 font-medium">Position</th>
                    <th className="py-3 px-4 font-medium">Value</th>
                    <th className="py-3 px-4 font-medium">Entry price</th>
                    <th className="py-3 px-4 font-medium">Current price</th>
                    <th className="py-3 px-4 font-medium">Unrealised P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {demoPositions.map((pos) => (
                    <PositionRow_1 key={pos.positionId} position={pos} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 flex flex-col items-center justify-center h-64 space-y-4">
              <p className="font-medium text-[#05b288]">No data available</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
