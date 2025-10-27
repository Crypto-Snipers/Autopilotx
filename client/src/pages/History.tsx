import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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

  // Fetch trades
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

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setSymbol("all");
    setSide("all");
  };

  return (
    <div className="flex min-h-screen bg-[#171f34]">
      <Sidebar />
      <div className="flex-1 md:ml-[14rem]">
        <Header />
        <Lowheader />
        <div className="min-h-screen bg-[#171f34] p-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-semibold text-white mb-6">History</h1>

            {/* Filters */}
            <div className="flex flex-wrap rounded-lg gap-4 items-center mb-6">
              {/* Start Date */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">Start Date</span>
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
                <span className="text-sm text-white">End Date</span>
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
                <span className="text-sm text-white">Symbol:</span>
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
                <span className="text-sm text-white">Side:</span>
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

              <Button variant="destructive" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#05b288]">
              <table className="w-full text-sm text-left">
                <thead className="bg-gradient-to-r from-[#06a57f] via-[#05b289] to-[#05b288] text-white font-medium">
                  <tr>
                    <th className="py-3 px-4">Order Time</th>
                    <th className="py-3 px-4">Position</th>
                    <th className="py-3 px-4">
                      <div className="flex items-center">
                        Lot Size
                        <span className="relative group ml-[16px] mb-1 inline-block align-middle">
                          <Info className="w-4 h-4 text-green-300 cursor-pointer" />
                          <span className="absolute left-7 top-1/2 -translate-y-1/2 z-20 hidden group-hover:flex flex-col min-w-[180px] bg-white border border-[#05b288] shadow-xl p-2 text-gray-900 text-xs">
                            <span className="text-white py-2">Lot Size Info</span>
                            <span className="font-semibold mb-1">1 lot = 0.01 ETH or 0.001 BTC.</span>
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
                      <tr key={index} className="border-b border-[#05b288] hover:bg-[#064c3b]/20">
                        <td className="py-3 px-4 text-gray-200 font-medium">
                          {format(new Date(trade.CreatedAt), "yyyy-MM-dd")}
                          <br />
                          <span className="text-gray-400 font-medium text-[14px]">{format(new Date(trade.CreatedAt), "HH:mm:ss")}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div className={`w-1 h-8 rounded-full mr-3 ${trade.Side === "buy" ? "bg-[#05b288]" : "bg-red-500"}`}></div>
                            <div>
                              <div className="font-medium text-gray-200">{trade.Symbol}</div>
                              <div className={`text-[14px] ${trade.Side === "buy" ? "text-[#05b288]" : "text-red-500"}`}>
                                {trade.Side.charAt(0).toUpperCase() + trade.Side.slice(1)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-200">{trade.Size.toFixed(2)} <span className="text-gray-400">{trade.Symbol.replace('USD', '')}</span></td>
                        <td className="py-3 px-4 font-medium text-gray-200">{parseFloat(trade.AverageFillPrice).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={`${trade.State === "filled" ? "bg-[#DAF0E1] border-[#05b288] border-[1px] text-[#006038]" : "bg-[#FCDAE2] border-[#05b288] border-[1px] text-[#801D18]"} w-12 px-2 py-1 rounded-full text-[14px]`}>
                            {trade.State}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-200 text-right">{parseFloat(trade.PaidCommission).toFixed(2)} <span className="text-gray-400">USDT</span></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-gray-400">No trades found</td>
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
                className="bg-[#05b288] hover:bg-[#06a57f]"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <span className="mx-4 text-sm font-medium text-gray-200">Page {page}</span>
              <Button
                size="sm"
                disabled={!nextPage}
                onClick={() => nextPage && setPage(nextPage)}
                className="bg-[#05b288] hover:bg-[#06a57f]"
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
