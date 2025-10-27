// pages/Positions.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Lowheader from "@/components/Lowheader";
import { supabase } from "@/lib/supabase";

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

function PositionRow({
  symbol,
  side,
  size,
  entryPrice,
  markPrice,
  pnl,
  pnlPercent,
  leverage,
  liquidationPrice,
  ltp,
}: PositionRowProps) {
  const isProfit = parseFloat(pnl) >= 0;

  const pnlClass = isProfit ? 'text-green-600' : 'text-red-400';
  const pnlBgClass = isProfit ? 'bg-green-200/30' : 'bg-red-200/20';
  const sideClass = side === 'LONG' ? 'text-green-600' : 'text-red-400';

  return (
    <tr className="border-b border-[#05b288] hover:bg-[#05b288]/20">
      <td className="py-4 px-4">
        <div className="w-1 h-8 bg-[#05b288] mr-2 rounded-sm"></div>
        <div className="font-medium text-black">{symbol}</div>
        <div className="text-xs text-[#06a57f]">Isolated {leverage}x</div>
      </td>
      <td className="py-4 px-4">
        <div className={`flex items-center ${sideClass}`}>
          <div
            className={`w-4 h-4 rounded-full mr-2 ${
              side === 'LONG' ? 'bg-green-600' : 'bg-red-400'
            }`}
          ></div>
          <span>{side}</span>
        </div>
      </td>
      <td className="py-4 px-4 text-[#05b288]">
        {size} {symbol.split('-')[1] || 'USDT'}
      </td>
      <td className="py-4 px-4 text-[#05b288]">{parseFloat(entryPrice).toFixed(2)}</td>
      <td className="py-4 px-4 text-[#05b288]">{parseFloat(markPrice).toFixed(2)}</td>
      <td className="py-4 px-4">
        <div className={pnlClass}>
          {isProfit ? '+' : ''}{parseFloat(pnl).toFixed(4)} {symbol.split('-')[0] || 'USDT'}
        </div>
        <div
          className={`text-xs ${pnlClass} ${pnlBgClass} rounded px-2 py-0.5 inline-block mt-1`}
        >
          {isProfit ? '+' : ''}{(parseFloat(pnlPercent) * 100).toFixed(2)}%
        </div>
      </td>
      <td className="py-4 px-4">
        <div className={pnlClass}>
          {isProfit ? '+' : ''}{parseFloat(pnl).toFixed(4)} {symbol.split('-')[1] || 'USDT'}
        </div>
        <div
          className={`text-xs ${pnlClass} ${pnlBgClass} rounded px-2 py-0.5 inline-block mt-1`}
        >
          {isProfit ? '+' : ''}{(parseFloat(pnlPercent) * 100).toFixed(2)}%
        </div>
      </td>
    </tr>
  );
}

function PositionRow_1({ position }: { position: any }) {
  const unrealizedProfit = parseFloat(position.unrealizedProfit || '0');
  const isUnrealisedPositive = unrealizedProfit >= 0;

  const unrealisedColor = isUnrealisedPositive ? 'text-green-600' : 'text-red-400';
  const unrealisedBgColor = isUnrealisedPositive ? 'bg-green-200/30' : 'bg-red-200/20';

  const currency =
    typeof window !== 'undefined' && sessionStorage.getItem('currency')
      ? sessionStorage.getItem('currency')
      : 'USDT';

  const formattedUnrealizedProfit = `${isUnrealisedPositive ? '+' : ''}${unrealizedProfit.toFixed(
    4
  )} ${currency}`;

  return (
    <tr key={position.positionId} className="border-b border-[#05b288] hover:bg-[#05b288]/20">
      <td className="py-3 px-4">
        <div className="flex items-center">
          <div className="w-1 h-8 bg-[#05b288] mr-2 rounded-sm"></div>
          <div>
            <div className="text-black">{position.symbol}</div>
            <div className="text-sm text-[#06a57f]">Isolated {position.leverage}x</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="font-medium text-[#05b288]">{position.positionSide}</span>
      </td>
      <td className="py-3 px-4 text-[#05b288]">
        {position.positionAmt} {position.symbol.split('-')[0]}
      </td>
      <td className="py-3 px-4 text-[#05b288]">{position.avgPrice}</td>
      <td className="py-3 px-4 text-[#05b288]">{position.ltp}</td>
      <td className="py-3 px-4">
        <div className={`${unrealisedColor} font-medium`}>{formattedUnrealizedProfit}</div>
      </td>
    </tr>
  );
}

export default function Positions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<NodeJS.Timeout>();

  const fetchPositions = async () => {
    if (!user?.email) return [];

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (!session || sessionError) {
      console.error('No active session or session error:', sessionError);
      throw new Error(sessionError?.message || "No active session");
    }

    const { apiRequest } = await import('@/lib/queryClient');
    try {
      return await apiRequest('GET', `/api/positions/live?email=${encodeURIComponent(user?.email || '')}`);
    } catch (error) {
      console.error('Error fetching positions:', error);
      throw error;
    }
  };

  const { data: positions = [], isLoading, error } = useQuery({
    queryKey: ["positions", user?.email],
    queryFn: fetchPositions,
    enabled: !!user?.email,
    refetchOnWindowFocus: false,
    staleTime: 0,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (positions && positions.length > 0) {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["positions", user?.email] });
      }, 2000);
    } else if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [positions, user?.email, queryClient]);

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <div className="flex-1 md:ml-[14rem]">
        <Header />
        <Lowheader />
        <main className="flex-1 overflow-y-auto p-2 md:p-4">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-black">Positions</h1>
          </div>

          {Array.isArray(positions) && positions.length > 0 ? (
            <div className="bg-[#05b288] rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#06a57f] text-white text-left">
                    <th className="py-3 px-4 font-medium">Contract</th>
                    <th className="py-3 px-4 font-medium">Position</th>
                    <th className="py-3 px-4 font-medium">Value</th>
                    <th className="py-3 px-4 font-medium">Entry price</th>
                    <th className="py-3 px-4 font-medium">Current price</th>
                    <th className="py-3 px-4 font-medium">Unrealised P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos: any) => (
                    <PositionRow_1 key={pos.id} position={pos} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 flex flex-col items-center justify-center h-64 space-y-4">
              <svg> </svg>
              <p className="text-[#05b288]">No data available</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
