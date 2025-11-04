import React from "react";

export default function StrategyCards({ active = false }) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm flex-1">
        <h3 className="font-semibold text-lg mb-4">Advanced Delta Neutral</h3>
        
        {/* Tags */}
        <div className="flex gap-2 mb-6">
          <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
            Sell NIFTY BANK ATM O CE
          </span>
          <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
            Sell NIFTY BANK ATM O PE
          </span>
        </div>
        
        {/* Strategy details */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-700">Start Time:</span>
            <span className="text-green-500">9:22</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">End Time:</span>
            <span className="text-amber-500">15:11</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Segment Type:</span>
            <span className="text-gray-900">OPTION</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Strategy Type:</span>
            <span className="text-gray-900">Time Based</span>
          </div>
        </div>
        
        {/* View Report Button */}
        {active ? (
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg text-center font-medium">
            View Report
          </button>
        ) : (
          <button className="w-full border border-blue-600 text-blue-600 py-3 rounded-lg text-center font-medium">
            View Report
          </button>
        )}
      </div>
    );
  }