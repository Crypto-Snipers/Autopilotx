import React, { useEffect, useState } from "react";
import { Menu, Phone, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PriceData {
  symbol: string;
  price: number;
  change: number;
}

export default function Lowheader() {
  const { user } = useAuth();

  useEffect(() => {

  }, [user]);

  interface CryptoPrice {
    symbol: string;
    price: number;
    change: number;
  }

  const { data: cryptoPrices = [], isLoading, error } = useQuery<CryptoPrice[]>({
    queryKey: ["cryptoPrices"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/cryptolive-data');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching crypto data:', error);
        // Return default values matching the backend's error response
        return [
          { symbol: 'BTC', price: 0, change: 0 },
          { symbol: 'ETH', price: 0, change: 0 },
          { symbol: 'SOL', price: 0, change: 0 }
        ];
      }
    },
    refetchInterval: 15000, // 15 seconds - half of the cache time
    refetchIntervalInBackground: true,
    staleTime: 10000, // 10 seconds
    refetchOnWindowFocus: true,
  });

  return (
    // <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 md:px-6 bg-gray-200 opacity-90 rounded-md py-3 overflow-hidden">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 md:px-6 bg-gray-200 dark:bg-gray-700 opacity-90 rounded-b-lg py-3 overflow-hidden">
      {/* Crypto Data */}
      <div className="overflow-x-auto whitespace-nowrap text-sm sm:text-base md:text-base flex items-center gap-4">
        <span className="font-bold text-[#1a785f] dark:text-[#02b589]">Crypto</span>
        {cryptoPrices?.map((crypto) => (
          <span key={crypto.symbol} className="font-mono inline-flex items-center gap-1 text-[#1a785f] dark:text-white">
            {crypto.symbol}:
            <span className={crypto.change >= 0 ? "text-green-600 dark:text-[#00ed64]" : "text-red-500"}>
              {crypto.price.toFixed(2)} ({crypto.change >= 0 ? "+" : ""}
              {crypto.change.toFixed(2)}%)
            </span>
          </span>
        ))}
      </div>
      {/* Contact Options */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-sm">
        <a
          href="mailto:support@thecryptosnipers.com"
          className="text-[#1a785f] dark:text-white hover:text-gray-900 flex items-center"
        >
          <MessageSquare className="w-4 h-4 mr-1 text-[#1a785f] dark:text-white" />
          support@thecryptosnipers.com
        </a>
      </div>
    </div>
  );
}
