"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Info, ChevronLeft, ChevronRight } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Lowheader from "@/components/Lowheader";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { apiRequest } from "@/lib/queryClient";

interface TradeData {
  CreatedAt: string;
  Side: string;
  Size: number;
  State: string;
  AverageFillPrice: string;
  PaidCommission: string;
  Symbol: string;
}

export default function History() {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [symbol, setSymbol] = useState("all");
  const [side, setSide] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const { user } = useAuth();
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [prevPage, setPrevPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ Updated backend logic
  const fetchClientTrades = async () => {
    if (!user?.email) return [];

    setLoading(true);
    try {
      const res = await apiRequest<{
        status: string;
        count: number;
        data: TradeData[];
        page: number;
        next_page: number | null;
        previous_page: number | null;
        page_size: number;
      }>(
        "GET",
        `/api/user/client-history?email=${encodeURIComponent(user.email)}&page=${page}&page_size=${pageSize}`
      );

      if (res.status !== "success") throw new Error("Failed to fetch trades");

      setNextPage(res.next_page);
      setPrevPage(res.previous_page);
      setPage(res.page);
      return res.data;
    } catch (error) {
      console.error("Error fetching trade history:", error);
      setNextPage(null);
      setPrevPage(null);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientTrades().then(setTrades);
  }, [page, user?.email, pageSize]);

  const filteredTrades = trades.filter((trade) => {
    const tradeDate = new Date(trade.CreatedAt);
    return (
      (symbol === "all" || trade.Symbol.toLowerCase() === symbol) &&
      (side === "all" || trade.Side.toLowerCase() === side) &&
      (!startDate || tradeDate >= startDate) &&
      (!endDate || tradeDate <= endDate)
    );
  });

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setSymbol("all");
    setSide("all");
  };

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-[#2d3139]">
      <Sidebar />
      <div className="flex-1 md:ml-[14rem]">
        <Header />
        <Lowheader />

        <div className="min-h-screen bg-gray-50 dark:bg-[#2d3139] p-6">
          <div className="max-w-8xl mx-auto">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-foreground mb-6">
              History
            </h1>

            {/* Filters */}
            <div className="flex flex-wrap justify-between rounded-lg gap-4 items-center mb-6">
              {/* Start Date */}
              <div className="flex items-center gap-2">
                <span className="text-md text-gray-600 dark:text-gray-200">Start Date</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-60 justify-center bg-card text-foreground hover:bg-muted">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM d, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0">
                    <Calendar
                      mode="single"
                      selected={startDate || undefined}
                      onSelect={(date) => setStartDate(date ?? null)}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="flex items-center gap-2">
                <span className="text-md text-gray-600 dark:text-gray-200">End Date</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-60 justify-center bg-card text-foreground hover:bg-muted">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM d, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0">
                    <Calendar
                      mode="single"
                      selected={endDate || undefined}
                      onSelect={(date) => setEndDate(date ?? null)}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Symbol */}
              <div className="flex items-center gap-2">
                <span className="text-md text-gray-600 dark:text-gray-200">Symbol</span>
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="ethusd">ETHUSD</SelectItem>
                    <SelectItem value="btcusd">BTCUSD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Side */}
              <div className="flex items-center gap-2">
                <span className="text-md text-gray-600 dark:text-gray-200">Side</span>
                <Select value={side} onValueChange={setSide}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="bg-[#1a785f] hover:bg-[#1e896d] text-primary-foreground text-md font-semibold"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#06a57f]">
              <table className="w-full text-md text-left">
                <thead className="bg-[#06a57f] text-primary-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Order Time</th>
                    <th className="py-3 px-4">Position</th>
                    <th className="py-3 px-4">
                      <div className="flex items-center">
                        Lot Size
                        <span className="relative group ml-[16px] mb-1 inline-block align-middle">
                          <Info className="w-4 h-4 mt-1 cursor-pointer" />
                        </span>
                      </div>
                    </th>
                    <th className="py-3 px-4">Executed Price</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-500 dark:text-muted-foreground">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredTrades.length > 0 ? (
                    filteredTrades.map((trade, index) => (
                      <tr
                        key={index}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-muted"
                      >
                        <td className="py-3 px-4 text-gray-700 dark:text-foreground font-medium">
                          {format(new Date(trade.CreatedAt), "yyyy-MM-dd")}
                          <br />
                          <span className="text-gray-500 dark:text-muted-foreground text-[14px]">
                            {format(new Date(trade.CreatedAt), "HH:mm:ss")}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div
                              className={`w-1 h-8 rounded-full mr-3 ${
                                trade.Side === "buy" ? "bg-green-500" : "bg-red-500"
                              }`}
                            ></div>
                            <div>
                              <div className="font-medium text-gray-800 dark:text-foreground">
                                {trade.Symbol}
                              </div>
                              <div
                                className={`text-[14px] ${
                                  trade.Side === "buy" ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {trade.Side.charAt(0).toUpperCase() + trade.Side.slice(1)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-800 dark:text-foreground">
                          {trade.Size.toFixed(2)}{" "}
                          <span className="text-gray-500 dark:text-muted-foreground">
                            {trade.Symbol.replace("USD", "")}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-800 dark:text-foreground">
                          {parseFloat(trade.AverageFillPrice).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`${
                              trade.State === "filled"
                                ? "bg-[#DAF0E1] border-[#B5E1C3] text-[#006038] dark:bg-green-900/50 dark:border-green-800 dark:text-green-400"
                                : "bg-[#FCDAE2] border-[#F9B5C6] text-[#801D18] dark:bg-red-900/50 dark:border-red-800 dark:text-red-400"
                            } w-12 px-2 py-1 rounded-full text-[14px] border`}
                          >
                            {trade.State}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-800 dark:text-foreground text-right">
                          {parseFloat(trade.PaidCommission).toFixed(2)}{" "}
                          <span className="text-gray-500 dark:text-muted-foreground">USDT</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-4 text-center text-gray-500 dark:text-muted-foreground"
                      >
                        No trades found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-end pt-4">
              <Button
                size="sm"
                disabled={!prevPage}
                onClick={() => prevPage && setPage(prevPage)}
                className="bg-[#1a785f] hover:bg-[#1e896d] text-primary-foreground"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>

              <span className="mx-4 text-sm font-medium text-gray-700 dark:text-muted-foreground">
                Page {page}
              </span>

              <Button
                size="sm"
                disabled={!nextPage}
                onClick={() => nextPage && setPage(nextPage)}
                className="bg-[#1a785f] hover:bg-[#1e896d] text-primary-foreground"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
