"use client";

import React from "react";

const strategies = [
  {
    id: 1,
    name: "BlackBox Strategy 1",
    type: "Ethereum Futures",
    tag: "ETH",
    leverage: "10X",
    margin: "$500 | ₹50,000",
    description:
      "A fast-paced Ethereum scalping strategy designed to capture quick, short-term profits. It uses precise indicators and smart execution to exploit small market movements, multiplying capital rapidly through disciplined, high-frequency trades.",
    winRate: "67%",
    drawdown: "40%",
    trades: "968",
  },
  {
    id: 2,
    name: "BlackBox Strategy 2",
    type: "Bitcoin Futures",
    tag: "BTC",
    leverage: "10X",
    margin: "$500 | ₹50,000",
    description:
      "A dynamic Bitcoin trading strategy built for speed, precision, and consistency. It focuses on high-probability setups, turning small intraday moves into steady gains while minimizing risk through disciplined execution.",
    winRate: "67%",
    drawdown: "40%",
    trades: "968",
  },
];

export default function StrategiesPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-10">
      {/* Header */}
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Strategies</h1>

      {/* Tabs */}
      <div className="mb-8 flex space-x-4">
        <button className="px-5 py-2 rounded-full font-medium bg-gradient-to-r from-[#06a57f] via-[#05b289] to-[#05b288] text-white shadow-md">
          All Strategies
        </button>
        <button className="px-5 py-2 rounded-full font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition">
          Deployed Strategies
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {strategies.map((strategy) => (
          <div
            key={strategy.id}
            className="border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition bg-white"
          >
            {/* Title and Tag */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-gray-800">
                {strategy.name}
              </h2>
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                {strategy.tag}
              </span>
            </div>

            <p className="text-sm text-gray-500 mb-2">{strategy.type}</p>

            {/* Leverage & Margin */}
            <div className="mb-3">
              <span className="text-green-600 font-medium">
                Leverage: {strategy.leverage}
              </span>
              <span className="ml-3 text-red-500 font-medium">
                Margin: {strategy.margin}
              </span>
            </div>

            {/* Description */}
            <p className="text-gray-600 text-sm mb-4 leading-relaxed">
              {strategy.description}
            </p>

            {/* Win Rate */}
            <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Win Rate</span>
                <span>{strategy.winRate}</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                className="h-2 bg-gradient-to-r from-[#056f4a] to-[#06a57f]" // dark green to light green
                style={{ width: strategy.winRate }}
                ></div>
            </div>
            </div>


            {/* Drawdown & Trades */}
            <div className="flex justify-between text-sm text-gray-500 bg-gray-50 p-3 rounded-lg mb-5">
              <div>
                <p className="font-medium text-gray-700">Max Drawdown</p>
                <p>{strategy.drawdown}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Total Trades</p>
                <p>{strategy.trades}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button className="flex-1 py-2 rounded-full font-medium text-white bg-gradient-to-r from-[#06a57f] via-[#05b289] to-[#05b288] hover:opacity-90 transition">
                Deploy Strategy
              </button>
              <button className="flex-1 py-2 rounded-full font-medium text-[#05b289] border border-[#05b289] hover:bg-[#05b289] hover:text-white transition">
                Multiplier 1
              </button>
              <button className="p-2 rounded-full border border-gray-300 hover:bg-gray-100 transition">
                ⚙️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
