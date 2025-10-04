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

  // const { data, isLoading, error } = useQuery<PriceData[]>({
  //   queryKey: ["cryptoPrices"],
  //   queryFn: () => apiRequest("GET", "/api/cryptolive-data"),
  //   refetchInterval: 5000, // Refetch every 5 seconds
  //   refetchIntervalInBackground: true, // Continue refetching when tab is in background
  //   staleTime: 5000, // Consider data fresh for 5 seconds
  //   refetchOnWindowFocus: true, // Refetch when window regains focus
  // });

  // const cryptoPrices = data || [];

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
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 md:px-6 bg-[#62319bd0] rounded-md py-3 overflow-hidden">
      {/* Crypto Data */}
      <div className="overflow-x-auto whitespace-nowrap text-sm sm:text-base md:text-base flex items-center gap-4">
        <span className="font-medium text-white">Crypto</span>
        {cryptoPrices?.map((crypto) => (
          <span key={crypto.symbol} className="text-white font-mono inline-flex items-center gap-1">
            {crypto.symbol}:
            <span className={crypto.change >= 0 ? "text-green-500" : "text-red-500"}>
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
          className="text-white hover:text-neutral-900 flex items-center"
        >
          <MessageSquare className="w-4 h-4 mr-1 text-white" />
          support@thecryptosnipers.com
        </a>
      </div>
    </div>
  );
}
