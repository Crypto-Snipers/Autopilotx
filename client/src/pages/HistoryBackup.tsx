
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon } from "lucide-react";
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




  // Mock data for testing
  const mockTrades: TradeData[] = [
    {
      CreatedAt: "2025-08-15T10:30:00Z",
      Side: "buy",
      Size: 2,
      State: "filled",
      AverageFillPrice: "2800",
      PaidCommission: "5",
      Symbol: "ETHUSD",
    },
    {
      CreatedAt: "2025-08-16T14:45:00Z",
      Side: "sell",
      Size: 1,
      State: "filled",
      AverageFillPrice: "42000",
      PaidCommission: "10",
      Symbol: "BTCUSD",
    },
    {
      CreatedAt: "2025-08-17T09:10:00Z",
      Side: "buy",
      Size: 5,
      State: "canceled",
      AverageFillPrice: "41000",
      PaidCommission: "0",
      Symbol: "BTCUSD",
    },
  ];

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
      return res.data;
    } catch (error) {
      console.error("Error fetching trades, using mock:", error);
      return [];
    }
  };

  useEffect(() => {
    fetchClientTrades().then(setTrades);
  }, []);

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
                    <Button variant="outline" className="w-40 justify-start">
                      <CalendarIcon className="h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0">
                    <Calendar
                      mode="single"
                      selected={startDate || undefined}
                      onSelect={setStartDate}
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
                    <Button variant="outline" className="w-40 justify-start">
                      <CalendarIcon className="h-4 w-4 px-0" />
                      {endDate ? format(endDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0">
                    <Calendar
                      mode="single"
                      selected={endDate || undefined}
                      onSelect={setEndDate}
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
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-2 border-[#C4D3FF]">
                  <thead className="bg-[#DCE6FF]">
                    <tr>
                      <th className="p-2 text-left text-sm font-medium text-gray-600 border-2 border-[#C4D3FF]">Order Time</th>
                      <th className="p-2 text-left text-sm font-medium text-gray-600 border-2 border-[#C4D3FF]">Position</th>
                      <th className="p-2 text-left text-sm font-medium text-gray-600 border-2 border-[#C4D3FF]">Lot Size</th>
                      <th className="p-2 text-left text-sm font-medium text-gray-600 border-2 border-[#C4D3FF]">Executed Price</th>
                      <th className="p-2 text-left text-sm font-medium text-gray-600 border-2 border-[#C4D3FF]">Status</th>
                      <th className="p-2 text-left text-sm font-medium text-gray-600 border-2 border-[#C4D3FF]">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.length > 0 ? (
                      filteredTrades.map((trade, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            {format(new Date(trade.CreatedAt), "yyyy-MM-dd HH:mm:ss")}
                          </td>
                          <td className="p-2 flex items-center gap-3">
                            <div className={`w-1 h-12 rounded-full ${trade.Side === "buy" ? "bg-green-500" : "bg-red-500"}`}></div>
                            {trade.Symbol} - {trade.Side.toUpperCase()}
                          </td>
                          <td className="p-2">{trade.Size}</td>
                          <td className="p-2">{trade.AverageFillPrice}</td>
                          <td className="p-2">{trade.State}</td>
                          <td className="p-2">{trade.PaidCommission}</td>
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
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
