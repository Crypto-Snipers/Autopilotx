
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Lowheader from "@/components/Lowheader";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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


  // Mock data for testing
  // const mockTrades: TradeData[] = [
  //   {
  //     CreatedAt: "2025-08-15T10:30:00Z",
  //     Side: "buy",
  //     Size: 2,
  //     State: "filled",
  //     AverageFillPrice: "2800",
  //     PaidCommission: "5",
  //     Symbol: "ETHUSD",
  //   },
  //   {
  //     CreatedAt: "2025-08-16T14:45:00Z",
  //     Side: "sell",
  //     Size: 1,
  //     State: "filled",
  //     AverageFillPrice: "42000",
  //     PaidCommission: "10",
  //     Symbol: "BTCUSD",
  //   },
  //   {
  //     CreatedAt: "2025-08-17T09:10:00Z",
  //     Side: "buy",
  //     Size: 5,
  //     State: "cancelled",
  //     AverageFillPrice: "41000",
  //     PaidCommission: "0",
  //     Symbol: "BTCUSD",
  //   },
  //   {
  //     CreatedAt: "2025-08-15T10:30:00Z",
  //     Side: "buy",
  //     Size: 2,
  //     State: "filled",
  //     AverageFillPrice: "2800",
  //     PaidCommission: "5",
  //     Symbol: "ETHUSD",
  //   },
  //   {
  //     CreatedAt: "2025-08-16T14:45:00Z",
  //     Side: "sell",
  //     Size: 1,
  //     State: "filled",
  //     AverageFillPrice: "42000",
  //     PaidCommission: "10",
  //     Symbol: "BTCUSD",
  //   },
  // ];

  // Fetch mock trades
  // const fetchClientTrades = async () => {
  //   // --- Bypassed API call and now returning mock data ---
  //   console.log("Fetching mock trades...");

  //   // Set pagination state for the static mock data
  //   setNextPage(null);
  //   setPrevPage(null);
  //   setPage(1);

  //   // Return a resolved promise with the mock data
  //   return Promise.resolve(mockTrades);
  // };

  useEffect(() => {
    fetchClientTrades().then(setTrades);
  }, [page, user?.email, pageSize]);

  const fetchClientTrades = async () => {
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
        `/api/user/client-history?email=${encodeURIComponent(user?.email || "")}&page=${page}&page_size=${pageSize}`
      );

      if (res.status !== "success") throw new Error("Failed to fetch trades");
      setNextPage(res.next_page);
      setPrevPage(res.previous_page);
      setPage(res.page);
      return res.data;
    } catch (error) {
      console.error("Error fetching trades, using mock:", error);
      setNextPage(null);
      setPrevPage(null);
      return [];
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

  // Clear Filters
  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setSymbol("all");
    setSide("all");
  };

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar />
      <div className="flex-1 md:ml-[14rem]">
        <Header />
        <Lowheader />
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">History</h1>

            {/* Filters */}
            <div className="flex flex-wrap rounded-lg gap-4 items-center mb-6">
              {/* Start Date */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Start Date</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-40 justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span className="truncate">
                        {startDate ? format(startDate, "MMM d, yyyy") : "Pick a date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0">
                    <Calendar
                      mode="single"
                      selected={startDate || undefined}
                      onSelect={(date) => setStartDate(date ?? null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">End Date</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-40 justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span className="truncate">
                        {endDate ? format(endDate, "MMM d, yyyy") : "Pick a date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0">
                    <Calendar
                      mode="single"
                      selected={endDate || undefined}
                      onSelect={(date) => setEndDate(date ?? null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Symbol */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Symbol:</span>
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
                <span className="text-sm text-gray-600">Side:</span>
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
              {/*Clear Filters Button */}
              <Button variant="destructive" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#C4D3FF]">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#C4D3FF] text-gray-600 font-medium">
                  <tr>
                    <th className="py-3 px-4">Order Time</th>
                    <th className="py-3 px-4">Position</th>
                    <th className="py-3 px-4">
                      <div className="flex items-center">
                        Lot Size
                        <span className="relative group ml-[16px] mb-1 inline-block align-middle">
                          <Info className="w-4 h-4 text-blue-500 cursor-pointer" />
                          <span className="absolute left-7 top-1/2 -translate-y-1/2 z-20 hidden group-hover:flex flex-col min-w-[180px] bg-white border border-[#C4D3FF] shadow-xl p-2 text-gray-900 text-xs">
                            <span className="text-gray-600 py-2">Lot Size Info</span>
                            <span className="font-semibold mb-1">1 lot = 0.01 ETH or 0.001 BTC.</span>
                            <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-gray-300"></span>
                          </span>
                        </span>
                      </div>
                    </th>
                    <th className="py-3 px-4">Executed Price</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.length > 0 ? (
                    filteredTrades.map((trade, index) => (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-700 font-medium">
                          {format(new Date(trade.CreatedAt), "yyyy-MM-dd")}
                          <br />
                          <span className="text-gray-500 font-medium text-[14px]">{format(new Date(trade.CreatedAt), "HH:mm:ss")}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div className={`w-1 h-8 rounded-full mr-3 ${trade.Side === "buy" ? "bg-green-500" : "bg-red-500"}`}></div>
                            <div>
                              <div className="font-medium text-gray-800">{trade.Symbol}</div>
                              <div className={`text-[14px] ${trade.Side === "buy" ? "text-green-600" : "text-red-600"}`}>
                                {trade.Side.charAt(0).toUpperCase() + trade.Side.slice(1)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-800">{trade.Size.toFixed(2)} <span className="text-gray-500">{trade.Symbol.replace('USD', '')}</span></td>
                        <td className="py-3 px-4 font-medium text-gray-800">{parseFloat(trade.AverageFillPrice).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          {/* {trade.State} */}
                          <span className={`${trade.State === "filled" ? "bg-[#DAF0E1] border-[#B5E1C3] border-[1px] text-[#006038]" : "bg-[#FCDAE2] border-[#F9B5C6] border-[1px] text-[#801D18]"} w-12 px-2 py-1 rounded-full text-[14px]`}>
                            {trade.State}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-800 text-right">{parseFloat(trade.PaidCommission).toFixed(2)} <span className="text-gray-500">USDT</span></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-gray-500">No trades found</td>
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
                className="bg-[#2664e2]"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <span className="mx-4 text-sm font-medium text-gray-700">Page {page}</span>
              <Button
                size="sm"
                disabled={!nextPage}
                onClick={() => nextPage && setPage(nextPage)}
                className="bg-[#2664e2]"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>

            {/* <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                disabled={!prevPage}
                onClick={() => prevPage && setPage(prevPage)}
              >
                Prev
              </Button>
              <span className="mx-4 text-sm font-medium">Page {page}</span>
              <Button
                variant="outline"
                disabled={!nextPage}
                onClick={() => nextPage && setPage(nextPage)}
              >
                Next
              </Button>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
