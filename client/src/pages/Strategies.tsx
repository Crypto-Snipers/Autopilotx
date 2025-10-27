"use client";

import React from "react";
import { Settings } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Lowheader from "@/components/Lowheader";

const strategies = [
  {
    id: 1,
    pair: "BTC/USDT",
    name: "BlackBox Strategy 1",
    description:
      "A dynamic Bitcoin trading strategy built for speed, precision, and consistency.",
    winRate: 67,
    maxDrawdown: 40,
    totalTrades: 968,
  },
  {
    id: 2,
    pair: "ETH/USDT",
    name: "BlackBox Strategy 2",
    description:
      "A fast-paced Ethereum scalping strategy designed to capture quick, short-term profits.",
    winRate: 67,
    maxDrawdown: 40,
    totalTrades: 968,
  },
];

const PerformanceGraph = ({ showMarker = false }: { showMarker?: boolean }) => {
  return (
    <div className="px-3 pt-4 pb-2 rounded-t-2xl relative h-[140px] bg-card transition-colors duration-300">
      <svg
        viewBox="0 0 300 200"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="greenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06a57f" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#05b289" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#05b288" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        <path
          d="M 50,180 
             L 80,160 
             L 120,140 
             L 170,40 
             L 200,130 
             L 240,80 
             L 280,110 
             L 280,190 
             L 50,190 Z"
          fill="url(#greenGradient)"
        />
        <path
          d="M 50,180 
             L 80,160 
             L 120,140 
             L 170,40 
             L 200,130 
             L 240,80 
             L 280,110"
          fill="none"
          stroke="#05b289"
          strokeWidth="3"
        />

        {showMarker && (
          <g>
            <line
              x1="210"
              y1="20"
              x2="210"
              y2="190"
              stroke="#05b288"
              strokeWidth="2"
              strokeDasharray="4"
            />
            <rect x="190" y="5" width="40" height="18" rx="4" fill="#05b289" />
            <text
              x="210"
              y="19"
              fontSize="10"
              fill="white"
              textAnchor="middle"
            >
              1 Mar
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default function StrategiesSection() {
  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">
      <Sidebar />

      <div className="flex-1 md:ml-[14rem] flex flex-col">
        <Header />
        <Lowheader />

        <main className="px-6 py-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-semibold text-foreground">
              Strategies
            </h1>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-4 justify-start">
            {strategies.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl shadow-md overflow-hidden border border-[#05b288] w-[400px] transform transition hover:scale-[1.01] duration-200 bg-card"
              >
                <PerformanceGraph showMarker={item.id === 2} />

                <div className="p-4 rounded-b-2xl bg-background transition-colors duration-300">
                  <span className="inline-block text-sm font-semibold bg-[#05b288]/10 text-[#05b288] px-3 py-1 rounded-full mb-2">
                    {item.pair}
                  </span>

                  <h3 className="text-xl font-bold leading-tight text-foreground">
                    {item.name}
                  </h3>

                  <p className="text-sm mt-2 mb-4 leading-snug text-muted-foreground">
                    {item.description}
                  </p>

                  {/* Win Rate */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs font-medium mb-1 text-muted-foreground">
                      <span>Win Rate</span>
                      <span className="font-semibold text-foreground">
                        {item.winRate}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-[#06a57f] via-[#05b289] to-[#05b288]"
                        style={{ width: `${item.winRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="border rounded-xl p-3 mb-4 text-xs bg-muted text-muted-foreground">
                    <div className="flex justify-between mb-1">
                      <span>Max Drawdown</span>
                      <span className="font-semibold text-foreground">
                        {item.maxDrawdown}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Trades</span>
                      <span className="font-semibold text-foreground">
                        {item.totalTrades}
                      </span>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2">
                    <button className="flex-1 py-2 text-sm rounded-full font-semibold text-[#05b289] border border-[#05b289] hover:bg-[#05b289] hover:text-white transition">
                      Deploy
                    </button>
                    <button className="flex-1 py-2 text-sm rounded-full font-semibold text-[#05b288] border border-[#05b288] hover:bg-[#05b288] hover:text-white transition">
                      Multiplier
                    </button>
                    <button className="p-2 rounded-full border border-border hover:bg-muted transition">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
