import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import CongratulationsPopup from "@/components/congratulationsPopup";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import PerformanceCard, { PerformanceData } from "@/components/PerformanceCard";
import Lowheader from "@/components/Lowheader";
import { getSessionItem } from "@/lib/sessionStorageUtils";
import { apiRequest } from "@/lib/queryClient";

type StrategyViewType = "all" | "deployed";

interface Strategy {
  MaxDrawdown: number;
  WinRate: number;
  Returns: number;
  TotalTrades: number;
  description: string;
  status: string;
  _id: string;
  name: string;
  token: string;
  type: string;
  leverage: string;
  margin: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  growth?: string;
  win_rate?: number;
  total_trades: string;
  start_date: string;
  BTC?: boolean;
  ETH?: boolean;
  SOL?: boolean;
}

type StrategyResponse = {
  strategies: Strategy[];
};

type StrategyStatusResponse = {
  success: boolean;
  message: string;
}

export default function Strategies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCongratsPopupOpen, setIsCongratsPopupOpen] = useState(false);
  const [viewType, setViewType] = useState<StrategyViewType>("all");
  const [refreshKey, setRefreshKey] = useState(0); // Add this line for force refresh
  const [deployedStrategyNames, setDeployedStrategyNames] = useState<string[]>(
    () => {
      // Initialize from localStorage if available
      const cached = localStorage.getItem(`deployed_strategies_${user?.email}`);
      return cached ? JSON.parse(cached) : [];
    }
  );
  // const [strategyStatuses, setStrategyStatuses] = useState<Record<string, 'active' | 'paused'>>({});


  // Read status from backend on component mount
  useEffect(() => {
    if (!user?.email) return;

    async function fetchStrategyStatuses() {
      try {
        const email = user?.email || "";
        const res = await apiRequest<Record<string, "active" | "paused">>("GET", `/api/strategy/status?email=${encodeURIComponent(email)}`);

        // const statuses = res.json();

        // Only keep statuses for deployed strategies
        const filteredStatuses: Record<string, "active" | "paused"> = {};
        for (const [name, status] of Object.entries(res)) {
          if (
            deployedStrategyNames.includes(name) &&
            (status === "active" || status === "paused")
          ) {
            filteredStatuses[name] = status;
          }
        }
        // setStrategyStatuses(filteredStatuses);

        localStorage.setItem(
          `strategy_statuses_${email}`,
          JSON.stringify(filteredStatuses)
        );
      }
      catch (e) {
        // console.error("Failed to fetch strategy statuses from backend", e);
        // fallback: try localStorage
        const stored = localStorage.getItem(`strategy_statuses_${user?.email || ""}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            // setStrategyStatuses(parsed);
          } catch (e) {
            console.error("Failed to parse strategy statuses from localStorage", e);
          }
        }
      }
    }
    fetchStrategyStatuses();
  }, [user?.email, deployedStrategyNames]);


  // Check if there are any running trades for a strategy
  const checkRunningTrades = async (strategyName: string): Promise<boolean> => {
    try {
      const queryParams = new URLSearchParams({
        email: user?.email || "",
        strategy_name: strategyName
      });
      const apiUrl = `/api/running/trade?${queryParams.toString()}`;

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
      });

      if (!response.ok) return false;

      const result = await response.json();
      return result.message === "Trade is running";
    } catch (error) {
      console.error("Error checking running trades:", error);
      return false;
    }
  };

  // Handle strategy activation/deactivation
  const handleStrategyToggle = async (strategyName: string) => {
    if (!user?.email) {
      console.error("No user email found, cannot toggle strategy");
      toast({
        title: "Authentication Required",
        description: "Please log in to activate strategies.",
        variant: "destructive",
      });
      return;
    }

    // Check if broker is added by checking sessionStorage
    const brokerName = getSessionItem("broker_name", "");
    if (!brokerName) {
      toast({
        title: "Broker Required",
        description:
          "Please add your Broker first before activating strategies.",
        variant: "destructive",
      });
      return;
    }

    try {

      // If deactivating, check for running trades first
      if (deployedStrategyNames.includes(strategyName)) {
        const isTradeRunning = await checkRunningTrades(strategyName);
        if (isTradeRunning) {
          toast({
            title: "Trading in Progress",
            description: "Trading is running now. Please try again later.",
            variant: "destructive",
          });
          return;
        }

        console.log()

        // Call remove-strategy API for deactivation
        // const apiUrl = "/api/remove-strategy";
        // const apiUrl = new URL(
        //   baseUrl.startsWith("http")
        //     ? baseUrl
        //     : `${window.location.origin}${baseUrl}`
        // );
        // apiUrl.searchParams.append("email", user.email);
        // apiUrl.searchParams.append("strategy_name", strategyName);


        const response = await apiRequest("POST", `/api/remove-strategy?email=${encodeURIComponent(user.email)}&strategy_name=${encodeURIComponent(strategyName)}`);
        console.log("Deactivation api response:", response);

        // if (!response.success) {
        //   throw new Error(
        //     `Failed to deactivate strategy: ${response.statusText}`
        //   );
        // }

        const updatedNames = deployedStrategyNames.filter(
          (name) => name !== strategyName
        );
        setDeployedStrategyNames(updatedNames);

        // Update localStorage
        if (user?.email) {
          localStorage.setItem(
            `deployed_strategies_${user.email}`,
            JSON.stringify(updatedNames)
          );
        }

        // Show success message for deactivation
        toast({
          title: "Strategy Deactivated",
          description: `Successfully deactivated strategy: ${strategyName}`,
        });
        setIsCongratsPopupOpen(true);
      } else {

        // Activate strategy
        const queryParams = new URLSearchParams({
          email: user.email,
          strategy_name: strategyName
        });
        const url = `/api/add-strategy?${queryParams.toString()}`;

        const response = await apiRequest("POST", url);

        // if (!response.ok) {
        //   throw new Error(`Server responded with status: ${response.status}`);
        // }

        // const result = await response.json();
        console.log("Strategy activation result:", response);

        const updatedNames = [...deployedStrategyNames, strategyName];
        setDeployedStrategyNames(updatedNames);

        // Update localStorage
        if (user?.email) {
          localStorage.setItem(
            `deployed_strategies_${user.email}`,
            JSON.stringify(updatedNames)
          );
        }

        setIsCongratsPopupOpen(true);
      }

      // Refetch both queries to update the UI
      query.refetch();
      deployedStrategiesQuery.refetch();
    } catch (error) {
      console.error("Error toggling strategy:", error);
      toast({
        title: "Activation Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to activate strategy. Please try again.",
        variant: "destructive",
      });
    }
  };


  // Handle strategy pause/active
  const handleStrategyStatus = async (strategy: Strategy) => {
    if (!user?.email) {
      toast({
        title: "Authentication Required",
        description: "Please log in to manage strategies.",
        variant: "destructive",
      });
      return;
    }

    if (!deployedStrategyNames.includes(strategy.name)) {
      toast({
        title: "Strategy Not Active",
        description: "Please activate the strategy first before pausing/resuming.",
        variant: "destructive",
      });
      return;
    }

    try {
      const currentStatus = strategy.status || 'active';
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';

      console.log(`Setting status to '${newStatus}' for strategy '${strategy.name}'`);

      const res: StrategyStatusResponse = await apiRequest<StrategyStatusResponse>(
        "PUT",
        `/api/strategy/status?email=${encodeURIComponent(user.email)}`,
        {
          strategy_name: strategy.name,
          status: newStatus,
        }
      );

      // if (!res.ok) {
      //   const errorText = await res.text();
      //   throw new Error(`Failed to ${newStatus === 'active' ? 'resume' : 'pause'} strategy: ${res.status} ${res.statusText} - ${errorText}`);
      // }

      // const result = await res.json();
      if (!res.success) {
        throw new Error(res.message || "Strategy status update failed");
      }

      toast({
        title: `Strategy ${newStatus === 'active' ? 'Resumed' : 'Paused'}`,
        description: `Successfully ${newStatus === 'active' ? 'resumed' : 'paused'} strategy: ${strategy.name}`,
      });

      query.refetch();
      deployedStrategiesQuery.refetch();
    } catch (error) {
      console.error("Error toggling strategy status:", error);
      toast({
        title: "Status Update Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update strategy status. Please try again.",
        variant: "destructive",
      });
    }
  };



  // Fetch strategies based on view type
  const queryOptions = {
    queryKey: [
      viewType === "deployed" ? "deployed-strategies" : "strategies",
      user?.email,
    ] as const,
    queryFn: async (): Promise<Array<Strategy>> => {
      console.log("Fetching strategies with viewType:", viewType);

      if (viewType === "deployed") {
        if (!user?.email) {
          console.log(
            "No user email found, skipping deployed strategies fetch"
          );
          return [];
        }

        try {
          // Use relative path for apiRequest (it will handle URL building internally)
          const endpoint = `/api/strategies?email=${encodeURIComponent(user.email)}`;
          console.log("Fetching strategies from endpoint:", endpoint);

          const deployedStrategies = await apiRequest<Strategy[] | { strategies: Strategy[] }>("GET", endpoint);

          console.log("Deployed strategies received:", deployedStrategies);

          // Handle both array and object with strategies property
          const strategiesArray = Array.isArray(deployedStrategies)
            ? deployedStrategies
            : (deployedStrategies as { strategies: Strategy[] }).strategies;

          if (!Array.isArray(strategiesArray)) {
            console.error("Expected array but got:", deployedStrategies);
            throw new Error(
              "Invalid response format: expected array of strategies"
            );
          }

          console.log("Fetched strategies:", strategiesArray);

          return strategiesArray.map((strategy: Strategy) => ({
            ...strategy,
            isDeployed: true,
          }));
        } catch (err) {
          console.error("Error in deployed strategies fetch:", err);
          throw err;
        }
      } else {
        try {
          let apiUrl = "/api/strategies";
          if (user?.email) {
            apiUrl += `?email=${encodeURIComponent(user?.email ?? "")}`;
          }
          const response = await apiRequest<StrategyResponse>("GET", apiUrl);

          // const response: Response = await apiRequest("GET", `/api/strategies?email=${encodeURIComponent(user?.email ?? "")}`);
          // if (!response.ok) {
          //   // const errorText = await response.text();
          //   // console.error("All strategies error:", errorText);
          //   throw new Error("Failed to fetch strategies");
          // }

          // const data = await response.json();
          const data = Array.isArray(response) ? response : response.strategies;

          if (!Array.isArray(data)) {
            throw new Error("Invalid strategies format");
          }
          console.log("Fetched all strategies:", data);
          return data;
        } catch (err) {
          console.error("Error in all strategies fetch:", err);
          throw err;
        }
      }
    },
  };

  // Add event listeners separately
  const query = useQuery<Array<Strategy>, Error>(queryOptions);

  // Query to get deployed strategies to check which strategies are already deployed
  const deployedStrategiesQuery = useQuery<Array<Strategy>, Error>({
    queryKey: ["deployed-strategies-check", user?.email] as const,
    queryFn: async (): Promise<Array<Strategy>> => {
      if (!user?.email) {
        return [];
      }

      try {
        const json = await apiRequest<Strategy[] | { strategies: Strategy[] }>("GET", `/api/strategies/deployed?email=${encodeURIComponent(user.email)}`);
        console.log("Deployed strategies check response:", json);

        const data = Array.isArray(json) ? json : (json as { strategies: Strategy[] }).strategies;
        console.log("Deployed strategies data:", data);

        return data;
      } catch (err) {
        console.error("Error fetching deployed strategies for check:", err);
        return [];
      }
    },
  });

  useEffect(() => {
    if (query.error) {
      console.error("Query error:", query.error);
    }
    console.log("Query settled - data:", query.data, "error:", query.error);
  }, [query.data, query.error]);

  // Update the list of deployed strategy names whenever deployedStrategiesQuery data changes
  useEffect(() => {
    if (deployedStrategiesQuery.data) {
      const names = deployedStrategiesQuery.data.map(
        (strategy) => strategy.name
      );
      setDeployedStrategyNames(names);

      // Save to localStorage for persistence across reloads
      if (user?.email) {
        localStorage.setItem(
          `deployed_strategies_${user.email}`,
          JSON.stringify(names)
        );
      }

      console.log("Deployed strategy names:", names);
    }
  }, [deployedStrategiesQuery.data, user?.email]);

  // Get the raw data from the query
  const { data: rawStrategies, isLoading, error } = query;

  // Filter strategies based on the view type
  const strategies = React.useMemo(() => {
    if (!rawStrategies || !Array.isArray(rawStrategies)) return [];

    if (viewType === "deployed") {
      // For deployed view, show only deployed strategies
      return rawStrategies.filter((strategy: Strategy) =>
        deployedStrategyNames.includes(strategy.name)
      );
    } else if (viewType === "all") {
      // For all view, show all strategies except deployed ones
      return rawStrategies.filter(
        (strategy: Strategy) => !deployedStrategyNames.includes(strategy.name)
      );
    } else {
      // For marketplace view, also exclude deployed strategies
      return rawStrategies.filter(
        (strategy: Strategy) => !deployedStrategyNames.includes(strategy.name)
      );
    }
  }, [rawStrategies, viewType, deployedStrategyNames]);



  console.log("Current state:", {
    rawStrategies,
    filteredStrategies: strategies,
    isLoading,
    error,
    viewType,
    userEmail: user?.email,
    deployedStrategyNames,
  });

  console.log("Strategies data:", strategies);
  console.log("Fetched all strategies:", rawStrategies);
  // Render error message if there's an error
  if (error) {
    return (
      <div className="flex min-h-screen bg-neutral-50">
        <Sidebar />
        <div className="flex-1 md:ml-64 p-6">
          <Header />
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  Failed to load strategies. {error.message}
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => query.refetch()}
                    className="text-sm font-medium text-red-700 hover:text-red-600 focus:outline-none focus:underline transition duration-150 ease-in-out"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-[#2d3139]">
      <Sidebar />

      <div className="flex-1 md:ml-[14rem]">
        <Header />
        <Lowheader />

        <main className="px-4 py-2 md:p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold">Strategies</h1>
            {isLoading && (
              <div className="flex items-center text-sm text-gray-500">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Loading...
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div
              className="inline-flex rounded-md shadow-sm bg-neutral-50 dark:bg-[#17181d] p-[10px]"
              role="group"
            >
              <Button
                variant="strategy"
                onClick={() => setViewType("all")}
                className={`m-2 ${viewType === "all"
                  ? "bg-black text-white"
                  : "bg-gray-200 text-black"
                  }`}
              >
                {viewType === "all" && (
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                )}
                All Strategies
              </Button>

              <Button
                variant="strategy"
                onClick={() => setViewType("deployed")}
                className={`m-2 ${viewType === "deployed"
                  ? "bg-black text-white"
                  : "bg-gray-200 text-black"
                  }`}
              >
                {viewType === "deployed" && (
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                )}
                Deployed Strategies
              </Button>

            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              Loading {viewType === "deployed" ? "deployed " : ""}strategies...
            </div>
          ) : viewType === "deployed" && !user?.email ? (
            <div className="text-center py-12">
              <p className="text-neutral-500">
                Please log in to view deployed strategies.
              </p>
            </div>
          ) : viewType === "all" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {query.data?.map((strategy) => (
                <PerformanceCard
                  key={strategy._id}
                  data={{
                    _id: strategy._id,
                    name: strategy.name,
                    type: strategy.type,
                    description: strategy.description,
                    leverage: strategy.leverage,
                    margin: strategy.margin,
                    created_at: strategy.created_at,
                    updated_at: strategy.updated_at,
                    is_active: strategy.is_active,
                    isDeployed: deployedStrategyNames.includes(strategy.name),
                    BTC: strategy.BTC || false,
                    ETH: strategy.ETH || false,
                    SOL: strategy.SOL || false,
                    TotalTrades: strategy.TotalTrades || 0,
                    Returns: strategy.Returns || 0,
                    WinRate: strategy.WinRate || 0,
                    MaxDrawdown: strategy.MaxDrawdown || 0,
                  }}
                  onDeploy={() => {
                    // Force refresh the strategies list
                    query.refetch();
                    deployedStrategiesQuery.refetch();
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.isArray(strategies) && strategies.length > 0 ? (
                strategies.map((strategy, index: number) => (

                  <Card
                    key={strategy._id}
                    className="rounded-3xl border p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-0">
                      {/* Header */}
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {strategy.name}
                        </div>
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full dark:bg-green-100">
                          +{strategy.Returns ?? "0"}%
                        </span>
                      </div>


                      {/* Description */}
                      <p className="text-sm text-gray-700 dark:text-white mb-3">
                        {strategy.description}
                      </p>

                      {/* Win Rate */}
                      <div className="text-sm font-semibold text-gray-800 bg-gray-50 dark:bg-[#17181d] mb-1 flex justify-between">
                        <span>Win Rate</span>
                        <span>{strategy.WinRate ?? "0"}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-[#17181d] rounded-full mb-4">
                        <div
                          className="h-2 bg-green-500 rounded-full"
                          style={{ width: `${strategy.WinRate ?? 0}%` }}
                        />
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-col gap-2 bg-gray-50 dark:bg-[#17181d] rounded-xl p-4 text-sm text-gray-700 mb-4">
                        <div className="flex justify-between">
                          <div className="text-gray-500">Max Drawdown</div>
                          <div className="font-semibold">
                            {strategy.MaxDrawdown ?? "0"}%
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-gray-500">Total Trades:</div>
                          <div className="font-semibold">
                            {strategy.TotalTrades ?? "0"
                            }
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between gap-2">
                        <Button
                          variant={
                            strategy.status === 'paused'
                              ? "secondary"
                              : "secondary"
                          }
                          className={`w-full text-sm font-medium py-2 px-4 rounded-md !bg-[#0e65f2] hover:!bg-[#0d5ce8] dark:!bg-[#0e65f2] dark:hover:!bg-[#0d5ce8] ${!deployedStrategyNames.includes(strategy.name)
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                            }`}
                          onClick={() => handleStrategyStatus(strategy)}
                          disabled={!deployedStrategyNames.includes(strategy.name)}
                        >
                          {strategy.status === 'paused' ? (
                            "Resume"
                          ) : (
                            "Pause"
                          )}
                        </Button>

                        <Button
                          variant={
                            deployedStrategyNames.includes(strategy.name)
                              ? "destructive"
                              : "default"
                          }
                          className="w-full text-sm font-medium py-2 px-4 rounded-md transition-colors duration-150 dark:!bg-[#0e65f2] dark:hover:!bg-[#0d5ce8]"
                          onClick={() => handleStrategyToggle(strategy.name)}
                        >
                          {deployedStrategyNames.includes(strategy.name)
                            ? "Deactivate"
                            : "Activate"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-neutral-500">
                    {viewType === "deployed" ? (
                      <div className="p-6 flex flex-col items-center justify-center h-64 space-y-4">
                        <svg
                          width="184"
                          height="183"
                          viewBox="0 0 184 183"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M113.948 123.159L87.8705 117.358L82.1548 146.449L107.97 149.279L114.662 123.171L113.948 123.159Z"
                            fill="white"
                          />
                          <path
                            d="M121.585 122.738L133.218 150.804L156.221 145.961C156.221 145.961 160.576 145.546 160.716 145.808C160.857 146.07 148.089 116.632 148.089 116.632L121.585 122.939V122.738Z"
                            fill="white"
                          />
                          <path
                            d="M87.675 118.352L93.1101 90.8839L95.1536 80.7213L96.0503 80.7457L116.003 76.5733L129.673 73.7124L132.553 80.7396L135.895 88.4683L139.738 97.3438L145.161 109.879L148.553 117.7L146.18 118.133L140.952 118.956L135.755 120.048L129.863 121.542L125.684 122.701L122.14 123.891L117.48 112.399L114.655 123.928L102.364 120.67L94.2996 119.34L87.5469 118.584L87.675 118.352Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M106.262 156.91L105.786 158.673L104.084 159.143C104.084 159.143 93.9948 160.674 91.3352 160.949C88.6756 161.223 79.9831 161.888 77.3845 161.748C74.7798 161.613 71.1015 161.949 69.3508 160.857C67.6001 159.759 69.1495 155.696 69.5887 155.611C70.0279 155.532 78.1104 151.158 78.4825 150.926C78.8485 150.694 106.262 156.91 106.262 156.91Z"
                            fill="white"
                          />
                          <path
                            d="M127.746 68.0823L144.417 61.7139C145.723 63.9709 146.375 66.5512 146.302 69.1559C146.144 73.4198 146.528 73.2002 145.65 76.3356C144.771 79.4649 144.417 81.3132 142.966 83.5885C141.514 85.8638 140.263 87.645 139.049 88.4563C138.189 89.0175 137.293 89.5055 136.353 89.9264L129.814 74.1945L127.746 68.0823Z"
                            fill="white"
                          />
                          <path
                            d="M74.316 70.2721C74.316 70.2721 86.7112 74.9569 91.2862 74.6275C91.4631 77.5555 90.8897 80.4835 89.6148 83.1309C87.4981 87.4375 86.2781 90.2496 83.7039 92.3541C81.1297 94.4586 78.0248 97.8197 71.0037 96.5204C63.9826 95.2211 59.0172 88.4684 59.0172 88.4684C59.0172 88.4684 54.9546 82.771 54.2043 81.5022C53.454 80.2334 51.5935 77.3054 51.5935 77.3054C51.5935 77.3054 51.3861 76.9455 49.9099 77.22C48.4276 77.4884 45.8534 77.769 45.4569 76.9516C45.0604 76.1403 45.4569 75.2375 45.4569 75.2375C45.4569 75.2375 44.2613 75.4693 43.7367 74.7312C43.2121 73.9931 43.7367 73.0903 43.7367 73.0903C43.7367 73.0903 42.596 73.0598 42.2971 72.1448C41.9982 71.2298 41.7847 70.8089 42.2117 70.022C42.6326 69.2412 42.7363 68.3994 44.8469 67.4112C46.9575 66.4169 51.3312 64.7455 51.3312 64.7455C51.3312 64.7455 56.0953 63.3486 58.9379 63.4889C61.7805 63.6353 65.1538 63.8244 67.8988 65.1603C70.6438 66.4962 72.9801 67.9358 74.0903 69.4364C75.1883 70.937 74.316 70.2721 74.316 70.2721Z"
                            fill="white"
                          />
                          <path
                            d="M45.3412 75.1888C45.0728 75.6097 44.8288 76.1221 44.9508 76.6345C45.0484 77.0554 45.4083 77.3299 45.7926 77.4824C46.7869 77.885 48.0191 77.7569 49.0622 77.6227C49.6417 77.5495 50.209 77.4519 50.7763 77.3238C50.8678 77.2872 50.9654 77.275 51.063 77.2933C51.1606 77.3116 51.246 77.3665 51.3131 77.4336C51.5449 77.641 51.7462 77.8789 51.9109 78.1412C52.3013 78.7024 52.6063 79.3246 52.9479 79.9224C53.4542 80.8191 53.9849 81.7036 54.5278 82.5759C55.6258 84.3266 56.797 86.0163 58.0414 87.6633C59.2675 89.2859 60.5302 90.8963 62.0735 92.2322C63.3301 93.3119 64.7087 94.2452 66.1788 95.0199C67.3561 95.6543 68.6005 96.1667 69.8815 96.5327C72.0592 97.161 74.3589 97.2403 76.5732 96.7584C78.5984 96.2765 80.4894 95.3615 82.1303 94.0805C83.8261 92.7568 85.3145 91.183 86.5406 89.4201C87.7789 87.6633 88.822 85.7723 89.6455 83.7837C90.4141 81.9781 90.9875 80.0932 91.3596 78.1656C91.6463 76.6101 91.811 74.9814 91.5975 73.4076C91.5548 73.1148 91.4999 72.822 91.4267 72.5353C91.4023 72.4682 91.3535 72.4072 91.2925 72.3767C91.2315 72.3401 91.1522 72.334 91.0851 72.3523C91.018 72.3706 90.957 72.4133 90.9204 72.4804C90.8838 72.5475 90.8716 72.6146 90.8838 72.6878C91.0424 73.2917 91.1217 73.9139 91.1278 74.5361C91.1461 75.3047 91.1034 76.0794 90.9997 76.8419C90.7557 78.6597 90.3104 80.447 89.676 82.1733C88.9806 84.1192 88.0778 85.9797 86.992 87.7365C85.9001 89.5238 84.5703 91.1586 83.0453 92.586C81.5752 93.9707 79.8489 95.0565 77.9579 95.7702C75.9876 96.49 73.8709 96.7035 71.7969 96.3924C69.1983 95.9959 66.7766 94.8735 64.5928 93.44C63.0373 92.4274 61.6343 91.1952 60.4265 89.78C59.115 88.2245 57.895 86.5958 56.736 84.9244C55.5831 83.253 54.4973 81.5328 53.4908 79.7638C53.1553 79.1721 52.8442 78.556 52.466 77.9826C52.1671 77.5251 51.7523 76.8968 51.1911 76.7504C50.941 76.6894 50.697 76.7809 50.4408 76.8297C50.1663 76.8907 49.8918 76.9395 49.6112 76.9883C49.0317 77.0859 48.4461 77.153 47.8605 77.1774C47.342 77.214 46.8174 77.1774 46.305 77.0737C46.1159 77.031 45.9268 76.9578 45.7621 76.8541C45.6462 76.787 45.5608 76.6894 45.4998 76.5735C45.4571 76.4393 45.451 76.299 45.4876 76.1648C45.5547 75.9208 45.6645 75.6829 45.8109 75.4755C46.0061 75.1644 45.5303 74.8838 45.3412 75.1888Z"
                            fill="#010E30"
                          />
                          <path
                            d="M73.8525 59.9936C73.8525 59.9936 71.7663 67.7894 71.7358 69.5035C71.7358 69.5035 78.0432 72.0899 80.5015 72.5779C82.9598 73.0659 88.7426 74.902 89.7735 74.8837C90.8044 74.8654 91.2802 74.6275 91.2802 74.6275L91.0911 73.926L92.2257 76.0061L95.294 80.8983L116.668 76.5551L128.533 74.1456L129.607 73.926L127.941 67.887C127.941 67.887 135.432 65.874 136.872 65.3494C138.305 64.8309 144.869 62.0859 144.869 62.0859C144.869 62.0859 141.819 57.0595 140.916 55.8151C140.013 54.5646 134.572 47.9156 131.418 45.7684C128.271 43.6212 122.97 40.9555 122.97 40.9555C122.97 40.9555 117.699 37.875 110.324 38.2715L103.462 38.2349L96.0687 39.5281C96.0687 39.5281 86.0159 42.5659 81.2823 47.1043C76.5487 51.6427 73.8525 59.9936 73.8525 59.9936Z"
                            fill="#E9E9E9"
                          />
                          <path
                            d="M144.179 61.8482C145.125 63.6904 145.717 65.6973 145.912 67.7591C146.137 69.9612 146.076 72.1816 145.723 74.3654C145.387 76.5736 144.795 78.733 143.96 80.8009C143.222 82.698 142.221 84.4792 140.983 86.0896C139.934 87.4133 138.659 88.6211 137.116 89.3348C136.945 89.4141 136.774 89.4812 136.603 89.5422C136.268 89.6642 136.414 90.2071 136.75 90.0851C138.384 89.4934 139.763 88.3649 140.898 87.0656C142.233 85.4979 143.319 83.7411 144.131 81.8501C145.052 79.7639 145.729 77.5679 146.137 75.3231C146.564 73.0722 146.705 70.7725 146.546 68.4789C146.412 66.3195 145.887 64.2028 145.003 62.2325C144.893 62.0007 144.783 61.775 144.661 61.5554C144.49 61.2382 144.002 61.5188 144.173 61.836L144.179 61.8482Z"
                            fill="#010E30"
                          />
                          <path
                            d="M90.5604 41.3643C97.2521 39.1195 104.304 38.1313 111.355 38.4546C113.728 38.5644 116.107 38.8206 118.395 39.4916C120.64 40.1565 122.787 41.1386 124.891 42.1512C126.916 43.1211 128.893 44.213 130.698 45.555C132.913 47.2325 134.968 49.1174 136.841 51.1731C139.501 54.0706 141.782 57.2975 143.63 60.7684C143.887 61.2503 144.137 61.7444 144.381 62.2324C144.539 62.5557 145.027 62.2751 144.863 61.9518C143.057 58.2552 140.776 54.8148 138.073 51.7099C136.127 49.459 133.968 47.4033 131.632 45.5672C130.058 44.3533 128.374 43.2858 126.605 42.383C124.531 41.2911 122.39 40.3334 120.194 39.5099C115.723 37.8629 110.831 37.686 106.103 37.9056C101.345 38.1252 96.636 38.9304 92.0793 40.3029C91.5242 40.4676 90.9752 40.6445 90.4262 40.8275C90.0846 40.9434 90.2371 41.4863 90.5787 41.3704L90.5604 41.3643Z"
                            fill="#010E30"
                          />
                          <path
                            d="M71.8396 69.5765C72.4008 65.5932 73.4317 61.6953 74.9018 57.9499C75.6399 56.0772 76.4878 54.2472 77.4394 52.4782C77.903 51.5876 78.4215 50.7275 78.9949 49.8979C79.5866 49.0988 80.2637 48.3607 81.014 47.7019C82.7891 46.1281 84.6557 44.658 86.6016 43.2977C86.8395 43.1269 86.7053 42.6633 86.382 42.7853L85.9001 42.9744C85.5646 43.1025 85.711 43.6454 86.0526 43.5173L86.5345 43.3282L86.3149 42.8158C84.5764 44.0602 82.8745 45.3656 81.258 46.7503C80.4711 47.3969 79.7452 48.1167 79.0803 48.8853C78.4459 49.6722 77.8786 50.514 77.3967 51.4046C74.2674 56.98 72.2056 63.0861 71.3089 69.4179C71.2906 69.4911 71.3028 69.5643 71.3333 69.6253C71.3699 69.6863 71.4248 69.7351 71.4919 69.7595C71.5651 69.7778 71.6383 69.7717 71.7054 69.7351C71.7725 69.7107 71.8213 69.6497 71.8396 69.5765Z"
                            fill="#010E30"
                          />
                          <path
                            d="M80.8736 57.9439C81.2091 59.4506 81.996 60.8109 83.1306 61.854C83.399 62.098 83.7955 61.7015 83.5271 61.4575C82.4657 60.4815 81.7276 59.2066 81.4165 57.8036C81.3372 57.4498 80.7943 57.6023 80.8736 57.9561V57.9439Z"
                            fill="#010E30"
                          />
                          <path
                            d="M91.0852 42.474L93.7082 45.4691C93.8729 45.6948 94.0925 45.8717 94.3426 45.9876C94.6232 46.0669 94.9282 46.0547 95.2027 45.9632C96.4715 45.646 97.6305 44.9933 98.5638 44.0722C99.1921 43.45 99.7289 42.5899 99.5215 41.7298C99.3751 41.132 98.8932 40.6806 98.4357 40.2658L97.5939 39.5094C97.1791 39.1373 96.7521 38.7469 96.2275 38.5395C95.4101 38.2101 94.4585 38.3626 93.6716 38.7713C92.8908 39.18 92.2503 39.8144 91.6708 40.4793C91.2377 40.9673 90.8046 41.6017 91.0059 42.2239L91.0852 42.474Z"
                            fill="white"
                          />
                          <path
                            d="M90.8835 42.6756L92.805 44.8777C93.11 45.2254 93.4028 45.6097 93.7383 45.933C93.8786 46.0733 94.0433 46.1831 94.2263 46.2502C94.4093 46.3173 94.6106 46.3478 94.8058 46.3295C95.5988 46.2624 96.4223 45.9025 97.1116 45.5182C97.8314 45.1278 98.4719 44.6154 99.0148 44.0054C99.5211 43.4137 99.9298 42.6634 99.8139 41.8582C99.698 41.053 99.0636 40.4918 98.5024 39.9733C97.8802 39.4121 97.258 38.7228 96.4833 38.3629C95.7269 38.0396 94.8729 38.0152 94.1043 38.3019C93.2198 38.613 92.4878 39.2169 91.8595 39.8818C91.2556 40.5162 90.4626 41.3519 90.7371 42.3157C90.7615 42.3828 90.8042 42.4438 90.8713 42.4804C90.9323 42.517 91.0116 42.5231 91.0787 42.5048C91.1519 42.4865 91.2068 42.4377 91.2434 42.3767C91.28 42.3157 91.2922 42.2364 91.2739 42.1693C91.0726 41.4678 91.7558 40.809 92.195 40.3454C92.683 39.7903 93.2686 39.3328 93.9213 38.9912C94.5557 38.6618 95.2938 38.5825 95.9831 38.7716C96.7029 38.9912 97.2519 39.5951 97.7948 40.0831C98.2889 40.5284 98.9294 40.9859 99.1917 41.6203C99.454 42.2547 99.1429 42.9745 98.7342 43.493C97.868 44.591 96.5199 45.3657 95.1718 45.7073C94.9827 45.7683 94.7814 45.7927 94.5801 45.7805C94.3788 45.7378 94.1958 45.628 94.0677 45.4633C93.7627 45.14 93.476 44.7923 93.1832 44.4568L91.2861 42.2852C91.0482 42.0046 90.6517 42.4011 90.8835 42.6756Z"
                            fill="#010E30"
                          />
                          <path
                            d="M75.5725 39.8637C76.762 40.0223 77.6587 39.3574 78.7689 39.1805C80.5074 38.906 82.1239 38.1374 83.8075 37.6067C86.6806 36.6917 89.7184 36.4843 92.7135 36.1183C93.3967 36.0573 94.0677 35.9231 94.7265 35.7218C95.1962 35.551 95.6598 35.3497 96.1051 35.124C97.075 34.6604 98.0937 34.2944 99.1429 34.0382C99.9115 33.8491 100.155 33.0134 99.9298 32.2814C99.8261 31.952 99.6248 31.6653 99.3625 31.4457C99.0941 31.2261 98.7769 31.0919 98.4353 31.0492C98.5512 30.1037 98.661 29.1399 98.5024 28.2005C98.3499 27.2611 97.8985 26.3278 97.1116 25.791C96.3247 25.2542 95.1657 25.2298 94.4642 25.8642C93.8176 22.7105 90.6822 20.2644 87.4675 20.4047C86.2109 20.4352 84.997 20.8927 84.0271 21.6918C83.0877 22.5092 82.4777 23.7536 82.5509 24.9858C81.8738 24.2599 80.9893 23.7719 80.0133 23.5828C79.0373 23.3998 78.0308 23.534 77.1402 23.961C76.2496 24.388 75.5176 25.0956 75.054 25.974C74.5904 26.8524 74.4196 27.8528 74.566 28.8288C74.6758 29.5791 75.0479 30.3843 75.7555 30.6771C74.2915 30.5795 72.6445 30.8845 71.7722 32.0679C71.2354 32.806 71.089 33.7759 71.2293 34.6787C71.4001 35.5754 71.7478 36.4294 72.248 37.198C73.0105 38.4546 74.1146 39.6685 75.5725 39.8637Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M75.5727 40.144C76.4999 40.2538 77.3173 39.8756 78.1835 39.6072C78.6349 39.4669 79.1046 39.4181 79.5621 39.3083C80.0684 39.1924 80.5625 39.0399 81.0627 38.8691C82.0326 38.5397 82.9903 38.1493 83.9724 37.8443C84.9728 37.5393 85.9976 37.2953 87.0285 37.1184C89.1086 36.7524 91.2192 36.606 93.3054 36.3132C93.7995 36.2522 94.2875 36.1485 94.7633 35.996C95.2452 35.8252 95.7149 35.6239 96.1724 35.3921C97.124 34.9407 98.1183 34.5808 99.137 34.3124C100.009 34.0928 100.406 33.2937 100.259 32.4397C100.174 32.0005 99.9544 31.5979 99.625 31.2929C99.2956 30.9879 98.8747 30.7988 98.4294 30.75L98.71 31.0306C98.9113 29.4019 99.0394 27.5902 97.9597 26.2116C97.0874 25.0892 95.3855 24.65 94.2509 25.6504L94.7206 25.7724C94.2631 23.5947 92.6771 21.7342 90.6763 20.7887C88.5291 19.7761 85.8329 19.8493 83.9297 21.3743C83.3929 21.8013 82.9598 22.3503 82.667 22.9725C82.3742 23.5947 82.2339 24.2779 82.2522 24.9672L82.7341 24.7659C82.057 24.0461 81.1847 23.5459 80.2209 23.3263C79.2571 23.1128 78.2506 23.186 77.3295 23.552C76.4084 23.918 75.6215 24.5463 75.0664 25.3637C74.5113 26.1811 74.2185 27.1449 74.2185 28.1331C74.2063 29.1701 74.5601 30.4328 75.5971 30.8903L75.7374 30.3657C73.9013 30.2559 71.7846 30.7805 71.0953 32.6898C70.3755 34.6784 71.5223 36.911 72.7911 38.4177C73.4865 39.2412 74.3954 39.9366 75.4873 40.0952C75.5605 40.1135 75.6337 40.1013 75.6947 40.0708C75.7618 40.0342 75.8045 39.9793 75.8289 39.9122C75.8472 39.839 75.8411 39.7658 75.7984 39.6987C75.7618 39.6316 75.7008 39.5889 75.6276 39.5645C73.8525 39.3083 72.663 37.5881 71.9493 36.0814C71.5406 35.2213 71.2966 34.2331 71.504 33.2876C71.5894 32.8728 71.7663 32.4885 72.0286 32.153C72.2909 31.8175 72.6203 31.5491 73.0046 31.3661C73.8403 30.9513 74.8163 30.8781 75.7313 30.933C75.9997 30.9452 76.1278 30.5182 75.8716 30.4084C75.0725 30.0546 74.798 29.1152 74.7736 28.3039C74.7553 27.4438 74.981 26.602 75.4263 25.87C75.8655 25.1319 76.5121 24.5463 77.2868 24.1864C78.0615 23.8265 78.9277 23.7045 79.7756 23.8387C80.7455 23.9851 81.6422 24.4426 82.3254 25.1502C82.3681 25.1868 82.4169 25.2112 82.4718 25.2234C82.5267 25.2356 82.5816 25.2295 82.6304 25.2051C82.6792 25.1868 82.728 25.1502 82.7585 25.1014C82.789 25.0526 82.8073 25.0038 82.8073 24.9489C82.789 24.3877 82.8988 23.8265 83.1184 23.308C83.338 22.7895 83.6735 22.3259 84.0883 21.9538C84.9728 21.1791 86.0952 20.7216 87.2725 20.6606C89.3038 20.5203 91.2924 21.4475 92.6405 22.942C93.3969 23.7777 93.9154 24.8025 94.1533 25.9005C94.1655 25.9493 94.196 25.992 94.2265 26.0225C94.2631 26.0591 94.3058 26.0835 94.3546 26.0957C94.4034 26.1079 94.4522 26.1079 94.501 26.0957C94.5498 26.0835 94.5925 26.0591 94.6291 26.0225C94.8548 25.8395 95.1232 25.7114 95.4099 25.6565C95.6966 25.6016 95.9955 25.6138 96.2761 25.6931C96.8556 25.8578 97.3497 26.2421 97.6608 26.7606C98.466 28.0294 98.2952 29.591 98.1244 31.0062C98.1061 31.1709 98.2708 31.2685 98.405 31.2868C98.7588 31.3356 99.0882 31.5125 99.3261 31.7809C99.564 32.0493 99.6982 32.3909 99.7104 32.7508C99.7165 32.8972 99.6982 33.0497 99.6433 33.19C99.5884 33.3303 99.503 33.4584 99.3993 33.556C99.2712 33.6536 99.1248 33.7146 98.9723 33.7451C98.7344 33.8061 98.4965 33.8671 98.2586 33.9403C97.3314 34.2392 96.4286 34.5991 95.5563 35.0261C95.1171 35.2396 94.6657 35.4165 94.1899 35.5385C93.7263 35.6483 93.2627 35.7276 92.7869 35.7825C90.841 36.0204 88.8829 36.1912 86.9431 36.5328C85.9671 36.6975 85.0033 36.9171 84.0578 37.1916C83.1367 37.4661 82.2461 37.8199 81.3433 38.131C80.8431 38.3201 80.3368 38.4787 79.8183 38.619C79.2998 38.7593 78.8057 38.8081 78.3055 38.9423C77.3844 39.1741 76.5365 39.6499 75.5544 39.5401C75.2128 39.5401 75.2189 40.1013 75.5727 40.144Z"
                            fill="#010E30"
                          />
                          <path
                            d="M93.3299 29.6706C89.4503 28.2066 86.6748 28.6763 83.942 30.4026C82.8806 31.0431 81.9961 31.9337 81.3617 32.9951C80.9164 33.8247 80.6236 34.7275 80.5016 35.6669C80.1966 37.5457 80.4528 39.4672 81.2519 41.1935C82.0754 42.8954 83.5211 44.3167 85.2901 44.9633C86.87 45.5428 88.7488 45.8844 90.3775 45.4452C92.0062 45.006 94.0558 43.8226 95.0623 42.7734C97.2339 40.4798 97.423 38.7962 97.2644 35.8316C97.1302 33.2574 95.3429 30.7442 93.0432 29.5669L93.3299 29.6706Z"
                            fill="white"
                          />
                          <path
                            d="M93.4031 29.4018C91.6585 28.743 89.7858 28.3465 87.9131 28.5966C86.2356 28.8406 84.6496 29.4994 83.2893 30.5059C82.5085 31.0488 81.8375 31.732 81.3007 32.5128C80.7578 33.3851 80.3979 34.355 80.2454 35.3737C79.8794 37.3745 80.1356 39.4424 80.9774 41.2968C81.7338 42.9133 83.0331 44.2248 84.6435 44.9995C85.5463 45.4082 86.504 45.6888 87.4861 45.823C88.4804 45.9938 89.5052 45.9511 90.4812 45.7071C91.3413 45.457 92.1709 45.1032 92.9456 44.6579C93.7142 44.2492 94.4218 43.7429 95.0623 43.1573C96.1969 42.0776 97.1119 40.6807 97.4108 39.1252C97.545 38.3688 97.5999 37.6002 97.5694 36.8316C97.5816 35.9593 97.4779 35.0809 97.2522 34.2391C96.7276 32.5372 95.6723 31.0488 94.2449 29.9935C93.9033 29.7434 93.5434 29.5177 93.1652 29.3286C92.848 29.1639 92.5613 29.6458 92.8785 29.8166C94.3608 30.5974 95.5564 31.8357 96.2884 33.3485C96.996 34.7942 97.0753 36.429 96.9716 38.015C96.8923 39.418 96.3677 40.7661 95.471 41.8519C94.4157 43.1634 93.0249 44.0906 91.4877 44.7616C90.7008 45.1215 89.8529 45.3289 88.9867 45.3777C88.0107 45.396 87.0408 45.2557 86.1075 44.9629C85.2718 44.7311 84.4788 44.359 83.7651 43.8588C83.1002 43.3708 82.5207 42.773 82.0571 42.0837C81.0018 40.5465 80.5565 38.6677 80.6358 36.8194C80.6602 35.8495 80.8432 34.8918 81.1787 33.9829C81.5081 33.1167 82.0327 32.3359 82.7098 31.7015C83.8993 30.5852 85.345 29.78 86.9249 29.3652C88.5475 28.9382 90.225 29.0602 91.8354 29.4994C92.3051 29.6275 92.7687 29.7861 93.2323 29.9569C93.5739 30.085 93.7203 29.5421 93.3848 29.414L93.4031 29.4018Z"
                            fill="#010E30"
                          />
                          <path
                            d="M86.1989 40.7909C86.3209 41.0959 86.3636 41.4314 86.327 41.7547C86.2904 42.0841 86.1684 42.3952 85.9793 42.6636C85.961 42.6941 85.9427 42.7307 85.9366 42.7673C85.9305 42.8039 85.9305 42.8405 85.9427 42.8771C85.9488 42.9137 85.9671 42.9503 85.9915 42.9808C86.0159 43.0113 86.0403 43.0357 86.0769 43.054C86.1074 43.0723 86.144 43.0845 86.1806 43.0906C86.2172 43.0967 86.2538 43.0906 86.2904 43.0845C86.327 43.0723 86.3636 43.054 86.388 43.0357C86.4185 43.0113 86.4429 42.9808 86.4612 42.9503C86.6991 42.5965 86.8455 42.1878 86.8821 41.7608C86.9187 41.3338 86.8516 40.9068 86.6808 40.5164C86.6442 40.4554 86.5832 40.4066 86.51 40.3883C86.4368 40.37 86.3636 40.3822 86.2965 40.4188C86.2355 40.4554 86.1867 40.5164 86.1684 40.5896C86.1562 40.6567 86.1623 40.7299 86.1989 40.7909Z"
                            fill="#010E30"
                          />
                          <path
                            d="M88.0288 41.3031C88.7547 41.3031 88.7547 40.1807 88.0288 40.1807C87.3029 40.1746 87.3029 41.3031 88.0288 41.3031Z"
                            fill="#010E30"
                          />
                          <path
                            d="M85.1559 41.5775C85.8818 41.5775 85.8818 40.4551 85.1559 40.4551C84.43 40.4551 84.4361 41.5775 85.1559 41.5775Z"
                            fill="#010E30"
                          />
                          <path
                            d="M86.8392 39.656C86.9795 39.0765 87.2418 38.5275 87.6017 38.0517C87.7725 37.8016 87.9982 37.5881 88.2605 37.4356C88.5228 37.277 88.8095 37.1794 89.1145 37.1428C90.3406 36.9537 91.8534 37.2587 92.5793 38.3506C92.9148 38.863 93.0795 39.4669 93.049 40.0769C93.0185 40.6869 92.7989 41.2725 92.4146 41.7483C91.6216 42.7243 90.1698 43.3099 88.962 42.8158C88.2971 42.5291 87.7298 42.0472 87.3394 41.4372C87.1686 41.1566 87.0344 40.8638 86.9368 40.5527C86.8514 40.2416 86.8209 39.9183 86.8575 39.595C86.8819 39.2351 86.3207 39.2351 86.2963 39.595C86.2109 41.0651 87.0832 42.3339 88.3032 43.1025C89.6391 43.9443 91.4203 43.5234 92.5183 42.4742C93.0429 41.9801 93.4028 41.3396 93.5492 40.6381C93.6956 39.9366 93.6224 39.2046 93.3357 38.5397C92.7074 37.1001 91.1397 36.4962 89.6452 36.5328C88.7973 36.5511 87.9677 36.7646 87.3943 37.4234C86.8636 38.0151 86.4915 38.7288 86.3085 39.5035C86.2353 39.8573 86.7782 40.0098 86.8514 39.6499V39.656H86.8392Z"
                            fill="#010E30"
                          />
                          <path
                            d="M78.6103 151.005L70.6681 154.818C70.6681 154.818 68.2647 156.105 68.6246 158.484C68.9845 160.863 88.2605 158.954 88.2605 158.954C88.2605 158.954 82.2093 151.75 80.2573 151.609C78.3053 151.475 78.6103 151.005 78.6103 151.005Z"
                            fill="#E9E9E9"
                          />
                          <path
                            d="M79.8426 40.6199C79.9829 40.0343 80.2452 39.4914 80.6112 39.0156C80.782 38.7655 81.0077 38.552 81.27 38.3995C81.5323 38.2409 81.819 38.1433 82.124 38.1006C83.3501 37.9115 84.8629 38.2165 85.5888 39.3084C85.9243 39.8208 86.089 40.4247 86.0585 41.0347C86.028 41.6447 85.8084 42.2303 85.4241 42.7061C84.6311 43.6882 83.1854 44.2677 81.9715 43.7736C81.3066 43.4869 80.7393 43.005 80.3489 42.395C80.1781 42.1144 80.0439 41.8216 79.9463 41.5105C79.8609 41.1994 79.8304 40.8761 79.8609 40.5528C79.8853 40.1929 79.3241 40.1929 79.2997 40.5528C79.2143 42.0229 80.0866 43.2917 81.3066 44.0603C82.6425 44.9021 84.4237 44.4812 85.5217 43.432C86.0463 42.944 86.4001 42.3035 86.5465 41.5959C86.6929 40.8944 86.6197 40.1624 86.333 39.5036C85.7047 38.064 84.137 37.4601 82.6425 37.4967C81.7946 37.515 80.965 37.7285 80.3977 38.3873C79.867 38.979 79.4888 39.6927 79.2997 40.4674C79.2265 40.8212 79.7694 40.9737 79.8426 40.6199Z"
                            fill="#010E30"
                          />
                          <path
                            d="M102.657 33.1901C102.492 32.9278 102.266 32.7021 101.998 32.5374C101.736 32.3727 101.437 32.269 101.126 32.2324C100.43 32.1531 99.7347 32.3056 99.1308 32.6655C98.411 33.062 97.7888 33.6293 97.1605 34.1417L95.0377 35.868L92.6282 37.8261C92.3476 38.0518 92.7441 38.4483 93.0247 38.2226L96.9104 35.0689C97.5143 34.5809 98.106 34.0685 98.7282 33.6049C99.2589 33.2145 99.8689 32.8241 100.546 32.7753C101.162 32.7265 101.839 32.9217 102.175 33.4768C102.211 33.5439 102.272 33.5866 102.346 33.6049C102.419 33.6232 102.492 33.611 102.559 33.5744C102.626 33.5378 102.669 33.4768 102.687 33.4036C102.699 33.3365 102.687 33.2572 102.657 33.1901Z"
                            fill="#010E30"
                          />
                          <path
                            d="M95.3184 36.2035C95.5807 35.5447 96.0931 35.014 96.7397 34.7273C97.063 34.5931 97.4229 34.5504 97.7706 34.6053C98.1183 34.6602 98.4416 34.8127 98.71 35.0445C99.1187 35.4288 99.2956 36.0022 99.3566 36.5573C99.4298 37.1063 99.3688 37.6614 99.1675 38.1799C99.0638 38.4361 98.9113 38.6679 98.7161 38.857C98.5209 39.0522 98.2891 39.1986 98.0329 39.3023C97.5571 39.4487 97.0386 39.4365 96.5689 39.2596C96.2151 39.1376 95.8552 38.9363 95.7149 38.5886L95.3184 36.2035Z"
                            fill="white"
                          />
                          <path
                            d="M95.5624 36.3439C95.7942 35.7522 96.2456 35.2642 96.819 34.9958C97.1057 34.8677 97.429 34.8311 97.7401 34.8799C98.0512 34.9348 98.3379 35.0751 98.5697 35.2886C99.0577 35.7949 99.1492 36.6306 99.0943 37.2955C99.0394 37.9604 98.7222 38.668 98.0817 38.9791C97.6791 39.1499 97.2216 39.1743 96.8068 39.0401C96.4652 38.9425 96.1175 38.79 95.965 38.4484C95.8125 38.1068 95.3306 38.4057 95.477 38.7351C95.8369 39.5342 97.0081 39.7843 97.7889 39.6562C98.6734 39.5098 99.3139 38.7656 99.5457 37.936C99.7775 37.1064 99.7043 36.0206 99.2529 35.2581C99.0272 34.9043 98.7039 34.6237 98.3196 34.459C97.9353 34.2943 97.5083 34.2455 97.0996 34.3248C96.1602 34.4773 95.4404 35.2154 95.0805 36.0511C94.9402 36.3805 95.4221 36.6672 95.5685 36.3317V36.3439H95.5624Z"
                            fill="#010E30"
                          />
                          <path
                            d="M96.831 37.4234C96.831 37.46 96.831 37.4661 96.831 37.4478V37.4173C96.8188 37.4783 96.8432 37.4295 96.831 37.4173C96.8371 37.399 96.8493 37.3807 96.8615 37.3563C96.8981 37.2892 96.9347 37.2282 96.9835 37.1672C96.9591 37.1977 97.014 37.1245 96.9835 37.1672C96.9957 37.155 97.0018 37.1428 97.014 37.1306L97.0872 37.0513C97.136 37.0025 97.1848 36.9476 97.2397 36.9049C97.2702 36.8866 97.2946 36.8622 97.319 36.8378C97.2824 36.8683 97.3007 36.8622 97.319 36.8378L97.3617 36.8073C97.4227 36.7646 97.4837 36.728 97.5508 36.6975C97.6118 36.6609 97.6789 36.6365 97.7399 36.606C97.6972 36.6243 97.7155 36.6182 97.7399 36.606L97.7826 36.5877L97.8924 36.5511C97.9595 36.5267 98.0205 36.484 98.0571 36.4169C98.0937 36.3498 98.0998 36.2766 98.0815 36.2095C98.0632 36.1363 98.0144 36.0814 97.9534 36.0448C97.8924 36.0082 97.8131 35.996 97.746 36.0143C97.4044 36.118 97.0933 36.2949 96.831 36.5328C96.7029 36.6548 96.587 36.7829 96.4833 36.9293C96.4101 37.0147 96.3613 37.1184 96.3308 37.2221C96.3003 37.3319 96.2942 37.4417 96.3125 37.5576C96.3308 37.6308 96.3796 37.6918 96.4467 37.7284C96.5138 37.765 96.587 37.7772 96.6602 37.7589C96.7334 37.7345 96.7883 37.6918 96.8249 37.6247C96.8615 37.5576 96.8737 37.4844 96.8554 37.4112L96.831 37.4234Z"
                            fill="#010E30"
                          />
                          <path
                            d="M80.2882 62.3603C81.1666 62.5982 82.0572 62.7995 82.9112 63.0862C83.1003 63.135 83.2833 63.2143 83.448 63.3241C83.3931 63.2814 83.4724 63.3424 83.4846 63.3607L83.4724 63.3485C83.4846 63.3668 83.4968 63.3912 83.509 63.4156C83.5761 63.562 83.6615 63.6962 83.7347 63.8365C84.4728 65.1724 85.3207 66.4473 86.1686 67.7161C88.206 70.7356 90.3715 73.6758 92.3479 76.7319C93.2568 78.1349 94.1535 79.5623 94.8428 81.0873C94.8733 81.1422 94.9221 81.1788 94.977 81.2032C95.0319 81.2276 95.099 81.2337 95.1539 81.2154L96.0872 81.0263L98.5943 80.52L102.297 79.7697L106.835 78.8486L111.789 77.8421L116.809 76.8234L121.469 75.8779L125.428 75.0727L128.265 74.481C128.71 74.3895 129.168 74.3163 129.613 74.2065C129.631 74.2065 129.649 74.2065 129.668 74.1943C129.735 74.1699 129.796 74.1211 129.832 74.0601C129.869 73.993 129.875 73.9198 129.857 73.8466C128.734 69.9731 127.63 66.0935 126.526 62.22C125.965 60.2741 125.379 58.3465 124.733 56.4311C124.172 54.7475 123.58 53.07 122.988 51.3925C122.866 51.0509 122.329 51.2034 122.445 51.545C123.33 54.0826 124.239 56.6141 125.038 59.1761C125.752 61.4697 126.38 63.7816 127.039 66.0935C127.789 68.7348 128.545 71.37 129.314 74.0052L129.503 73.6575L128.576 73.8466L126.069 74.3529L122.366 75.1032L117.828 76.0243L112.874 77.0308L107.854 78.0495L103.194 78.995L99.2348 79.8002L96.4044 80.3736C95.9591 80.4651 95.4894 80.52 95.0563 80.6481L95.0014 80.6603L95.3186 80.7884C94.6903 79.4464 93.9644 78.1532 93.1531 76.9149C92.1649 75.3655 91.1218 73.8527 90.0726 72.346C89.0234 70.8393 87.9376 69.3021 86.8884 67.7649C86.0039 66.4656 85.1255 65.1419 84.3508 63.7755C84.2044 63.5193 84.0885 63.1838 83.8872 62.9642C83.7103 62.8056 83.509 62.6897 83.2833 62.6226C82.3683 62.2749 81.3862 62.0797 80.4407 61.8235C80.3675 61.8113 80.2943 61.8235 80.2333 61.8601C80.1723 61.8967 80.1235 61.9577 80.1052 62.0248C80.0869 62.0919 80.093 62.1651 80.1296 62.2322C80.1662 62.2932 80.2272 62.342 80.2882 62.3603Z"
                            fill="#010E30"
                          />
                          <path
                            d="M87.602 39.5587C87.6264 39.5404 87.6264 39.5404 87.602 39.5587L87.6386 39.5343L87.6996 39.4977C87.7118 39.4977 87.7972 39.455 87.7362 39.4794L87.7972 39.455L87.8826 39.4367C87.907 39.4367 87.9436 39.4245 87.8948 39.4367C87.9497 39.4306 88.0107 39.4306 88.0656 39.4367H88.151H88.1876C88.2486 39.4489 88.3035 39.4611 88.3645 39.4794C88.4255 39.4977 88.4804 39.516 88.5353 39.5404C88.5475 39.5404 88.6268 39.577 88.578 39.5526L88.6695 39.5953C88.7366 39.6319 88.8098 39.6441 88.883 39.6197C88.9562 39.6014 89.0172 39.5526 89.0538 39.4916C89.0904 39.4245 89.1026 39.3513 89.0782 39.2781C89.0599 39.2049 89.0111 39.1439 88.9501 39.1073C88.6695 38.9609 88.3584 38.8755 88.0412 38.8572C87.7362 38.8511 87.4373 38.9548 87.1994 39.1561C87.1506 39.211 87.1201 39.2781 87.1201 39.3574C87.1201 39.4306 87.1506 39.5038 87.1994 39.5587C87.2543 39.6075 87.3214 39.638 87.4007 39.638C87.48 39.638 87.5471 39.6136 87.602 39.5587Z"
                            fill="#010E30"
                          />
                          <path
                            d="M84.9971 39.1011C84.6616 39.1072 84.3261 39.1743 84.015 39.3024C83.8564 39.3634 83.71 39.4549 83.588 39.5708C83.466 39.6928 83.3745 39.8331 83.3135 39.9917C83.3013 40.0283 83.3013 40.0649 83.3013 40.1015C83.3074 40.1381 83.3135 40.1747 83.3318 40.2052C83.3501 40.2357 83.3745 40.2662 83.405 40.2906C83.4355 40.315 83.466 40.3333 83.5026 40.3394C83.5392 40.3516 83.5758 40.3516 83.6124 40.3455C83.649 40.3394 83.6856 40.3272 83.7161 40.3089C83.7466 40.2906 83.7771 40.2662 83.8015 40.2357C83.8259 40.2052 83.8381 40.1686 83.8503 40.132C83.8503 40.132 83.8503 40.0954 83.8625 40.0893C83.8381 40.132 83.8747 40.0832 83.8625 40.0893C83.8686 40.0771 83.8747 40.0649 83.8869 40.0527C83.8869 40.0527 83.9296 39.9978 83.9052 40.0283C83.8808 40.0588 83.9174 40.0283 83.9174 40.0161C83.9235 40.0039 83.9357 39.9978 83.9479 39.9856C83.9601 39.9734 83.9906 39.949 84.015 39.9246C83.9784 39.949 84.0394 39.9063 84.015 39.9246L84.0638 39.888L84.1431 39.8392L84.2285 39.7965L84.2712 39.7782C84.32 39.7538 84.2468 39.7782 84.2834 39.7782C84.4054 39.7355 84.5335 39.6989 84.6555 39.6745H84.7043C84.7226 39.6745 84.7348 39.6745 84.7043 39.6745L84.7958 39.6623C84.869 39.6623 84.9361 39.6501 85.0093 39.6501C85.0825 39.6501 85.1557 39.6196 85.2045 39.5708C85.2594 39.5159 85.2838 39.4488 85.2838 39.3695C85.2838 39.2963 85.2533 39.2231 85.2045 39.1682C85.1496 39.1133 85.0825 39.0889 85.0093 39.0889L84.9971 39.1011Z"
                            fill="#010E30"
                          />
                          <path
                            d="M93.2383 44.3594C93.2383 44.3594 97.3619 44.0422 98.7771 40.8153L97.2033 39.2598C97.2033 39.2598 96.8678 42.4562 93.2383 44.3594Z"
                            fill="#010E30"
                          />
                          <path
                            d="M144.466 61.8421C143.008 62.6778 141.416 63.3061 139.861 63.9222C137.439 64.886 134.981 65.7522 132.492 66.5208C130.979 66.9905 129.46 67.4236 127.923 67.8079C127.575 67.8933 127.722 68.4362 128.076 68.3508C130.796 67.6676 133.48 66.838 136.128 65.9169C138.305 65.1544 140.471 64.3309 142.575 63.3915C143.319 63.0743 144.045 62.7205 144.747 62.3301C144.814 62.2935 144.857 62.2325 144.875 62.1593C144.893 62.0861 144.881 62.0129 144.844 61.9458C144.808 61.8848 144.747 61.836 144.674 61.8177C144.607 61.7994 144.533 61.8116 144.466 61.8421Z"
                            fill="#010E30"
                          />
                          <path
                            d="M71.4307 69.7474C73.6511 70.7417 75.9935 71.4859 78.3115 72.2057C81.2212 73.1146 84.1675 73.9503 87.1504 74.5725C88.4436 74.8653 89.7612 75.0666 91.0849 75.1642C91.4448 75.1825 91.4448 74.6213 91.0849 74.603C89.9564 74.5237 88.834 74.359 87.7238 74.1211C86.3025 73.8405 84.8934 73.4928 83.4965 73.1268C80.6234 72.3643 77.7808 71.4981 74.9687 70.516C73.8707 70.1439 72.7605 69.7352 71.7113 69.2655C71.3819 69.113 71.0952 69.601 71.4307 69.7474Z"
                            fill="#010E30"
                          />
                          <path
                            d="M58.9868 69.0153C57.6509 69.1129 56.2845 69.2227 55.0523 69.8022C54.0153 70.2902 53.0881 71.1503 52.8258 72.3093C52.5757 73.4134 53.0149 74.5114 54.0824 74.975C55.1499 75.4386 56.498 75.3044 57.6387 75.1763C59.2003 75.0055 60.7375 74.6517 62.2197 74.1149C62.5553 73.9929 62.4088 73.45 62.0673 73.572C60.8899 73.999 59.67 74.3162 58.4317 74.5053C57.8095 74.6029 57.1812 74.6639 56.5468 74.6944C56.0283 74.7371 55.5098 74.7249 54.9974 74.6517C54.5399 74.5907 54.1129 74.3955 53.7713 74.0905C53.6066 73.9197 53.4785 73.7123 53.3992 73.4866C53.3199 73.2609 53.2894 73.0169 53.3138 72.779C53.3809 71.7298 54.1495 70.9185 55.0279 70.4305C56.2296 69.7656 57.6387 69.668 58.9807 69.5704C59.3467 69.5521 59.3467 68.9848 58.9868 69.0153Z"
                            fill="#010E30"
                          />
                          <path
                            d="M43.6453 72.9621C43.4257 73.1207 43.2671 73.3403 43.1817 73.5965C43.0963 73.8527 43.0963 74.1272 43.1817 74.3834C43.3708 74.9568 43.9076 75.2984 44.4749 75.4326C45.823 75.7498 47.2687 75.213 48.5558 74.8531C49.3183 74.6213 50.1113 74.4932 50.9043 74.4688C50.9775 74.4688 51.0507 74.4383 51.1056 74.3895C51.1605 74.3346 51.1849 74.2675 51.1849 74.1882C51.1849 74.115 51.1544 74.0418 51.1056 73.993C51.0507 73.9381 50.9836 73.9076 50.9043 73.9076C49.3305 73.9076 47.897 74.5542 46.372 74.847C45.701 74.9751 44.8958 75.0788 44.2553 74.7738C44.1211 74.7189 43.9991 74.6396 43.9015 74.5298C43.8039 74.42 43.7307 74.298 43.6941 74.1577C43.6575 74.0296 43.6636 73.8954 43.7063 73.7673C43.749 73.6392 43.8222 73.5294 43.9259 73.4501C44.2126 73.2366 43.9259 72.7486 43.6453 72.9621Z"
                            fill="#010E30"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M129.777 73.6084L161.125 146.034L132.54 150.743L117.608 113.594L108.793 148.608L108.622 148.645C107.183 148.943 104.804 148.907 102.065 148.706C99.3197 148.498 96.1843 148.12 93.2319 147.705C90.2734 147.29 87.4918 146.839 85.4483 146.491C84.4296 146.314 83.5939 146.168 83.0083 146.064C82.7155 146.009 82.4898 145.973 82.3373 145.942C82.258 145.93 82.2031 145.918 82.1604 145.912L82.1056 145.9H82.0994C82.0994 145.9 82.0994 145.9 82.1482 145.625L82.0994 145.9L81.8188 145.845L94.8607 80.6966L129.777 73.6084ZM82.4837 145.399C82.6362 145.424 82.8436 145.466 83.1059 145.509C83.6854 145.613 84.5211 145.759 85.5398 145.936C87.5772 146.284 90.3528 146.735 93.3052 147.15C96.2576 147.565 99.3746 147.943 102.107 148.144C104.737 148.34 106.969 148.37 108.336 148.126L117.486 111.782L132.894 150.115L160.326 145.595L129.442 74.2428L95.3426 81.1724L82.4837 145.399Z"
                            fill="#010E30"
                          />
                          <path
                            d="M122.323 124.202C125.678 123.104 129.07 122.104 132.492 121.231C135.865 120.371 139.263 119.645 142.685 119.048C144.661 118.706 146.638 118.407 148.626 118.157C148.98 118.114 148.986 117.547 148.626 117.596C145.113 118.041 141.618 118.621 138.147 119.34C134.718 120.054 131.309 120.908 127.941 121.878C126.002 122.433 124.08 123.025 122.165 123.653C121.829 123.769 121.982 124.312 122.323 124.202Z"
                            fill="#010E30"
                          />
                          <path
                            d="M87.5407 118.962C91.0726 119.115 94.5923 119.603 98.0693 120.237C101.772 120.908 105.438 121.744 109.068 122.744C110.916 123.25 112.758 123.799 114.576 124.415C114.924 124.531 115.064 123.988 114.728 123.873C111.343 122.738 107.896 121.799 104.425 120.987C100.753 120.127 97.0445 119.42 93.3052 118.925C91.3959 118.675 89.4744 118.486 87.5468 118.401C87.1808 118.383 87.1808 118.944 87.5407 118.962Z"
                            fill="#010E30"
                          />
                          <path
                            d="M114.179 104.664C115.32 107.421 116.375 110.209 117.412 113.009L118.041 114.717C118.163 115.052 118.706 114.906 118.584 114.564C117.644 112.033 116.711 109.507 115.723 106.988C115.399 106.158 115.064 105.335 114.722 104.511C114.588 104.182 114.045 104.328 114.179 104.664Z"
                            fill="#010E30"
                          />
                          <path
                            d="M111.197 104.091V104.652C112.142 104.713 113.088 104.774 114.033 104.841C114.173 104.841 114.314 104.853 114.454 104.871C114.527 104.871 114.6 104.841 114.655 104.786C114.71 104.731 114.735 104.664 114.735 104.585C114.735 104.512 114.704 104.438 114.649 104.39C114.594 104.341 114.527 104.31 114.454 104.304C114.082 104.261 113.704 104.255 113.344 104.225L111.593 104.109L111.197 104.091C110.837 104.066 110.837 104.627 111.197 104.652C111.557 104.676 111.557 104.115 111.197 104.091Z"
                            fill="#010E30"
                          />
                          <path
                            d="M78.531 36.7892C78.4456 37.2772 78.4883 37.7774 78.6713 38.241C78.8482 38.7046 79.1532 39.1072 79.5436 39.4122C79.9462 39.705 80.4159 39.8758 80.91 39.9124C81.4041 39.949 81.8982 39.8453 82.3313 39.6135C82.7644 39.3695 83.1121 39.0035 83.3439 38.5643C83.5757 38.1251 83.6733 37.631 83.6245 37.1369C84.1857 37.8567 84.8689 38.6253 85.7778 38.6802C86.0706 38.6924 86.3634 38.6314 86.6257 38.5094C86.8941 38.3874 87.1259 38.2044 87.3089 37.9726C87.6688 37.5029 87.8518 36.9234 87.8274 36.3317C88.0775 36.9478 88.5289 37.4602 89.1023 37.7896C89.6818 38.119 90.3467 38.241 91.0055 38.1434C91.6643 38.0458 92.2682 37.7286 92.7196 37.2467C93.1771 36.7648 93.4577 36.1426 93.5187 35.4838C93.6956 36.2951 94.6045 36.8136 95.4219 36.6977C96.2454 36.5818 96.9225 35.9352 97.2397 35.1666C97.5569 34.4041 97.5508 33.5379 97.4044 32.7327C97.2275 31.775 96.8249 30.8051 96.0502 30.2256C95.9038 30.1341 95.7696 30.0182 95.6537 29.884C95.5622 29.7254 95.4951 29.5546 95.4646 29.3716C95.2023 28.3712 94.5679 27.5111 93.6895 26.9682C92.8538 26.4558 91.8656 26.2728 90.8957 26.1691C90.0173 26.0776 89.0657 26.0593 88.3276 26.5412C88.1812 26.6571 88.0226 26.7547 87.8457 26.8218C87.559 26.9072 87.254 26.7791 86.9734 26.6693C85.9852 26.2667 84.9238 25.9922 83.8563 26.0776C83.1365 26.1508 82.4411 26.3338 81.7823 26.6266C81.3431 26.7974 80.9222 27.0292 80.5379 27.3037C79.751 27.9076 79.2569 28.8226 78.9214 29.7559C78.3724 31.287 78.2077 33.0194 78.8482 34.5139C78.8909 34.5871 78.9153 34.6725 78.9153 34.764C78.8909 34.8616 78.836 34.9531 78.7628 35.0202C78.592 35.2398 78.4761 35.496 78.4212 35.7644C78.3663 36.0389 78.3846 36.3195 78.4639 36.5818L78.531 36.7892Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M78.3054 36.9783C78.0858 38.2349 78.6775 39.6013 79.867 40.1625C80.3184 40.3882 80.8186 40.4919 81.3188 40.4553C81.819 40.4248 82.307 40.254 82.7218 39.9734C83.1366 39.6928 83.4721 39.3024 83.6856 38.851C83.8991 38.3996 83.9906 37.8933 83.9479 37.3931L83.466 37.5944C84.137 38.4484 85.0276 39.3817 86.2232 39.1926C87.4737 39.0035 88.1691 37.7713 88.1569 36.5879L87.6323 36.7282C87.8641 37.2406 88.2179 37.6859 88.6632 38.0214C89.1085 38.363 89.6331 38.5826 90.1882 38.6619C90.7433 38.7351 91.3106 38.668 91.8291 38.4545C92.3476 38.241 92.8051 37.8994 93.1467 37.4541C93.5432 36.96 93.7872 36.3622 93.8482 35.7339L93.2992 35.8071C93.3907 36.1304 93.5554 36.4232 93.7933 36.655C94.0312 36.8929 94.324 37.0637 94.6412 37.1491C94.9828 37.2467 95.3427 37.2528 95.6904 37.1796C96.0381 37.1064 96.3614 36.9478 96.6359 36.7282C97.9474 35.7034 98.0206 33.8429 97.6058 32.3545C97.3923 31.5127 96.9165 30.7624 96.2455 30.2134C96.1784 30.1768 96.1052 30.1646 96.032 30.189C95.9588 30.2073 95.8978 30.2561 95.8612 30.3171C95.8307 30.3781 95.8185 30.4574 95.8368 30.5245C95.8551 30.5916 95.8978 30.6526 95.9588 30.6892C96.9592 31.4639 97.3191 32.9462 97.2703 34.154C97.2276 35.3008 96.4895 36.7221 95.1597 36.6611C94.8608 36.6489 94.5741 36.5452 94.3362 36.3622C94.0983 36.1792 93.9275 35.923 93.8482 35.6363C93.7689 35.3069 93.3297 35.4167 93.2931 35.7095C93.2199 36.2951 92.9576 36.8441 92.5489 37.2711C92.1402 37.6981 91.6034 37.9848 91.0178 38.0885C89.81 38.2776 88.59 37.5273 88.1203 36.411C88.0105 36.1426 87.5957 36.2951 87.5957 36.5513C87.6079 37.4907 87.0589 38.5582 86.0097 38.6131C85.0764 38.668 84.3932 37.814 83.8686 37.1552C83.8259 37.1186 83.7771 37.0881 83.7222 37.082C83.6673 37.0698 83.6124 37.0759 83.5636 37.1003C83.5148 37.1186 83.466 37.1552 83.4355 37.204C83.405 37.2467 83.3867 37.3016 83.3867 37.3565C83.4233 37.6859 83.3867 38.0214 83.2769 38.3325C83.1671 38.6436 82.9963 38.9303 82.7645 39.1743C82.5327 39.4122 82.2582 39.6013 81.9471 39.7233C81.636 39.8453 81.3066 39.8941 80.9772 39.8758C80.6478 39.8514 80.3306 39.7538 80.0439 39.5952C79.7572 39.4366 79.501 39.2231 79.2997 38.9608C79.0984 38.6985 78.952 38.3996 78.8727 38.0824C78.7934 37.7652 78.7812 37.4297 78.8361 37.1064C78.9032 36.777 78.3603 36.6245 78.3054 36.9783Z"
                            fill="#010E30"
                          />
                          <path
                            d="M89.9321 45.4815C90.1273 45.0545 90.2493 44.597 90.292 44.1273C90.292 44.0541 90.2615 43.9809 90.2066 43.926C90.1517 43.8711 90.0846 43.8467 90.0053 43.8467C89.9321 43.8467 89.8589 43.8772 89.8101 43.9321C89.7613 43.987 89.7308 44.0541 89.7247 44.1273L89.7064 44.2798C89.7064 44.3103 89.7064 44.3103 89.7064 44.2798V44.3164L89.6942 44.3896C89.6759 44.4872 89.6576 44.5787 89.6332 44.6824C89.6088 44.7861 89.5783 44.8715 89.5478 44.9691C89.5295 45.0179 89.5112 45.0667 89.4929 45.1155C89.4746 45.1643 89.5173 45.0606 89.4929 45.1277C89.4807 45.1521 89.4685 45.1826 89.4563 45.207C89.4258 45.268 89.4136 45.3473 89.4319 45.4144C89.4502 45.4815 89.4929 45.5425 89.5539 45.5852C89.621 45.6218 89.6942 45.634 89.7674 45.6157C89.8406 45.5974 89.9016 45.5486 89.9382 45.4876H89.9321V45.4815Z"
                            fill="#010E30"
                          />
                          <path
                            d="M117.937 47.0917C118.273 47.8115 118.706 48.4764 119.218 49.0803C119.468 49.3792 119.737 49.6598 120.023 49.9221C120.322 50.221 120.676 50.4528 121.067 50.6053C121.408 50.7212 121.555 50.1783 121.213 50.0624C120.884 49.9221 120.585 49.7086 120.335 49.4463C120.066 49.1962 119.81 48.9278 119.572 48.6411C119.108 48.0799 118.724 47.4638 118.419 46.805C118.383 46.7379 118.322 46.6952 118.248 46.6769C118.175 46.6586 118.102 46.6708 118.035 46.7074C117.974 46.744 117.931 46.805 117.913 46.8782C117.895 46.9453 117.901 47.0185 117.937 47.0856V47.0917Z"
                            fill="#010E30"
                          />
                          <path
                            d="M123.976 55.6866C124.214 56.4735 124.544 57.2238 124.958 57.9314C124.995 57.9924 125.056 58.0351 125.129 58.0534C125.202 58.0717 125.276 58.0595 125.337 58.0229C125.398 57.9863 125.446 57.9253 125.465 57.8582C125.483 57.7911 125.477 57.7118 125.44 57.6508C125.05 56.9859 124.733 56.2783 124.501 55.5402C124.397 55.1925 123.854 55.3389 123.958 55.6927L123.976 55.6866Z"
                            fill="#010E30"
                          />
                          <path
                            d="M69.5095 66.2031C69.5095 66.2031 73.3037 67.5939 76.067 72.9375C78.8303 78.275 70.7295 70.9916 69.8023 68.7163C68.8812 66.4349 69.5095 66.2031 69.5095 66.2031Z"
                            fill="white"
                          />
                          <path
                            d="M77.5062 73.7858C76.0056 71.6081 74.5355 69.3206 72.5286 67.5638C70.4241 65.7216 67.8194 64.6907 65.1293 64.0563C63.4579 63.6293 61.7499 63.3609 60.0297 63.2389C58.3888 63.1718 56.7418 63.2816 55.1253 63.5622C53.1306 63.8977 51.1786 64.4284 49.2876 65.1421C48.2201 65.5386 47.1709 65.99 46.1461 66.4902C45.6032 66.7525 45.0664 67.0331 44.5357 67.3198C44.0599 67.5577 43.6085 67.8444 43.1937 68.1799C42.4556 68.796 41.9554 69.65 41.7785 70.5894C41.6138 71.5776 41.9188 72.578 42.8155 73.0965C43.7122 73.615 44.8041 73.5235 45.7923 73.2856C46.9452 73.0172 48.0798 72.7244 49.2693 72.6268C49.8671 72.578 50.4649 72.5597 51.0627 72.578C51.4226 72.578 51.4226 72.0168 51.0627 72.0168C49.9159 71.9924 48.7752 72.0839 47.6467 72.2913C47.0733 72.395 46.5243 72.5414 45.9509 72.6817C45.4202 72.8403 44.8651 72.9196 44.31 72.9318C43.4194 72.9135 42.5166 72.4682 42.3336 71.5288C42.1506 70.5894 42.6203 69.6012 43.2425 68.9302C43.9501 68.1677 44.9688 67.7224 45.8838 67.2649C46.872 66.7647 47.8785 66.3072 48.9094 65.9046C50.7516 65.1726 52.6609 64.6175 54.6068 64.2393C56.1989 63.9221 57.8215 63.7757 59.4441 63.794C61.0362 63.8245 62.6283 64.099 64.1777 64.4284C66.8434 64.9896 69.5152 65.8558 71.6685 67.576C73.6022 69.1132 75.0296 71.1628 76.4204 73.1758C76.6278 73.4747 76.8352 73.7797 77.0426 74.0847C77.2439 74.3775 77.7319 74.0969 77.5306 73.798H77.5062V73.7858Z"
                            fill="#010E30"
                          />
                          <path
                            d="M95.6357 80.9349C95.6357 80.9349 112.209 79.7149 130.387 75.756L129.448 73.7979L103.871 79.0682L95.6357 80.9349Z"
                            fill="#010E30"
                          />
                          <path
                            d="M128.24 68.271C128.24 68.271 141.02 65.16 145.284 63.7021L144.686 61.9819C144.686 61.9819 141.465 63.757 138.818 64.7757C136.164 65.7822 128.24 68.271 128.24 68.271Z"
                            fill="#010E30"
                          />
                          <path
                            d="M75.3468 71.1929C75.3163 71.2783 81.5993 74.6943 91.2922 76.7561L91.5606 75.0054C91.5606 75.0054 86.7477 74.2917 84.1857 73.578C81.6237 72.8643 75.3468 71.1929 75.3468 71.1929Z"
                            fill="#010E30"
                          />
                          <path
                            d="M122.72 123.775C122.72 123.775 130.918 121.53 149.285 119.389L148.419 117.876C148.419 117.876 140.013 119.218 137.878 119.688C135.749 120.158 122.72 123.775 122.72 123.775Z"
                            fill="#010E30"
                          />
                          <path
                            d="M89.9443 119.023C89.9443 119.023 99.1675 120.304 114.192 125.837L114.448 124.007C114.448 124.007 108.171 122.238 105.097 121.427C101.284 120.42 89.9443 119.023 89.9443 119.023Z"
                            fill="#010E30"
                          />
                          <path
                            d="M111.501 104.481C111.501 104.481 114.539 105.713 116.034 108.556L114.314 104.371L111.501 104.481Z"
                            fill="#010E30"
                          />
                          <path
                            d="M82.3925 145.607C82.3925 145.607 79.6475 150.597 78.4763 150.932C77.3051 151.268 83.6918 151.012 85.6072 159.71L106.573 156.685C106.573 156.685 109.281 149.938 108.47 148.102C107.976 146.979 102.925 146.729 102.925 146.729C102.925 146.729 95.8979 145.735 82.3925 145.607Z"
                            fill="#E9E9E9"
                          />
                          <path
                            d="M68.3748 159.106C71.3455 159.594 74.3467 159.875 77.354 159.96C80.2393 160.046 83.1368 159.96 86.016 159.771C88.6573 159.582 91.2925 159.302 93.9155 158.948C96.1969 158.643 98.4722 158.277 100.747 157.899C102.516 157.6 104.292 157.289 106.073 157.038L106.573 156.971C106.634 156.971 106.695 156.947 106.744 156.91C106.793 156.874 106.829 156.825 106.847 156.764C107.317 155.233 107.72 153.677 108.086 152.122C108.244 151.439 108.397 150.749 108.537 150.06C108.604 149.718 108.671 149.383 108.726 149.035C108.781 148.803 108.824 148.566 108.848 148.328C108.848 148.218 108.818 148.108 108.769 148.01C108.72 147.913 108.647 147.827 108.555 147.76C108.061 147.346 107.342 147.199 106.732 147.047C105.682 146.815 104.615 146.632 103.547 146.51C100.711 146.15 97.85 145.955 94.9952 145.796C92.1831 145.638 89.3771 145.528 86.565 145.442C85.1315 145.4 83.6858 145.32 82.2462 145.339H82.1852C82.1364 145.339 82.0876 145.351 82.0449 145.375C82.0022 145.4 81.9656 145.436 81.9412 145.479C81.1421 147.224 80.1051 148.877 78.696 150.188C77.1832 151.597 75.2983 152.384 73.4134 153.171C72.4435 153.555 71.498 154.007 70.583 154.513C69.7351 155.007 68.9909 155.611 68.6005 156.538C68.2284 157.423 68.1674 158.411 68.1308 159.363C68.1125 159.863 68.1613 160.369 68.4907 160.772C68.7652 161.077 69.1251 161.302 69.5216 161.406C70.0157 161.546 70.5159 161.656 71.0222 161.723C71.5834 161.821 72.1446 161.9 72.7058 161.967C73.8465 162.101 74.9872 162.181 76.134 162.217C78.4703 162.291 80.8005 162.187 83.1307 162.028C85.4609 161.87 87.7667 161.699 90.0847 161.485C92.4393 161.266 94.7878 160.955 97.1302 160.625C98.2892 160.461 99.4543 160.284 100.613 160.101C101.705 159.924 102.803 159.692 103.901 159.564C104.621 159.478 105.499 159.424 106 158.814C106.158 158.6 106.28 158.362 106.353 158.106C106.469 157.801 106.573 157.49 106.677 157.167C106.75 156.947 106.829 156.733 106.896 156.508C107.006 156.16 106.463 156.014 106.353 156.361C106.195 156.88 106.012 157.392 105.823 157.899C105.768 158.136 105.652 158.35 105.481 158.527C105.219 158.734 104.902 158.862 104.566 158.899C104.194 158.966 103.816 158.99 103.444 159.051C102.907 159.137 102.37 159.241 101.827 159.326C100.705 159.515 99.5702 159.692 98.4356 159.863C96.1603 160.204 93.8728 160.528 91.5853 160.772C89.3283 161.01 87.0652 161.174 84.8021 161.333C80.343 161.662 75.8107 161.912 71.376 161.199C70.8758 161.119 70.3634 161.04 69.8754 160.912C69.5094 160.814 69.1068 160.674 68.8689 160.351C68.5822 159.96 68.6676 159.405 68.692 158.948C68.7103 158.478 68.7652 158.014 68.8506 157.551C68.936 157.099 69.0946 156.666 69.3325 156.27C69.5948 155.873 69.9425 155.532 70.3451 155.276C71.1991 154.733 72.1019 154.269 73.0413 153.891C74.8652 153.104 76.7501 152.415 78.33 151.176C79.7818 150.054 80.9225 148.553 81.8009 146.937C82.0144 146.54 82.2157 146.132 82.4048 145.723L82.1608 145.863C83.3259 145.882 84.491 145.912 85.6561 145.943C88.3157 146.016 90.9692 146.119 93.6288 146.248C96.5141 146.394 99.4055 146.577 102.285 146.888C103.425 147.01 104.548 147.15 105.676 147.364C106.109 147.449 106.542 147.535 106.976 147.651C107.146 147.699 107.311 147.748 107.482 147.803C107.555 147.827 107.628 147.858 107.701 147.882L107.75 147.901C107.689 147.876 107.805 147.925 107.75 147.901L107.86 147.949C107.964 147.998 108.061 148.053 108.159 148.12C108.214 148.157 108.11 148.071 108.171 148.12L108.22 148.163C108.232 148.175 108.244 148.187 108.257 148.2C108.202 148.163 108.311 148.254 108.257 148.2C108.269 148.2 108.281 148.236 108.281 148.242C108.287 148.254 108.263 148.163 108.281 148.23C108.299 148.297 108.281 148.212 108.281 148.212V148.267C108.269 148.334 108.257 148.407 108.244 148.48C108.214 148.651 108.183 148.822 108.153 148.993C108.086 149.365 108.013 149.737 107.933 150.097C107.506 152.158 106.994 154.19 106.396 156.203L106.292 156.544L106.561 156.337C104.859 156.557 103.169 156.855 101.486 157.136C99.2896 157.508 97.0936 157.862 94.8854 158.179C92.3051 158.551 89.7126 158.85 87.114 159.058C84.2714 159.283 81.4227 159.399 78.5679 159.356C75.5789 159.326 72.5899 159.1 69.6253 158.673C69.2532 158.618 68.875 158.557 68.5029 158.496C68.1491 158.441 67.9966 158.978 68.3504 159.039L68.3748 159.106Z"
                            fill="#010E30"
                          />
                          <path
                            d="M87.846 149.188C86.8273 148.419 85.6866 147.827 84.4727 147.437C83.271 147.053 81.9168 146.815 80.7029 147.26C80.3674 147.388 80.5138 147.931 80.8554 147.803C82.0083 147.376 83.271 147.632 84.4056 148.004C85.5463 148.383 86.6138 148.944 87.5715 149.67C87.8521 149.895 88.1266 149.407 87.846 149.188Z"
                            fill="white"
                          />
                          <path
                            d="M86.3455 151.195C85.3512 150.469 84.2532 149.908 83.082 149.523C82.5025 149.334 81.9108 149.194 81.313 149.096C80.6786 148.968 80.0198 148.974 79.3915 149.108C79.3244 149.133 79.2634 149.176 79.2268 149.243C79.1902 149.31 79.1841 149.383 79.2024 149.45C79.2207 149.517 79.2695 149.578 79.3305 149.615C79.3915 149.651 79.4708 149.664 79.5379 149.645C80.1296 149.523 80.7335 149.523 81.3191 149.657C83.0332 149.95 84.6558 150.64 86.0588 151.677C86.3577 151.896 86.6383 151.408 86.3455 151.195Z"
                            fill="white"
                          />
                          <path
                            d="M134.932 157.161L135.438 159.033L137.25 159.54C137.25 159.54 147.961 161.162 150.792 161.455C153.622 161.748 162.845 162.449 165.615 162.303C168.378 162.163 172.288 162.516 174.149 161.351C176.009 160.186 174.368 155.867 173.898 155.776C173.429 155.684 164.846 151.048 164.45 150.804C164.053 150.56 134.932 157.161 134.932 157.161Z"
                            fill="white"
                          />
                          <path
                            d="M134.792 154.342L135.115 155.745C135.115 155.745 137.896 157.404 143.258 157.77C148.62 158.136 152.439 158.826 152.439 158.826C152.439 158.826 164.804 160.162 169.031 159.363C173.258 158.563 172.239 159.491 174.137 158.502C176.034 157.514 174.594 156.148 174.594 156.148L134.792 154.342Z"
                            fill="white"
                          />
                          <path
                            d="M160.192 145.144C160.192 145.144 163.187 150.451 164.438 150.804C165.688 151.158 158.911 150.896 156.861 160.125L134.596 156.917L133.474 154.483L132.608 150.652C132.608 150.652 125.355 146.797 160.192 145.144Z"
                            fill="#E9E9E9"
                          />
                          <path
                            d="M155.983 159.613L161.79 160.125C161.79 160.125 169.22 160.259 170.794 160.015C172.368 159.771 175.131 158.82 175.131 158.82L174.6 156.306L171.904 154.47L165.56 151.616L164.328 150.542L157.874 153.415L156.001 159.478L155.983 159.613Z"
                            fill="#E9E9E9"
                          />
                          <path
                            d="M174.722 158.795C172.789 159.625 170.501 159.832 168.397 159.942C165.493 160.058 162.589 159.997 159.698 159.753C156.526 159.527 153.36 159.18 150.206 158.771C147.278 158.399 144.357 157.966 141.441 157.52C139.275 157.191 137.116 156.837 134.944 156.538L134.328 156.453L134.572 156.593C134.511 156.489 134.456 156.386 134.414 156.276L134.377 156.184C134.353 156.13 134.395 156.227 134.377 156.184L134.353 156.123C134.316 156.026 134.273 155.934 134.243 155.837C134.139 155.574 134.054 155.306 133.962 155.038C133.669 154.141 133.413 153.232 133.175 152.317C132.998 151.634 132.828 150.945 132.669 150.255C132.626 150.066 132.584 149.883 132.541 149.694C132.523 149.615 132.504 149.535 132.486 149.456C132.468 149.377 132.486 149.517 132.486 149.487C132.486 149.456 132.486 149.444 132.486 149.426C132.462 149.468 132.474 149.359 132.486 149.426C132.492 149.407 132.498 149.389 132.504 149.365C132.462 149.426 132.523 149.322 132.504 149.365L132.541 149.304C132.577 149.243 132.498 149.346 132.553 149.291C132.608 149.237 132.632 149.212 132.675 149.176C132.718 149.139 132.767 149.102 132.699 149.157L132.791 149.09C132.919 149.005 133.059 148.925 133.2 148.858L133.316 148.803L133.425 148.755L133.675 148.657C134.7 148.297 135.756 148.023 136.829 147.834C138.257 147.547 139.702 147.327 141.136 147.138C142.771 146.912 144.411 146.729 146.058 146.559C147.699 146.388 149.365 146.235 151.018 146.101C152.494 145.973 153.976 145.863 155.452 145.76C156.55 145.68 157.648 145.607 158.753 145.54C159.283 145.509 159.832 145.516 160.363 145.448H160.436L160.192 145.308C160.997 147.132 162.138 148.791 163.553 150.206C164.285 150.92 165.103 151.542 165.987 152.055C166.908 152.567 167.866 153.025 168.842 153.415C169.848 153.836 170.861 154.245 171.837 154.745C172.734 155.208 173.71 155.727 174.228 156.63C174.722 157.49 174.789 158.527 174.85 159.497C174.881 159.979 174.942 160.546 174.6 160.936C174.308 161.266 173.85 161.4 173.435 161.498C171.154 162.034 168.75 162.193 166.414 162.248C164.023 162.297 161.626 162.187 159.241 162.028C156.849 161.87 154.422 161.687 152.012 161.467C149.609 161.247 147.169 160.918 144.753 160.576C143.564 160.406 142.38 160.229 141.191 160.04C140.026 159.851 138.86 159.619 137.689 159.46C137.037 159.375 136.079 159.393 135.64 158.814C135.505 158.6 135.39 158.374 135.292 158.136C135.146 157.825 134.999 157.514 134.853 157.197C134.755 157.002 134.67 156.794 134.59 156.587C134.481 156.245 133.938 156.398 134.048 156.74C134.261 157.313 134.511 157.874 134.798 158.411C134.895 158.655 135.017 158.887 135.164 159.112C135.408 159.43 135.749 159.655 136.134 159.765C136.524 159.875 136.927 159.942 137.335 159.973C137.854 160.034 138.366 160.137 138.885 160.223C140.117 160.43 141.355 160.631 142.594 160.814C145.082 161.186 147.577 161.552 150.084 161.827C152.555 162.101 155.038 162.284 157.514 162.467C162.419 162.84 167.378 163.102 172.252 162.303C173.161 162.156 174.399 162.059 175.04 161.29C175.375 160.881 175.448 160.369 175.43 159.857C175.418 159.332 175.375 158.814 175.302 158.295C175.168 157.282 174.85 156.3 174.106 155.574C173.332 154.824 172.288 154.324 171.312 153.873C169.318 152.951 167.177 152.268 165.365 150.993C163.681 149.81 162.358 148.169 161.357 146.382C161.107 145.943 160.881 145.491 160.674 145.028C160.65 144.985 160.613 144.948 160.57 144.924C160.528 144.899 160.479 144.887 160.43 144.887C159.369 144.942 158.313 145.009 157.246 145.076C154.763 145.241 152.287 145.424 149.81 145.638C146.894 145.894 143.984 146.187 141.087 146.577C138.799 146.882 136.469 147.205 134.249 147.87C133.614 148.059 132.937 148.273 132.394 148.669C132.193 148.803 132.035 148.999 131.949 149.23C131.919 149.346 131.913 149.462 131.937 149.584C132.041 150.17 132.205 150.755 132.346 151.329C132.699 152.89 133.145 154.422 133.675 155.928C133.773 156.203 133.889 156.471 134.017 156.74C134.054 156.831 134.121 156.91 134.2 156.965C134.285 157.02 134.383 157.051 134.481 157.045C137.03 157.38 139.727 157.831 142.313 158.222C145.955 158.783 149.603 159.289 153.263 159.71C156.99 160.131 160.735 160.473 164.487 160.546C166.134 160.576 167.781 160.558 169.421 160.436C170.788 160.351 172.148 160.137 173.478 159.808C174.003 159.674 174.521 159.497 175.021 159.277C175.332 159.137 175.046 158.649 174.722 158.795Z"
                            fill="#010E30"
                          />
                          <path
                            d="M154.787 149.456C155.806 148.682 156.947 148.084 158.161 147.681C159.369 147.285 160.711 147.01 161.937 147.468C162.278 147.596 162.425 147.053 162.089 146.925C160.796 146.443 159.362 146.705 158.088 147.114C156.8 147.529 155.593 148.157 154.513 148.968C154.226 149.182 154.513 149.67 154.794 149.45H154.787V149.456Z"
                            fill="#010E30"
                          />
                          <path
                            d="M156.367 151.591C157.349 150.865 158.441 150.298 159.594 149.907C160.161 149.712 160.747 149.566 161.339 149.456C161.985 149.34 162.65 149.267 163.303 149.431C163.37 149.444 163.449 149.438 163.51 149.395C163.571 149.358 163.62 149.297 163.638 149.23C163.657 149.163 163.65 149.084 163.614 149.023C163.577 148.962 163.522 148.913 163.455 148.889C162.79 148.742 162.095 148.736 161.43 148.87C160.783 148.974 160.143 149.126 159.521 149.334C158.289 149.743 157.13 150.334 156.086 151.097C155.794 151.31 156.086 151.798 156.367 151.591Z"
                            fill="#010E30"
                          />
                          <path
                            d="M20.9776 44.8169C21.2521 44.6705 21.5571 44.518 21.8682 44.579C22.1122 44.6522 22.3318 44.7986 22.5026 44.9938C27.1264 49.4285 31.4391 53.9974 36.0568 58.4382C42.4008 48.2939 45.9571 42.6026 55.0827 28.2676C55.2657 27.987 55.5463 27.7857 55.8757 27.7125C56.199 27.6393 56.5467 27.7003 56.8273 27.8772C59.5113 29.5669 62.0489 31.4823 64.4096 33.5929C64.6658 33.8247 64.8305 34.1419 64.8732 34.4896C64.9159 34.8373 64.8244 35.185 64.6292 35.4656C55.5646 48.361 46.256 61.0612 36.6851 73.5784C36.6241 73.6577 36.5509 73.7248 36.4594 73.7736C36.374 73.8224 36.2764 73.8529 36.1727 73.859C36.0751 73.8651 35.9714 73.859 35.8799 73.8224C35.7823 73.7919 35.6969 73.737 35.6237 73.6699C26.9983 65.8558 15.4815 54.8026 12.6267 51.8929C12.5413 51.8014 12.4742 51.6977 12.4315 51.5818C12.3888 51.4659 12.3705 51.3378 12.3766 51.2158C12.3827 51.0938 12.4193 50.9718 12.4803 50.862C12.5413 50.7522 12.6206 50.6546 12.7182 50.5814C14.4384 49.2638 18.6657 46.0674 20.9776 44.8169Z"
                            fill="#D3D4D6"
                          />
                          <path
                            d="M21.1178 45.0667C21.4167 44.9081 21.7156 44.7556 22.0328 44.963C22.289 45.1643 22.5269 45.3839 22.7465 45.6218C23.2223 46.0854 23.6981 46.5429 24.1678 47.0065C25.1194 47.9459 26.071 48.8853 27.0104 49.8308C28.8831 51.7035 30.7375 53.6006 32.6285 55.4672C33.7021 56.5347 34.7818 57.59 35.8676 58.6392C35.8981 58.6697 35.9347 58.688 35.9774 58.7063C36.0201 58.7185 36.0628 58.7246 36.1055 58.7185C36.1482 58.7124 36.1909 58.7002 36.2214 58.6758C36.258 58.6514 36.2885 58.6209 36.3068 58.5843C38.2832 55.4245 40.2596 52.2647 42.2421 49.1049C44.2429 45.9207 46.2437 42.7426 48.2506 39.5645C49.4767 37.6247 50.7028 35.691 51.9289 33.7573C52.6304 32.6532 53.3258 31.5552 54.0273 30.4572L55.1497 28.676C55.2717 28.4259 55.4608 28.2185 55.6926 28.0721C55.9061 27.9623 56.1562 27.9318 56.388 27.9928C56.6625 28.0965 56.9248 28.2429 57.1566 28.4259C57.4555 28.615 57.7483 28.8102 58.0411 29.0054C58.6023 29.3775 59.1513 29.7618 59.6942 30.1583C60.8044 30.9635 61.878 31.8053 62.9272 32.6837C63.1834 32.9033 63.4396 33.1168 63.6958 33.3364C63.952 33.5255 64.1899 33.7512 64.3912 34.0013C64.7023 34.4588 64.6108 34.9773 64.3119 35.4043C63.4945 36.5816 62.6649 37.7406 61.8414 38.9057C58.4986 43.621 55.1253 48.318 51.7093 52.9906C48.2994 57.6632 44.8529 62.3053 41.3759 66.923C40.5158 68.0637 39.6557 69.2044 38.7895 70.3451L37.4597 72.0897L36.807 72.9376C36.6423 73.1511 36.4593 73.5293 36.1604 73.5659C35.9164 73.5964 35.7578 73.4073 35.5992 73.2609L34.9709 72.6997L33.7509 71.5895C32.903 70.8148 32.0612 70.034 31.2194 69.2593C27.8461 66.1361 24.5033 62.9946 21.1849 59.8287C18.7205 57.4741 16.2561 55.1195 13.8344 52.71C13.4989 52.3745 13.1451 52.0512 12.8279 51.6974C12.7486 51.6181 12.6937 51.5205 12.6693 51.4168C12.6449 51.307 12.6449 51.1972 12.6754 51.0935C12.7547 50.9105 12.8889 50.758 13.0658 50.6604C13.3647 50.4286 13.6697 50.1968 13.9747 49.9711C15.5973 48.745 17.2321 47.5372 18.9279 46.4148C19.6416 45.939 20.3614 45.4754 21.1117 45.0667C21.4289 44.8959 21.1483 44.4079 20.825 44.5787C19.056 45.5425 17.4029 46.7564 15.7742 47.9398C14.9873 48.5132 14.2065 49.0988 13.4257 49.6844C13.139 49.904 12.8523 50.1175 12.5656 50.3432C12.3643 50.4957 12.2118 50.7031 12.1386 50.9471C12.0654 51.1911 12.0715 51.4473 12.1569 51.6852C12.2911 51.9658 12.4802 52.2098 12.7181 52.4111L13.261 52.954C13.7246 53.4176 14.1882 53.8751 14.6579 54.3326C15.9084 55.5526 17.165 56.7726 18.4277 57.9804C21.7339 61.1585 25.0645 64.3061 28.4134 67.4354C30.1458 69.058 31.8904 70.6684 33.635 72.2666C34.0559 72.6509 34.4768 73.0352 34.9038 73.4195C35.2881 73.7733 35.6541 74.2186 36.2336 74.1393C36.8497 74.0539 37.1852 73.3646 37.5268 72.9193L38.8871 71.132C42.48 66.4045 46.0302 61.6526 49.556 56.8702C53.0757 52.0939 56.5588 47.281 60.0053 42.4437C60.8776 41.2237 61.7438 40.0037 62.6039 38.7837C63.037 38.1737 63.4701 37.5637 63.8971 36.9476C64.0862 36.667 64.2875 36.3864 64.4888 36.1119C64.7084 35.8435 64.8975 35.5446 65.0378 35.2213C65.1232 34.9773 65.1537 34.7211 65.1293 34.471C65.1049 34.2148 65.0195 33.9708 64.8853 33.7512C64.7206 33.5133 64.5193 33.2998 64.2936 33.1229C64.0313 32.8911 63.7629 32.6593 63.4945 32.4336C62.427 31.5247 61.329 30.6585 60.2005 29.835C59.6332 29.4202 59.0537 29.0115 58.4742 28.6211C58.2119 28.432 57.9435 28.2673 57.6751 28.0904C57.3884 27.8769 57.0773 27.6939 56.7601 27.5292C56.5283 27.4255 56.2782 27.3828 56.022 27.4011C55.7719 27.4194 55.5279 27.4987 55.3083 27.6329C54.7898 27.9623 54.5092 28.615 54.1859 29.1152C52.7585 31.36 51.3311 33.6048 49.9098 35.8435C47.7016 39.3327 45.4934 42.8219 43.2913 46.3172C41.321 49.4526 39.3507 52.5941 37.3865 55.7356L35.7944 58.2793L36.2336 58.2244C32.2076 54.357 28.3463 50.3249 24.3569 46.4209C23.7957 45.8719 23.2345 45.3229 22.6733 44.7861C22.4537 44.5299 22.1548 44.3591 21.8254 44.2859C21.4533 44.2371 21.1239 44.3957 20.8128 44.5665C20.5139 44.7434 20.8006 45.2314 21.1178 45.0667Z"
                            fill="#010E30"
                          />
                          <path
                            d="M14.9814 162.162C14.9814 161.821 16.6223 100.467 16.7565 84.4241C16.7809 81.7462 19.2148 79.599 22.1916 79.6478L49.0438 80.0626C51.923 80.1053 54.241 82.2037 54.2898 84.8023L54.9425 162.162H14.9814Z"
                            fill="white"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M22.1856 79.9282C19.343 79.8855 17.0616 81.929 17.0372 84.43C16.9701 92.4515 16.5248 111.807 16.0978 129.192C15.8843 137.884 15.6769 146.089 15.5183 152.14C15.4573 154.543 15.4024 156.611 15.3597 158.234L15.3292 159.393C15.3048 160.265 15.2865 160.948 15.2743 161.418C15.2682 161.607 15.2682 161.766 15.2621 161.882H54.6559L54.0032 84.8082C53.9605 82.3865 51.7889 80.3918 49.0378 80.343L22.1856 79.9282ZM22.1917 79.367C19.0929 79.3182 16.5004 81.563 16.476 84.4239C16.4089 92.4393 15.9636 111.789 15.5366 129.174C15.2377 141.264 14.951 152.408 14.7985 158.136C14.7314 160.643 14.6948 162.113 14.6948 162.162V162.443H55.2232L54.5644 84.796C54.5156 82.0205 52.0451 79.8306 49.0439 79.7818L22.1917 79.367Z"
                            fill="#010E30"
                          />
                          <path
                            d="M54.9606 162.162C54.9606 161.833 54.4482 104.206 54.4482 104.206L82.2886 104.609C84.6188 104.645 86.4976 106.347 86.5342 108.452L87.4797 162.162H54.9606Z"
                            fill="white"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M54.168 103.919L82.3012 104.328C84.7595 104.365 86.7847 106.164 86.8274 108.446L87.779 162.443H54.6804V162.162C54.6804 161.998 54.5523 147.51 54.4242 133.065C54.3632 125.843 54.2961 118.627 54.2473 113.216L54.168 104.206C54.168 104.206 54.168 104.206 54.4486 104.206H54.168V103.919ZM54.7353 104.487L54.8146 113.21C54.8634 118.62 54.9244 125.831 54.9915 133.059C55.1074 146.406 55.2294 159.789 55.2416 161.882H87.2056L86.2601 108.452C86.2235 106.524 84.4972 104.92 82.289 104.883L54.7353 104.487Z"
                            fill="#010E30"
                          />
                          <path
                            d="M87.7298 162.162C87.7298 161.845 86.888 124.379 86.949 126.41L110.269 126.648C112.288 126.673 113.923 127.722 113.954 129.015L114.771 162.156H87.7298V162.162Z"
                            fill="white"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M87.2299 126.697C87.236 126.862 87.236 127.081 87.2421 127.35C87.2604 128.179 87.2848 129.479 87.3214 131.095C87.3946 134.328 87.4922 138.83 87.5898 143.405C87.6325 145.357 87.6752 147.327 87.7179 149.212C87.8521 155.337 87.968 160.625 87.9985 161.882H114.479L113.667 129.027C113.655 128.503 113.32 127.99 112.697 127.594C112.081 127.197 111.221 126.941 110.257 126.929L87.2299 126.697ZM86.9493 126.154V126.13L110.27 126.368C111.325 126.38 112.289 126.661 113.009 127.118C113.722 127.576 114.216 128.234 114.235 129.009L115.064 162.437H87.4495V162.156V162.15V162.126C87.4495 162.102 87.4495 162.071 87.4495 162.034C87.4495 161.955 87.4434 161.839 87.4434 161.693C87.4373 161.4 87.4312 160.985 87.419 160.461C87.3946 159.411 87.3641 157.929 87.3214 156.166C87.2787 154.153 87.2238 151.774 87.1689 149.255C87.1262 147.358 87.0835 145.381 87.0408 143.417C86.9371 138.842 86.8395 134.34 86.7724 131.107C86.7358 129.491 86.7114 128.192 86.6931 127.362C86.687 126.947 86.6809 126.648 86.6748 126.484C86.6748 126.404 86.6748 126.349 86.6748 126.331C86.6748 126.331 86.6748 126.325 86.6748 126.319C86.6748 126.313 86.6748 126.295 86.6809 126.276C86.7297 126.191 86.8395 126.154 86.9493 126.154Z"
                            fill="#010E30"
                          />
                          <path
                            d="M72.9437 84.2472H74.9079C74.9811 84.2472 75.0543 84.2167 75.1092 84.1679C75.1641 84.113 75.1946 84.0459 75.1946 83.9666C75.1946 83.8873 75.1641 83.8202 75.1092 83.7653C75.0543 83.7104 74.9872 83.686 74.9079 83.686H72.9437C72.8705 83.686 72.7973 83.7165 72.7424 83.7653C72.6875 83.8202 72.6631 83.8873 72.6631 83.9666C72.6631 84.0459 72.6936 84.113 72.7424 84.1679C72.7973 84.2167 72.8705 84.2472 72.9437 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M67.8377 84.2472H70.5888C70.662 84.2472 70.7352 84.2167 70.7901 84.1679C70.845 84.113 70.8694 84.0459 70.8694 83.9666C70.8694 83.8873 70.8389 83.8202 70.7901 83.7653C70.7352 83.7104 70.6681 83.686 70.5888 83.686H67.8377C67.7645 83.686 67.6913 83.7165 67.6364 83.7653C67.5815 83.8202 67.5571 83.8873 67.5571 83.9666C67.5571 84.0459 67.5876 84.113 67.6364 84.1679C67.6913 84.2167 67.7584 84.2472 67.8377 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M62.7259 84.2472H65.477C65.5502 84.2472 65.6234 84.2167 65.6783 84.1679C65.7332 84.113 65.7576 84.0459 65.7576 83.9666C65.7576 83.8873 65.7271 83.8202 65.6783 83.7653C65.6234 83.7104 65.5563 83.686 65.477 83.686H62.7259C62.6527 83.686 62.5795 83.7165 62.5246 83.7653C62.4697 83.8202 62.4453 83.8873 62.4453 83.9666C62.4453 84.0459 62.4758 84.113 62.5246 84.1679C62.5795 84.2167 62.6527 84.2472 62.7259 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M56.8333 84.2472H60.2371C60.3103 84.2472 60.3835 84.2167 60.4384 84.1679C60.4933 84.113 60.5238 84.0459 60.5238 83.9666C60.5238 83.8873 60.4933 83.8202 60.4384 83.7653C60.3835 83.7104 60.3164 83.686 60.2371 83.686H56.8333C56.7601 83.686 56.6869 83.7165 56.632 83.7653C56.5771 83.8202 56.5527 83.8873 56.5527 83.9666C56.5527 84.0459 56.5832 84.113 56.632 84.1679C56.6869 84.2167 56.7601 84.2472 56.8333 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M50.9408 84.2472H54.4788C54.552 84.2472 54.6252 84.2167 54.6801 84.1679C54.735 84.113 54.7594 84.0459 54.7594 83.9666C54.7594 83.8873 54.7289 83.8202 54.6801 83.7653C54.6252 83.7104 54.5581 83.686 54.4788 83.686H50.9408C50.8676 83.686 50.7944 83.7165 50.7395 83.7653C50.6846 83.8202 50.6602 83.8873 50.6602 83.9666C50.6602 84.0459 50.6907 84.113 50.7395 84.1679C50.7944 84.2167 50.8676 84.2472 50.9408 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M45.4388 84.2472H48.4522C48.5254 84.2472 48.5986 84.2167 48.6535 84.1679C48.7084 84.113 48.7328 84.0459 48.7328 83.9666C48.7328 83.8873 48.7023 83.8202 48.6535 83.7653C48.5986 83.7104 48.5315 83.686 48.4522 83.686H45.4388C45.3656 83.686 45.2924 83.7165 45.2375 83.7653C45.1826 83.8202 45.1582 83.8873 45.1582 83.9666C45.1582 84.0459 45.1887 84.113 45.2375 84.1679C45.2924 84.2167 45.3656 84.2472 45.4388 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M40.5892 84.2472H43.078C43.1512 84.2472 43.2244 84.2167 43.2793 84.1679C43.3342 84.113 43.3586 84.0459 43.3586 83.9666C43.3586 83.8873 43.3281 83.8202 43.2793 83.7653C43.2244 83.7104 43.1573 83.686 43.078 83.686H40.5892C40.516 83.686 40.4428 83.7165 40.3879 83.7653C40.333 83.8202 40.3086 83.8873 40.3086 83.9666C40.3086 84.0459 40.3391 84.113 40.3879 84.1679C40.4489 84.2167 40.516 84.2472 40.5892 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M34.9588 84.2472H38.2345C38.3077 84.2472 38.3809 84.2167 38.4358 84.1679C38.4907 84.113 38.5151 84.0459 38.5151 83.9666C38.5151 83.8873 38.4846 83.8202 38.4358 83.7653C38.3809 83.7104 38.3138 83.686 38.2345 83.686H34.9588C34.8856 83.686 34.8124 83.7165 34.7575 83.7653C34.7026 83.8202 34.6782 83.8873 34.6782 83.9666C34.6782 84.0459 34.7087 84.113 34.7575 84.1679C34.8124 84.2167 34.8856 84.2472 34.9588 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M30.5057 84.2472H32.6041C32.6773 84.2472 32.7505 84.2167 32.8054 84.1679C32.8603 84.113 32.8847 84.0459 32.8847 83.9666C32.8847 83.8873 32.8542 83.8202 32.8054 83.7653C32.7505 83.7104 32.6834 83.686 32.6041 83.686H30.5057C30.4325 83.686 30.3593 83.7165 30.3044 83.7653C30.2495 83.8202 30.2251 83.8873 30.2251 83.9666C30.2251 84.0459 30.2556 84.113 30.3044 84.1679C30.3593 84.2167 30.4325 84.2472 30.5057 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M24.4793 84.2472H28.1454C28.2186 84.2472 28.2918 84.2167 28.3467 84.1679C28.4016 84.113 28.426 84.0459 28.426 83.9666C28.426 83.8873 28.3955 83.8202 28.3467 83.7653C28.2918 83.7104 28.2247 83.686 28.1454 83.686H24.4793C24.4061 83.686 24.3329 83.7165 24.278 83.7653C24.2231 83.8202 24.1987 83.8873 24.1987 83.9666C24.1987 84.0459 24.2292 84.113 24.278 84.1679C24.3329 84.2167 24.4061 84.2472 24.4793 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M19.5013 84.2472H22.1243C22.1975 84.2472 22.2707 84.2167 22.3256 84.1679C22.3805 84.113 22.4049 84.0459 22.4049 83.9666C22.4049 83.8873 22.3744 83.8202 22.3256 83.7653C22.2707 83.7104 22.2036 83.686 22.1243 83.686H19.5013C19.4281 83.686 19.3549 83.7165 19.3 83.7653C19.2451 83.8202 19.2207 83.8873 19.2207 83.9666C19.2207 84.0459 19.2512 84.113 19.3 84.1679C19.3549 84.2167 19.4281 84.2472 19.5013 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M13.8714 84.2472H17.0129C17.0861 84.2472 17.1593 84.2167 17.2142 84.1679C17.2691 84.113 17.2996 84.0459 17.2996 83.9666C17.2996 83.8873 17.2691 83.8202 17.2142 83.7653C17.1593 83.7104 17.0922 83.686 17.0129 83.686H13.8714C13.7982 83.686 13.725 83.7165 13.6701 83.7653C13.6152 83.8202 13.5908 83.8873 13.5908 83.9666C13.5908 84.0459 13.6213 84.113 13.6701 84.1679C13.725 84.2167 13.7982 84.2472 13.8714 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M8.89339 84.2472H11.5164C11.5896 84.2472 11.6628 84.2167 11.7177 84.1679C11.7726 84.113 11.797 84.0459 11.797 83.9666C11.797 83.8873 11.7665 83.8202 11.7177 83.7653C11.6628 83.7104 11.5957 83.686 11.5164 83.686H8.89339C8.82019 83.686 8.74699 83.7165 8.69209 83.7653C8.63719 83.8202 8.61279 83.8873 8.61279 83.9666C8.61279 84.0459 8.64329 84.113 8.69209 84.1679C8.74699 84.2167 8.82019 84.2472 8.89339 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M27.2426 105.628C27.3646 105.536 27.5415 105.561 27.633 105.689L49.6235 135.255C49.8065 135.499 50.1725 135.512 50.3677 135.268L60.939 122.012C61.366 121.476 62.1956 121.5 62.586 122.061L81.6424 149.273C81.8071 149.511 82.1426 149.542 82.35 149.34L94.0864 138.031C94.5073 137.628 95.1783 137.653 95.5687 138.086L109.288 153.336C109.391 153.452 109.385 153.629 109.269 153.732C109.153 153.836 108.976 153.83 108.873 153.714L95.1539 138.464C94.977 138.269 94.672 138.257 94.4829 138.44L82.7465 149.749C82.289 150.188 81.5509 150.115 81.191 149.597L62.1285 122.384C61.9516 122.128 61.5734 122.116 61.3782 122.36L50.8069 135.615C50.386 136.146 49.5808 136.128 49.1721 135.591L27.1877 106.018C27.0962 105.896 27.1206 105.719 27.2426 105.628Z"
                            fill="#010E30"
                          />
                          <path
                            d="M27.0958 108.214C26.4431 106.719 26.0893 105.109 26.0527 103.48L25.6989 103.749C26.4126 103.974 26.9738 104.481 27.535 104.956C28.1694 105.493 28.7916 106.036 29.4077 106.585C29.6822 106.823 30.0787 106.426 29.8042 106.189C29.1393 105.597 28.4683 105.017 27.7912 104.444C27.1995 103.944 26.6017 103.45 25.8514 103.212C25.8087 103.2 25.766 103.2 25.7233 103.206C25.6806 103.212 25.644 103.23 25.6074 103.261C25.5708 103.285 25.5464 103.322 25.5281 103.358C25.5098 103.395 25.4976 103.437 25.4976 103.48C25.5403 105.213 25.9246 106.914 26.62 108.5C26.7603 108.836 27.2422 108.549 27.0958 108.214Z"
                            fill="#010E30"
                          />
                          <path
                            d="M56.6933 70.6074C55.7539 70.6989 54.9487 71.2357 54.2472 71.8274C54.0886 71.9494 53.9605 72.1019 53.869 72.2788C53.7775 72.4557 53.7226 72.6448 53.7104 72.8461C53.6921 73.206 53.808 73.5659 54.0398 73.8404C54.6498 74.5785 55.7234 74.2918 56.5408 74.1576C56.9678 74.0905 57.468 74.06 57.8096 73.7611C58.1512 73.4622 58.2183 72.9742 58.1329 72.5411C58.0719 72.2849 57.9926 72.0287 57.8889 71.7847C57.7974 71.5285 57.7181 71.2601 57.6022 71.0161C57.3704 70.5281 56.8397 70.5403 56.3883 70.6623C56.3212 70.6867 56.2663 70.7355 56.2358 70.7965C56.2053 70.8575 56.1992 70.9307 56.2175 70.9978C56.2358 71.0649 56.2785 71.1259 56.3395 71.1625C56.4005 71.1991 56.4737 71.2113 56.5408 71.1991C56.6689 71.1564 56.797 71.132 56.9312 71.1381C57.0776 71.1564 57.1081 71.2601 57.1508 71.3943C57.285 71.7603 57.4375 72.1202 57.5412 72.4984C57.6205 72.7729 57.6693 73.1572 57.407 73.3585C57.1447 73.5598 56.7482 73.5476 56.4554 73.6025C56.0894 73.6757 55.7234 73.7245 55.3574 73.755C55.2049 73.7733 55.0524 73.7672 54.906 73.7245C54.7596 73.6818 54.6254 73.6147 54.5034 73.5171C54.418 73.4317 54.3509 73.328 54.3082 73.2121C54.2655 73.0962 54.2472 72.9742 54.2594 72.8522C54.2716 72.7302 54.3082 72.6143 54.3692 72.5045C54.4302 72.3947 54.5095 72.3032 54.6132 72.2361C55.1927 71.742 55.9125 71.2357 56.6872 71.1625C56.7604 71.1625 56.8336 71.132 56.8824 71.0771C56.9373 71.0222 56.9678 70.9551 56.9678 70.8819C56.9678 70.8087 56.9373 70.7355 56.8885 70.6806C56.8397 70.6379 56.7665 70.6074 56.6933 70.6074Z"
                            fill="#010E30"
                          />
                        </svg>
                        <p className="text-gray-500">No Strategy Deployed</p>
                      </div>
                    ) : (
                      <div className="p-6 flex flex-col items-center justify-center h-64 space-y-4">
                        <svg
                          width="184"
                          height="183"
                          viewBox="0 0 184 183"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M113.948 123.159L87.8705 117.358L82.1548 146.449L107.97 149.279L114.662 123.171L113.948 123.159Z"
                            fill="white"
                          />
                          <path
                            d="M121.585 122.738L133.218 150.804L156.221 145.961C156.221 145.961 160.576 145.546 160.716 145.808C160.857 146.07 148.089 116.632 148.089 116.632L121.585 122.939V122.738Z"
                            fill="white"
                          />
                          <path
                            d="M87.675 118.352L93.1101 90.8839L95.1536 80.7213L96.0503 80.7457L116.003 76.5733L129.673 73.7124L132.553 80.7396L135.895 88.4683L139.738 97.3438L145.161 109.879L148.553 117.7L146.18 118.133L140.952 118.956L135.755 120.048L129.863 121.542L125.684 122.701L122.14 123.891L117.48 112.399L114.655 123.928L102.364 120.67L94.2996 119.34L87.5469 118.584L87.675 118.352Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M106.262 156.91L105.786 158.673L104.084 159.143C104.084 159.143 93.9948 160.674 91.3352 160.949C88.6756 161.223 79.9831 161.888 77.3845 161.748C74.7798 161.613 71.1015 161.949 69.3508 160.857C67.6001 159.759 69.1495 155.696 69.5887 155.611C70.0279 155.532 78.1104 151.158 78.4825 150.926C78.8485 150.694 106.262 156.91 106.262 156.91Z"
                            fill="white"
                          />
                          <path
                            d="M127.746 68.0823L144.417 61.7139C145.723 63.9709 146.375 66.5512 146.302 69.1559C146.144 73.4198 146.528 73.2002 145.65 76.3356C144.771 79.4649 144.417 81.3132 142.966 83.5885C141.514 85.8638 140.263 87.645 139.049 88.4563C138.189 89.0175 137.293 89.5055 136.353 89.9264L129.814 74.1945L127.746 68.0823Z"
                            fill="white"
                          />
                          <path
                            d="M74.316 70.2721C74.316 70.2721 86.7112 74.9569 91.2862 74.6275C91.4631 77.5555 90.8897 80.4835 89.6148 83.1309C87.4981 87.4375 86.2781 90.2496 83.7039 92.3541C81.1297 94.4586 78.0248 97.8197 71.0037 96.5204C63.9826 95.2211 59.0172 88.4684 59.0172 88.4684C59.0172 88.4684 54.9546 82.771 54.2043 81.5022C53.454 80.2334 51.5935 77.3054 51.5935 77.3054C51.5935 77.3054 51.3861 76.9455 49.9099 77.22C48.4276 77.4884 45.8534 77.769 45.4569 76.9516C45.0604 76.1403 45.4569 75.2375 45.4569 75.2375C45.4569 75.2375 44.2613 75.4693 43.7367 74.7312C43.2121 73.9931 43.7367 73.0903 43.7367 73.0903C43.7367 73.0903 42.596 73.0598 42.2971 72.1448C41.9982 71.2298 41.7847 70.8089 42.2117 70.022C42.6326 69.2412 42.7363 68.3994 44.8469 67.4112C46.9575 66.4169 51.3312 64.7455 51.3312 64.7455C51.3312 64.7455 56.0953 63.3486 58.9379 63.4889C61.7805 63.6353 65.1538 63.8244 67.8988 65.1603C70.6438 66.4962 72.9801 67.9358 74.0903 69.4364C75.1883 70.937 74.316 70.2721 74.316 70.2721Z"
                            fill="white"
                          />
                          <path
                            d="M45.3412 75.1888C45.0728 75.6097 44.8288 76.1221 44.9508 76.6345C45.0484 77.0554 45.4083 77.3299 45.7926 77.4824C46.7869 77.885 48.0191 77.7569 49.0622 77.6227C49.6417 77.5495 50.209 77.4519 50.7763 77.3238C50.8678 77.2872 50.9654 77.275 51.063 77.2933C51.1606 77.3116 51.246 77.3665 51.3131 77.4336C51.5449 77.641 51.7462 77.8789 51.9109 78.1412C52.3013 78.7024 52.6063 79.3246 52.9479 79.9224C53.4542 80.8191 53.9849 81.7036 54.5278 82.5759C55.6258 84.3266 56.797 86.0163 58.0414 87.6633C59.2675 89.2859 60.5302 90.8963 62.0735 92.2322C63.3301 93.3119 64.7087 94.2452 66.1788 95.0199C67.3561 95.6543 68.6005 96.1667 69.8815 96.5327C72.0592 97.161 74.3589 97.2403 76.5732 96.7584C78.5984 96.2765 80.4894 95.3615 82.1303 94.0805C83.8261 92.7568 85.3145 91.183 86.5406 89.4201C87.7789 87.6633 88.822 85.7723 89.6455 83.7837C90.4141 81.9781 90.9875 80.0932 91.3596 78.1656C91.6463 76.6101 91.811 74.9814 91.5975 73.4076C91.5548 73.1148 91.4999 72.822 91.4267 72.5353C91.4023 72.4682 91.3535 72.4072 91.2925 72.3767C91.2315 72.3401 91.1522 72.334 91.0851 72.3523C91.018 72.3706 90.957 72.4133 90.9204 72.4804C90.8838 72.5475 90.8716 72.6146 90.8838 72.6878C91.0424 73.2917 91.1217 73.9139 91.1278 74.5361C91.1461 75.3047 91.1034 76.0794 90.9997 76.8419C90.7557 78.6597 90.3104 80.447 89.676 82.1733C88.9806 84.1192 88.0778 85.9797 86.992 87.7365C85.9001 89.5238 84.5703 91.1586 83.0453 92.586C81.5752 93.9707 79.8489 95.0565 77.9579 95.7702C75.9876 96.49 73.8709 96.7035 71.7969 96.3924C69.1983 95.9959 66.7766 94.8735 64.5928 93.44C63.0373 92.4274 61.6343 91.1952 60.4265 89.78C59.115 88.2245 57.895 86.5958 56.736 84.9244C55.5831 83.253 54.4973 81.5328 53.4908 79.7638C53.1553 79.1721 52.8442 78.556 52.466 77.9826C52.1671 77.5251 51.7523 76.8968 51.1911 76.7504C50.941 76.6894 50.697 76.7809 50.4408 76.8297C50.1663 76.8907 49.8918 76.9395 49.6112 76.9883C49.0317 77.0859 48.4461 77.153 47.8605 77.1774C47.342 77.214 46.8174 77.1774 46.305 77.0737C46.1159 77.031 45.9268 76.9578 45.7621 76.8541C45.6462 76.787 45.5608 76.6894 45.4998 76.5735C45.4571 76.4393 45.451 76.299 45.4876 76.1648C45.5547 75.9208 45.6645 75.6829 45.8109 75.4755C46.0061 75.1644 45.5303 74.8838 45.3412 75.1888Z"
                            fill="#010E30"
                          />
                          <path
                            d="M73.8525 59.9936C73.8525 59.9936 71.7663 67.7894 71.7358 69.5035C71.7358 69.5035 78.0432 72.0899 80.5015 72.5779C82.9598 73.0659 88.7426 74.902 89.7735 74.8837C90.8044 74.8654 91.2802 74.6275 91.2802 74.6275L91.0911 73.926L92.2257 76.0061L95.294 80.8983L116.668 76.5551L128.533 74.1456L129.607 73.926L127.941 67.887C127.941 67.887 135.432 65.874 136.872 65.3494C138.305 64.8309 144.869 62.0859 144.869 62.0859C144.869 62.0859 141.819 57.0595 140.916 55.8151C140.013 54.5646 134.572 47.9156 131.418 45.7684C128.271 43.6212 122.97 40.9555 122.97 40.9555C122.97 40.9555 117.699 37.875 110.324 38.2715L103.462 38.2349L96.0687 39.5281C96.0687 39.5281 86.0159 42.5659 81.2823 47.1043C76.5487 51.6427 73.8525 59.9936 73.8525 59.9936Z"
                            fill="#E9E9E9"
                          />
                          <path
                            d="M144.179 61.8482C145.125 63.6904 145.717 65.6973 145.912 67.7591C146.137 69.9612 146.076 72.1816 145.723 74.3654C145.387 76.5736 144.795 78.733 143.96 80.8009C143.222 82.698 142.221 84.4792 140.983 86.0896C139.934 87.4133 138.659 88.6211 137.116 89.3348C136.945 89.4141 136.774 89.4812 136.603 89.5422C136.268 89.6642 136.414 90.2071 136.75 90.0851C138.384 89.4934 139.763 88.3649 140.898 87.0656C142.233 85.4979 143.319 83.7411 144.131 81.8501C145.052 79.7639 145.729 77.5679 146.137 75.3231C146.564 73.0722 146.705 70.7725 146.546 68.4789C146.412 66.3195 145.887 64.2028 145.003 62.2325C144.893 62.0007 144.783 61.775 144.661 61.5554C144.49 61.2382 144.002 61.5188 144.173 61.836L144.179 61.8482Z"
                            fill="#010E30"
                          />
                          <path
                            d="M90.5604 41.3643C97.2521 39.1195 104.304 38.1313 111.355 38.4546C113.728 38.5644 116.107 38.8206 118.395 39.4916C120.64 40.1565 122.787 41.1386 124.891 42.1512C126.916 43.1211 128.893 44.213 130.698 45.555C132.913 47.2325 134.968 49.1174 136.841 51.1731C139.501 54.0706 141.782 57.2975 143.63 60.7684C143.887 61.2503 144.137 61.7444 144.381 62.2324C144.539 62.5557 145.027 62.2751 144.863 61.9518C143.057 58.2552 140.776 54.8148 138.073 51.7099C136.127 49.459 133.968 47.4033 131.632 45.5672C130.058 44.3533 128.374 43.2858 126.605 42.383C124.531 41.2911 122.39 40.3334 120.194 39.5099C115.723 37.8629 110.831 37.686 106.103 37.9056C101.345 38.1252 96.636 38.9304 92.0793 40.3029C91.5242 40.4676 90.9752 40.6445 90.4262 40.8275C90.0846 40.9434 90.2371 41.4863 90.5787 41.3704L90.5604 41.3643Z"
                            fill="#010E30"
                          />
                          <path
                            d="M71.8396 69.5765C72.4008 65.5932 73.4317 61.6953 74.9018 57.9499C75.6399 56.0772 76.4878 54.2472 77.4394 52.4782C77.903 51.5876 78.4215 50.7275 78.9949 49.8979C79.5866 49.0988 80.2637 48.3607 81.014 47.7019C82.7891 46.1281 84.6557 44.658 86.6016 43.2977C86.8395 43.1269 86.7053 42.6633 86.382 42.7853L85.9001 42.9744C85.5646 43.1025 85.711 43.6454 86.0526 43.5173L86.5345 43.3282L86.3149 42.8158C84.5764 44.0602 82.8745 45.3656 81.258 46.7503C80.4711 47.3969 79.7452 48.1167 79.0803 48.8853C78.4459 49.6722 77.8786 50.514 77.3967 51.4046C74.2674 56.98 72.2056 63.0861 71.3089 69.4179C71.2906 69.4911 71.3028 69.5643 71.3333 69.6253C71.3699 69.6863 71.4248 69.7351 71.4919 69.7595C71.5651 69.7778 71.6383 69.7717 71.7054 69.7351C71.7725 69.7107 71.8213 69.6497 71.8396 69.5765Z"
                            fill="#010E30"
                          />
                          <path
                            d="M80.8736 57.9439C81.2091 59.4506 81.996 60.8109 83.1306 61.854C83.399 62.098 83.7955 61.7015 83.5271 61.4575C82.4657 60.4815 81.7276 59.2066 81.4165 57.8036C81.3372 57.4498 80.7943 57.6023 80.8736 57.9561V57.9439Z"
                            fill="#010E30"
                          />
                          <path
                            d="M91.0852 42.474L93.7082 45.4691C93.8729 45.6948 94.0925 45.8717 94.3426 45.9876C94.6232 46.0669 94.9282 46.0547 95.2027 45.9632C96.4715 45.646 97.6305 44.9933 98.5638 44.0722C99.1921 43.45 99.7289 42.5899 99.5215 41.7298C99.3751 41.132 98.8932 40.6806 98.4357 40.2658L97.5939 39.5094C97.1791 39.1373 96.7521 38.7469 96.2275 38.5395C95.4101 38.2101 94.4585 38.3626 93.6716 38.7713C92.8908 39.18 92.2503 39.8144 91.6708 40.4793C91.2377 40.9673 90.8046 41.6017 91.0059 42.2239L91.0852 42.474Z"
                            fill="white"
                          />
                          <path
                            d="M90.8835 42.6756L92.805 44.8777C93.11 45.2254 93.4028 45.6097 93.7383 45.933C93.8786 46.0733 94.0433 46.1831 94.2263 46.2502C94.4093 46.3173 94.6106 46.3478 94.8058 46.3295C95.5988 46.2624 96.4223 45.9025 97.1116 45.5182C97.8314 45.1278 98.4719 44.6154 99.0148 44.0054C99.5211 43.4137 99.9298 42.6634 99.8139 41.8582C99.698 41.053 99.0636 40.4918 98.5024 39.9733C97.8802 39.4121 97.258 38.7228 96.4833 38.3629C95.7269 38.0396 94.8729 38.0152 94.1043 38.3019C93.2198 38.613 92.4878 39.2169 91.8595 39.8818C91.2556 40.5162 90.4626 41.3519 90.7371 42.3157C90.7615 42.3828 90.8042 42.4438 90.8713 42.4804C90.9323 42.517 91.0116 42.5231 91.0787 42.5048C91.1519 42.4865 91.2068 42.4377 91.2434 42.3767C91.28 42.3157 91.2922 42.2364 91.2739 42.1693C91.0726 41.4678 91.7558 40.809 92.195 40.3454C92.683 39.7903 93.2686 39.3328 93.9213 38.9912C94.5557 38.6618 95.2938 38.5825 95.9831 38.7716C96.7029 38.9912 97.2519 39.5951 97.7948 40.0831C98.2889 40.5284 98.9294 40.9859 99.1917 41.6203C99.454 42.2547 99.1429 42.9745 98.7342 43.493C97.868 44.591 96.5199 45.3657 95.1718 45.7073C94.9827 45.7683 94.7814 45.7927 94.5801 45.7805C94.3788 45.7378 94.1958 45.628 94.0677 45.4633C93.7627 45.14 93.476 44.7923 93.1832 44.4568L91.2861 42.2852C91.0482 42.0046 90.6517 42.4011 90.8835 42.6756Z"
                            fill="#010E30"
                          />
                          <path
                            d="M75.5725 39.8637C76.762 40.0223 77.6587 39.3574 78.7689 39.1805C80.5074 38.906 82.1239 38.1374 83.8075 37.6067C86.6806 36.6917 89.7184 36.4843 92.7135 36.1183C93.3967 36.0573 94.0677 35.9231 94.7265 35.7218C95.1962 35.551 95.6598 35.3497 96.1051 35.124C97.075 34.6604 98.0937 34.2944 99.1429 34.0382C99.9115 33.8491 100.155 33.0134 99.9298 32.2814C99.8261 31.952 99.6248 31.6653 99.3625 31.4457C99.0941 31.2261 98.7769 31.0919 98.4353 31.0492C98.5512 30.1037 98.661 29.1399 98.5024 28.2005C98.3499 27.2611 97.8985 26.3278 97.1116 25.791C96.3247 25.2542 95.1657 25.2298 94.4642 25.8642C93.8176 22.7105 90.6822 20.2644 87.4675 20.4047C86.2109 20.4352 84.997 20.8927 84.0271 21.6918C83.0877 22.5092 82.4777 23.7536 82.5509 24.9858C81.8738 24.2599 80.9893 23.7719 80.0133 23.5828C79.0373 23.3998 78.0308 23.534 77.1402 23.961C76.2496 24.388 75.5176 25.0956 75.054 25.974C74.5904 26.8524 74.4196 27.8528 74.566 28.8288C74.6758 29.5791 75.0479 30.3843 75.7555 30.6771C74.2915 30.5795 72.6445 30.8845 71.7722 32.0679C71.2354 32.806 71.089 33.7759 71.2293 34.6787C71.4001 35.5754 71.7478 36.4294 72.248 37.198C73.0105 38.4546 74.1146 39.6685 75.5725 39.8637Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M75.5727 40.144C76.4999 40.2538 77.3173 39.8756 78.1835 39.6072C78.6349 39.4669 79.1046 39.4181 79.5621 39.3083C80.0684 39.1924 80.5625 39.0399 81.0627 38.8691C82.0326 38.5397 82.9903 38.1493 83.9724 37.8443C84.9728 37.5393 85.9976 37.2953 87.0285 37.1184C89.1086 36.7524 91.2192 36.606 93.3054 36.3132C93.7995 36.2522 94.2875 36.1485 94.7633 35.996C95.2452 35.8252 95.7149 35.6239 96.1724 35.3921C97.124 34.9407 98.1183 34.5808 99.137 34.3124C100.009 34.0928 100.406 33.2937 100.259 32.4397C100.174 32.0005 99.9544 31.5979 99.625 31.2929C99.2956 30.9879 98.8747 30.7988 98.4294 30.75L98.71 31.0306C98.9113 29.4019 99.0394 27.5902 97.9597 26.2116C97.0874 25.0892 95.3855 24.65 94.2509 25.6504L94.7206 25.7724C94.2631 23.5947 92.6771 21.7342 90.6763 20.7887C88.5291 19.7761 85.8329 19.8493 83.9297 21.3743C83.3929 21.8013 82.9598 22.3503 82.667 22.9725C82.3742 23.5947 82.2339 24.2779 82.2522 24.9672L82.7341 24.7659C82.057 24.0461 81.1847 23.5459 80.2209 23.3263C79.2571 23.1128 78.2506 23.186 77.3295 23.552C76.4084 23.918 75.6215 24.5463 75.0664 25.3637C74.5113 26.1811 74.2185 27.1449 74.2185 28.1331C74.2063 29.1701 74.5601 30.4328 75.5971 30.8903L75.7374 30.3657C73.9013 30.2559 71.7846 30.7805 71.0953 32.6898C70.3755 34.6784 71.5223 36.911 72.7911 38.4177C73.4865 39.2412 74.3954 39.9366 75.4873 40.0952C75.5605 40.1135 75.6337 40.1013 75.6947 40.0708C75.7618 40.0342 75.8045 39.9793 75.8289 39.9122C75.8472 39.839 75.8411 39.7658 75.7984 39.6987C75.7618 39.6316 75.7008 39.5889 75.6276 39.5645C73.8525 39.3083 72.663 37.5881 71.9493 36.0814C71.5406 35.2213 71.2966 34.2331 71.504 33.2876C71.5894 32.8728 71.7663 32.4885 72.0286 32.153C72.2909 31.8175 72.6203 31.5491 73.0046 31.3661C73.8403 30.9513 74.8163 30.8781 75.7313 30.933C75.9997 30.9452 76.1278 30.5182 75.8716 30.4084C75.0725 30.0546 74.798 29.1152 74.7736 28.3039C74.7553 27.4438 74.981 26.602 75.4263 25.87C75.8655 25.1319 76.5121 24.5463 77.2868 24.1864C78.0615 23.8265 78.9277 23.7045 79.7756 23.8387C80.7455 23.9851 81.6422 24.4426 82.3254 25.1502C82.3681 25.1868 82.4169 25.2112 82.4718 25.2234C82.5267 25.2356 82.5816 25.2295 82.6304 25.2051C82.6792 25.1868 82.728 25.1502 82.7585 25.1014C82.789 25.0526 82.8073 25.0038 82.8073 24.9489C82.789 24.3877 82.8988 23.8265 83.1184 23.308C83.338 22.7895 83.6735 22.3259 84.0883 21.9538C84.9728 21.1791 86.0952 20.7216 87.2725 20.6606C89.3038 20.5203 91.2924 21.4475 92.6405 22.942C93.3969 23.7777 93.9154 24.8025 94.1533 25.9005C94.1655 25.9493 94.196 25.992 94.2265 26.0225C94.2631 26.0591 94.3058 26.0835 94.3546 26.0957C94.4034 26.1079 94.4522 26.1079 94.501 26.0957C94.5498 26.0835 94.5925 26.0591 94.6291 26.0225C94.8548 25.8395 95.1232 25.7114 95.4099 25.6565C95.6966 25.6016 95.9955 25.6138 96.2761 25.6931C96.8556 25.8578 97.3497 26.2421 97.6608 26.7606C98.466 28.0294 98.2952 29.591 98.1244 31.0062C98.1061 31.1709 98.2708 31.2685 98.405 31.2868C98.7588 31.3356 99.0882 31.5125 99.3261 31.7809C99.564 32.0493 99.6982 32.3909 99.7104 32.7508C99.7165 32.8972 99.6982 33.0497 99.6433 33.19C99.5884 33.3303 99.503 33.4584 99.3993 33.556C99.2712 33.6536 99.1248 33.7146 98.9723 33.7451C98.7344 33.8061 98.4965 33.8671 98.2586 33.9403C97.3314 34.2392 96.4286 34.5991 95.5563 35.0261C95.1171 35.2396 94.6657 35.4165 94.1899 35.5385C93.7263 35.6483 93.2627 35.7276 92.7869 35.7825C90.841 36.0204 88.8829 36.1912 86.9431 36.5328C85.9671 36.6975 85.0033 36.9171 84.0578 37.1916C83.1367 37.4661 82.2461 37.8199 81.3433 38.131C80.8431 38.3201 80.3368 38.4787 79.8183 38.619C79.2998 38.7593 78.8057 38.8081 78.3055 38.9423C77.3844 39.1741 76.5365 39.6499 75.5544 39.5401C75.2128 39.5401 75.2189 40.1013 75.5727 40.144Z"
                            fill="#010E30"
                          />
                          <path
                            d="M93.3299 29.6706C89.4503 28.2066 86.6748 28.6763 83.942 30.4026C82.8806 31.0431 81.9961 31.9337 81.3617 32.9951C80.9164 33.8247 80.6236 34.7275 80.5016 35.6669C80.1966 37.5457 80.4528 39.4672 81.2519 41.1935C82.0754 42.8954 83.5211 44.3167 85.2901 44.9633C86.87 45.5428 88.7488 45.8844 90.3775 45.4452C92.0062 45.006 94.0558 43.8226 95.0623 42.7734C97.2339 40.4798 97.423 38.7962 97.2644 35.8316C97.1302 33.2574 95.3429 30.7442 93.0432 29.5669L93.3299 29.6706Z"
                            fill="white"
                          />
                          <path
                            d="M93.4031 29.4018C91.6585 28.743 89.7858 28.3465 87.9131 28.5966C86.2356 28.8406 84.6496 29.4994 83.2893 30.5059C82.5085 31.0488 81.8375 31.732 81.3007 32.5128C80.7578 33.3851 80.3979 34.355 80.2454 35.3737C79.8794 37.3745 80.1356 39.4424 80.9774 41.2968C81.7338 42.9133 83.0331 44.2248 84.6435 44.9995C85.5463 45.4082 86.504 45.6888 87.4861 45.823C88.4804 45.9938 89.5052 45.9511 90.4812 45.7071C91.3413 45.457 92.1709 45.1032 92.9456 44.6579C93.7142 44.2492 94.4218 43.7429 95.0623 43.1573C96.1969 42.0776 97.1119 40.6807 97.4108 39.1252C97.545 38.3688 97.5999 37.6002 97.5694 36.8316C97.5816 35.9593 97.4779 35.0809 97.2522 34.2391C96.7276 32.5372 95.6723 31.0488 94.2449 29.9935C93.9033 29.7434 93.5434 29.5177 93.1652 29.3286C92.848 29.1639 92.5613 29.6458 92.8785 29.8166C94.3608 30.5974 95.5564 31.8357 96.2884 33.3485C96.996 34.7942 97.0753 36.429 96.9716 38.015C96.8923 39.418 96.3677 40.7661 95.471 41.8519C94.4157 43.1634 93.0249 44.0906 91.4877 44.7616C90.7008 45.1215 89.8529 45.3289 88.9867 45.3777C88.0107 45.396 87.0408 45.2557 86.1075 44.9629C85.2718 44.7311 84.4788 44.359 83.7651 43.8588C83.1002 43.3708 82.5207 42.773 82.0571 42.0837C81.0018 40.5465 80.5565 38.6677 80.6358 36.8194C80.6602 35.8495 80.8432 34.8918 81.1787 33.9829C81.5081 33.1167 82.0327 32.3359 82.7098 31.7015C83.8993 30.5852 85.345 29.78 86.9249 29.3652C88.5475 28.9382 90.225 29.0602 91.8354 29.4994C92.3051 29.6275 92.7687 29.7861 93.2323 29.9569C93.5739 30.085 93.7203 29.5421 93.3848 29.414L93.4031 29.4018Z"
                            fill="#010E30"
                          />
                          <path
                            d="M86.1989 40.7909C86.3209 41.0959 86.3636 41.4314 86.327 41.7547C86.2904 42.0841 86.1684 42.3952 85.9793 42.6636C85.961 42.6941 85.9427 42.7307 85.9366 42.7673C85.9305 42.8039 85.9305 42.8405 85.9427 42.8771C85.9488 42.9137 85.9671 42.9503 85.9915 42.9808C86.0159 43.0113 86.0403 43.0357 86.0769 43.054C86.1074 43.0723 86.144 43.0845 86.1806 43.0906C86.2172 43.0967 86.2538 43.0906 86.2904 43.0845C86.327 43.0723 86.3636 43.054 86.388 43.0357C86.4185 43.0113 86.4429 42.9808 86.4612 42.9503C86.6991 42.5965 86.8455 42.1878 86.8821 41.7608C86.9187 41.3338 86.8516 40.9068 86.6808 40.5164C86.6442 40.4554 86.5832 40.4066 86.51 40.3883C86.4368 40.37 86.3636 40.3822 86.2965 40.4188C86.2355 40.4554 86.1867 40.5164 86.1684 40.5896C86.1562 40.6567 86.1623 40.7299 86.1989 40.7909Z"
                            fill="#010E30"
                          />
                          <path
                            d="M88.0288 41.3031C88.7547 41.3031 88.7547 40.1807 88.0288 40.1807C87.3029 40.1746 87.3029 41.3031 88.0288 41.3031Z"
                            fill="#010E30"
                          />
                          <path
                            d="M85.1559 41.5775C85.8818 41.5775 85.8818 40.4551 85.1559 40.4551C84.43 40.4551 84.4361 41.5775 85.1559 41.5775Z"
                            fill="#010E30"
                          />
                          <path
                            d="M86.8392 39.656C86.9795 39.0765 87.2418 38.5275 87.6017 38.0517C87.7725 37.8016 87.9982 37.5881 88.2605 37.4356C88.5228 37.277 88.8095 37.1794 89.1145 37.1428C90.3406 36.9537 91.8534 37.2587 92.5793 38.3506C92.9148 38.863 93.0795 39.4669 93.049 40.0769C93.0185 40.6869 92.7989 41.2725 92.4146 41.7483C91.6216 42.7243 90.1698 43.3099 88.962 42.8158C88.2971 42.5291 87.7298 42.0472 87.3394 41.4372C87.1686 41.1566 87.0344 40.8638 86.9368 40.5527C86.8514 40.2416 86.8209 39.9183 86.8575 39.595C86.8819 39.2351 86.3207 39.2351 86.2963 39.595C86.2109 41.0651 87.0832 42.3339 88.3032 43.1025C89.6391 43.9443 91.4203 43.5234 92.5183 42.4742C93.0429 41.9801 93.4028 41.3396 93.5492 40.6381C93.6956 39.9366 93.6224 39.2046 93.3357 38.5397C92.7074 37.1001 91.1397 36.4962 89.6452 36.5328C88.7973 36.5511 87.9677 36.7646 87.3943 37.4234C86.8636 38.0151 86.4915 38.7288 86.3085 39.5035C86.2353 39.8573 86.7782 40.0098 86.8514 39.6499V39.656H86.8392Z"
                            fill="#010E30"
                          />
                          <path
                            d="M78.6103 151.005L70.6681 154.818C70.6681 154.818 68.2647 156.105 68.6246 158.484C68.9845 160.863 88.2605 158.954 88.2605 158.954C88.2605 158.954 82.2093 151.75 80.2573 151.609C78.3053 151.475 78.6103 151.005 78.6103 151.005Z"
                            fill="#E9E9E9"
                          />
                          <path
                            d="M79.8426 40.6199C79.9829 40.0343 80.2452 39.4914 80.6112 39.0156C80.782 38.7655 81.0077 38.552 81.27 38.3995C81.5323 38.2409 81.819 38.1433 82.124 38.1006C83.3501 37.9115 84.8629 38.2165 85.5888 39.3084C85.9243 39.8208 86.089 40.4247 86.0585 41.0347C86.028 41.6447 85.8084 42.2303 85.4241 42.7061C84.6311 43.6882 83.1854 44.2677 81.9715 43.7736C81.3066 43.4869 80.7393 43.005 80.3489 42.395C80.1781 42.1144 80.0439 41.8216 79.9463 41.5105C79.8609 41.1994 79.8304 40.8761 79.8609 40.5528C79.8853 40.1929 79.3241 40.1929 79.2997 40.5528C79.2143 42.0229 80.0866 43.2917 81.3066 44.0603C82.6425 44.9021 84.4237 44.4812 85.5217 43.432C86.0463 42.944 86.4001 42.3035 86.5465 41.5959C86.6929 40.8944 86.6197 40.1624 86.333 39.5036C85.7047 38.064 84.137 37.4601 82.6425 37.4967C81.7946 37.515 80.965 37.7285 80.3977 38.3873C79.867 38.979 79.4888 39.6927 79.2997 40.4674C79.2265 40.8212 79.7694 40.9737 79.8426 40.6199Z"
                            fill="#010E30"
                          />
                          <path
                            d="M102.657 33.1901C102.492 32.9278 102.266 32.7021 101.998 32.5374C101.736 32.3727 101.437 32.269 101.126 32.2324C100.43 32.1531 99.7347 32.3056 99.1308 32.6655C98.411 33.062 97.7888 33.6293 97.1605 34.1417L95.0377 35.868L92.6282 37.8261C92.3476 38.0518 92.7441 38.4483 93.0247 38.2226L96.9104 35.0689C97.5143 34.5809 98.106 34.0685 98.7282 33.6049C99.2589 33.2145 99.8689 32.8241 100.546 32.7753C101.162 32.7265 101.839 32.9217 102.175 33.4768C102.211 33.5439 102.272 33.5866 102.346 33.6049C102.419 33.6232 102.492 33.611 102.559 33.5744C102.626 33.5378 102.669 33.4768 102.687 33.4036C102.699 33.3365 102.687 33.2572 102.657 33.1901Z"
                            fill="#010E30"
                          />
                          <path
                            d="M95.3184 36.2035C95.5807 35.5447 96.0931 35.014 96.7397 34.7273C97.063 34.5931 97.4229 34.5504 97.7706 34.6053C98.1183 34.6602 98.4416 34.8127 98.71 35.0445C99.1187 35.4288 99.2956 36.0022 99.3566 36.5573C99.4298 37.1063 99.3688 37.6614 99.1675 38.1799C99.0638 38.4361 98.9113 38.6679 98.7161 38.857C98.5209 39.0522 98.2891 39.1986 98.0329 39.3023C97.5571 39.4487 97.0386 39.4365 96.5689 39.2596C96.2151 39.1376 95.8552 38.9363 95.7149 38.5886L95.3184 36.2035Z"
                            fill="white"
                          />
                          <path
                            d="M95.5624 36.3439C95.7942 35.7522 96.2456 35.2642 96.819 34.9958C97.1057 34.8677 97.429 34.8311 97.7401 34.8799C98.0512 34.9348 98.3379 35.0751 98.5697 35.2886C99.0577 35.7949 99.1492 36.6306 99.0943 37.2955C99.0394 37.9604 98.7222 38.668 98.0817 38.9791C97.6791 39.1499 97.2216 39.1743 96.8068 39.0401C96.4652 38.9425 96.1175 38.79 95.965 38.4484C95.8125 38.1068 95.3306 38.4057 95.477 38.7351C95.8369 39.5342 97.0081 39.7843 97.7889 39.6562C98.6734 39.5098 99.3139 38.7656 99.5457 37.936C99.7775 37.1064 99.7043 36.0206 99.2529 35.2581C99.0272 34.9043 98.7039 34.6237 98.3196 34.459C97.9353 34.2943 97.5083 34.2455 97.0996 34.3248C96.1602 34.4773 95.4404 35.2154 95.0805 36.0511C94.9402 36.3805 95.4221 36.6672 95.5685 36.3317V36.3439H95.5624Z"
                            fill="#010E30"
                          />
                          <path
                            d="M96.831 37.4234C96.831 37.46 96.831 37.4661 96.831 37.4478V37.4173C96.8188 37.4783 96.8432 37.4295 96.831 37.4173C96.8371 37.399 96.8493 37.3807 96.8615 37.3563C96.8981 37.2892 96.9347 37.2282 96.9835 37.1672C96.9591 37.1977 97.014 37.1245 96.9835 37.1672C96.9957 37.155 97.0018 37.1428 97.014 37.1306L97.0872 37.0513C97.136 37.0025 97.1848 36.9476 97.2397 36.9049C97.2702 36.8866 97.2946 36.8622 97.319 36.8378C97.2824 36.8683 97.3007 36.8622 97.319 36.8378L97.3617 36.8073C97.4227 36.7646 97.4837 36.728 97.5508 36.6975C97.6118 36.6609 97.6789 36.6365 97.7399 36.606C97.6972 36.6243 97.7155 36.6182 97.7399 36.606L97.7826 36.5877L97.8924 36.5511C97.9595 36.5267 98.0205 36.484 98.0571 36.4169C98.0937 36.3498 98.0998 36.2766 98.0815 36.2095C98.0632 36.1363 98.0144 36.0814 97.9534 36.0448C97.8924 36.0082 97.8131 35.996 97.746 36.0143C97.4044 36.118 97.0933 36.2949 96.831 36.5328C96.7029 36.6548 96.587 36.7829 96.4833 36.9293C96.4101 37.0147 96.3613 37.1184 96.3308 37.2221C96.3003 37.3319 96.2942 37.4417 96.3125 37.5576C96.3308 37.6308 96.3796 37.6918 96.4467 37.7284C96.5138 37.765 96.587 37.7772 96.6602 37.7589C96.7334 37.7345 96.7883 37.6918 96.8249 37.6247C96.8615 37.5576 96.8737 37.4844 96.8554 37.4112L96.831 37.4234Z"
                            fill="#010E30"
                          />
                          <path
                            d="M80.2882 62.3603C81.1666 62.5982 82.0572 62.7995 82.9112 63.0862C83.1003 63.135 83.2833 63.2143 83.448 63.3241C83.3931 63.2814 83.4724 63.3424 83.4846 63.3607L83.4724 63.3485C83.4846 63.3668 83.4968 63.3912 83.509 63.4156C83.5761 63.562 83.6615 63.6962 83.7347 63.8365C84.4728 65.1724 85.3207 66.4473 86.1686 67.7161C88.206 70.7356 90.3715 73.6758 92.3479 76.7319C93.2568 78.1349 94.1535 79.5623 94.8428 81.0873C94.8733 81.1422 94.9221 81.1788 94.977 81.2032C95.0319 81.2276 95.099 81.2337 95.1539 81.2154L96.0872 81.0263L98.5943 80.52L102.297 79.7697L106.835 78.8486L111.789 77.8421L116.809 76.8234L121.469 75.8779L125.428 75.0727L128.265 74.481C128.71 74.3895 129.168 74.3163 129.613 74.2065C129.631 74.2065 129.649 74.2065 129.668 74.1943C129.735 74.1699 129.796 74.1211 129.832 74.0601C129.869 73.993 129.875 73.9198 129.857 73.8466C128.734 69.9731 127.63 66.0935 126.526 62.22C125.965 60.2741 125.379 58.3465 124.733 56.4311C124.172 54.7475 123.58 53.07 122.988 51.3925C122.866 51.0509 122.329 51.2034 122.445 51.545C123.33 54.0826 124.239 56.6141 125.038 59.1761C125.752 61.4697 126.38 63.7816 127.039 66.0935C127.789 68.7348 128.545 71.37 129.314 74.0052L129.503 73.6575L128.576 73.8466L126.069 74.3529L122.366 75.1032L117.828 76.0243L112.874 77.0308L107.854 78.0495L103.194 78.995L99.2348 79.8002L96.4044 80.3736C95.9591 80.4651 95.4894 80.52 95.0563 80.6481L95.0014 80.6603L95.3186 80.7884C94.6903 79.4464 93.9644 78.1532 93.1531 76.9149C92.1649 75.3655 91.1218 73.8527 90.0726 72.346C89.0234 70.8393 87.9376 69.3021 86.8884 67.7649C86.0039 66.4656 85.1255 65.1419 84.3508 63.7755C84.2044 63.5193 84.0885 63.1838 83.8872 62.9642C83.7103 62.8056 83.509 62.6897 83.2833 62.6226C82.3683 62.2749 81.3862 62.0797 80.4407 61.8235C80.3675 61.8113 80.2943 61.8235 80.2333 61.8601C80.1723 61.8967 80.1235 61.9577 80.1052 62.0248C80.0869 62.0919 80.093 62.1651 80.1296 62.2322C80.1662 62.2932 80.2272 62.342 80.2882 62.3603Z"
                            fill="#010E30"
                          />
                          <path
                            d="M87.602 39.5587C87.6264 39.5404 87.6264 39.5404 87.602 39.5587L87.6386 39.5343L87.6996 39.4977C87.7118 39.4977 87.7972 39.455 87.7362 39.4794L87.7972 39.455L87.8826 39.4367C87.907 39.4367 87.9436 39.4245 87.8948 39.4367C87.9497 39.4306 88.0107 39.4306 88.0656 39.4367H88.151H88.1876C88.2486 39.4489 88.3035 39.4611 88.3645 39.4794C88.4255 39.4977 88.4804 39.516 88.5353 39.5404C88.5475 39.5404 88.6268 39.577 88.578 39.5526L88.6695 39.5953C88.7366 39.6319 88.8098 39.6441 88.883 39.6197C88.9562 39.6014 89.0172 39.5526 89.0538 39.4916C89.0904 39.4245 89.1026 39.3513 89.0782 39.2781C89.0599 39.2049 89.0111 39.1439 88.9501 39.1073C88.6695 38.9609 88.3584 38.8755 88.0412 38.8572C87.7362 38.8511 87.4373 38.9548 87.1994 39.1561C87.1506 39.211 87.1201 39.2781 87.1201 39.3574C87.1201 39.4306 87.1506 39.5038 87.1994 39.5587C87.2543 39.6075 87.3214 39.638 87.4007 39.638C87.48 39.638 87.5471 39.6136 87.602 39.5587Z"
                            fill="#010E30"
                          />
                          <path
                            d="M84.9971 39.1011C84.6616 39.1072 84.3261 39.1743 84.015 39.3024C83.8564 39.3634 83.71 39.4549 83.588 39.5708C83.466 39.6928 83.3745 39.8331 83.3135 39.9917C83.3013 40.0283 83.3013 40.0649 83.3013 40.1015C83.3074 40.1381 83.3135 40.1747 83.3318 40.2052C83.3501 40.2357 83.3745 40.2662 83.405 40.2906C83.4355 40.315 83.466 40.3333 83.5026 40.3394C83.5392 40.3516 83.5758 40.3516 83.6124 40.3455C83.649 40.3394 83.6856 40.3272 83.7161 40.3089C83.7466 40.2906 83.7771 40.2662 83.8015 40.2357C83.8259 40.2052 83.8381 40.1686 83.8503 40.132C83.8503 40.132 83.8503 40.0954 83.8625 40.0893C83.8381 40.132 83.8747 40.0832 83.8625 40.0893C83.8686 40.0771 83.8747 40.0649 83.8869 40.0527C83.8869 40.0527 83.9296 39.9978 83.9052 40.0283C83.8808 40.0588 83.9174 40.0283 83.9174 40.0161C83.9235 40.0039 83.9357 39.9978 83.9479 39.9856C83.9601 39.9734 83.9906 39.949 84.015 39.9246C83.9784 39.949 84.0394 39.9063 84.015 39.9246L84.0638 39.888L84.1431 39.8392L84.2285 39.7965L84.2712 39.7782C84.32 39.7538 84.2468 39.7782 84.2834 39.7782C84.4054 39.7355 84.5335 39.6989 84.6555 39.6745H84.7043C84.7226 39.6745 84.7348 39.6745 84.7043 39.6745L84.7958 39.6623C84.869 39.6623 84.9361 39.6501 85.0093 39.6501C85.0825 39.6501 85.1557 39.6196 85.2045 39.5708C85.2594 39.5159 85.2838 39.4488 85.2838 39.3695C85.2838 39.2963 85.2533 39.2231 85.2045 39.1682C85.1496 39.1133 85.0825 39.0889 85.0093 39.0889L84.9971 39.1011Z"
                            fill="#010E30"
                          />
                          <path
                            d="M93.2383 44.3594C93.2383 44.3594 97.3619 44.0422 98.7771 40.8153L97.2033 39.2598C97.2033 39.2598 96.8678 42.4562 93.2383 44.3594Z"
                            fill="#010E30"
                          />
                          <path
                            d="M144.466 61.8421C143.008 62.6778 141.416 63.3061 139.861 63.9222C137.439 64.886 134.981 65.7522 132.492 66.5208C130.979 66.9905 129.46 67.4236 127.923 67.8079C127.575 67.8933 127.722 68.4362 128.076 68.3508C130.796 67.6676 133.48 66.838 136.128 65.9169C138.305 65.1544 140.471 64.3309 142.575 63.3915C143.319 63.0743 144.045 62.7205 144.747 62.3301C144.814 62.2935 144.857 62.2325 144.875 62.1593C144.893 62.0861 144.881 62.0129 144.844 61.9458C144.808 61.8848 144.747 61.836 144.674 61.8177C144.607 61.7994 144.533 61.8116 144.466 61.8421Z"
                            fill="#010E30"
                          />
                          <path
                            d="M71.4307 69.7474C73.6511 70.7417 75.9935 71.4859 78.3115 72.2057C81.2212 73.1146 84.1675 73.9503 87.1504 74.5725C88.4436 74.8653 89.7612 75.0666 91.0849 75.1642C91.4448 75.1825 91.4448 74.6213 91.0849 74.603C89.9564 74.5237 88.834 74.359 87.7238 74.1211C86.3025 73.8405 84.8934 73.4928 83.4965 73.1268C80.6234 72.3643 77.7808 71.4981 74.9687 70.516C73.8707 70.1439 72.7605 69.7352 71.7113 69.2655C71.3819 69.113 71.0952 69.601 71.4307 69.7474Z"
                            fill="#010E30"
                          />
                          <path
                            d="M58.9868 69.0153C57.6509 69.1129 56.2845 69.2227 55.0523 69.8022C54.0153 70.2902 53.0881 71.1503 52.8258 72.3093C52.5757 73.4134 53.0149 74.5114 54.0824 74.975C55.1499 75.4386 56.498 75.3044 57.6387 75.1763C59.2003 75.0055 60.7375 74.6517 62.2197 74.1149C62.5553 73.9929 62.4088 73.45 62.0673 73.572C60.8899 73.999 59.67 74.3162 58.4317 74.5053C57.8095 74.6029 57.1812 74.6639 56.5468 74.6944C56.0283 74.7371 55.5098 74.7249 54.9974 74.6517C54.5399 74.5907 54.1129 74.3955 53.7713 74.0905C53.6066 73.9197 53.4785 73.7123 53.3992 73.4866C53.3199 73.2609 53.2894 73.0169 53.3138 72.779C53.3809 71.7298 54.1495 70.9185 55.0279 70.4305C56.2296 69.7656 57.6387 69.668 58.9807 69.5704C59.3467 69.5521 59.3467 68.9848 58.9868 69.0153Z"
                            fill="#010E30"
                          />
                          <path
                            d="M43.6453 72.9621C43.4257 73.1207 43.2671 73.3403 43.1817 73.5965C43.0963 73.8527 43.0963 74.1272 43.1817 74.3834C43.3708 74.9568 43.9076 75.2984 44.4749 75.4326C45.823 75.7498 47.2687 75.213 48.5558 74.8531C49.3183 74.6213 50.1113 74.4932 50.9043 74.4688C50.9775 74.4688 51.0507 74.4383 51.1056 74.3895C51.1605 74.3346 51.1849 74.2675 51.1849 74.1882C51.1849 74.115 51.1544 74.0418 51.1056 73.993C51.0507 73.9381 50.9836 73.9076 50.9043 73.9076C49.3305 73.9076 47.897 74.5542 46.372 74.847C45.701 74.9751 44.8958 75.0788 44.2553 74.7738C44.1211 74.7189 43.9991 74.6396 43.9015 74.5298C43.8039 74.42 43.7307 74.298 43.6941 74.1577C43.6575 74.0296 43.6636 73.8954 43.7063 73.7673C43.749 73.6392 43.8222 73.5294 43.9259 73.4501C44.2126 73.2366 43.9259 72.7486 43.6453 72.9621Z"
                            fill="#010E30"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M129.777 73.6084L161.125 146.034L132.54 150.743L117.608 113.594L108.793 148.608L108.622 148.645C107.183 148.943 104.804 148.907 102.065 148.706C99.3197 148.498 96.1843 148.12 93.2319 147.705C90.2734 147.29 87.4918 146.839 85.4483 146.491C84.4296 146.314 83.5939 146.168 83.0083 146.064C82.7155 146.009 82.4898 145.973 82.3373 145.942C82.258 145.93 82.2031 145.918 82.1604 145.912L82.1056 145.9H82.0994C82.0994 145.9 82.0994 145.9 82.1482 145.625L82.0994 145.9L81.8188 145.845L94.8607 80.6966L129.777 73.6084ZM82.4837 145.399C82.6362 145.424 82.8436 145.466 83.1059 145.509C83.6854 145.613 84.5211 145.759 85.5398 145.936C87.5772 146.284 90.3528 146.735 93.3052 147.15C96.2576 147.565 99.3746 147.943 102.107 148.144C104.737 148.34 106.969 148.37 108.336 148.126L117.486 111.782L132.894 150.115L160.326 145.595L129.442 74.2428L95.3426 81.1724L82.4837 145.399Z"
                            fill="#010E30"
                          />
                          <path
                            d="M122.323 124.202C125.678 123.104 129.07 122.104 132.492 121.231C135.865 120.371 139.263 119.645 142.685 119.048C144.661 118.706 146.638 118.407 148.626 118.157C148.98 118.114 148.986 117.547 148.626 117.596C145.113 118.041 141.618 118.621 138.147 119.34C134.718 120.054 131.309 120.908 127.941 121.878C126.002 122.433 124.08 123.025 122.165 123.653C121.829 123.769 121.982 124.312 122.323 124.202Z"
                            fill="#010E30"
                          />
                          <path
                            d="M87.5407 118.962C91.0726 119.115 94.5923 119.603 98.0693 120.237C101.772 120.908 105.438 121.744 109.068 122.744C110.916 123.25 112.758 123.799 114.576 124.415C114.924 124.531 115.064 123.988 114.728 123.873C111.343 122.738 107.896 121.799 104.425 120.987C100.753 120.127 97.0445 119.42 93.3052 118.925C91.3959 118.675 89.4744 118.486 87.5468 118.401C87.1808 118.383 87.1808 118.944 87.5407 118.962Z"
                            fill="#010E30"
                          />
                          <path
                            d="M114.179 104.664C115.32 107.421 116.375 110.209 117.412 113.009L118.041 114.717C118.163 115.052 118.706 114.906 118.584 114.564C117.644 112.033 116.711 109.507 115.723 106.988C115.399 106.158 115.064 105.335 114.722 104.511C114.588 104.182 114.045 104.328 114.179 104.664Z"
                            fill="#010E30"
                          />
                          <path
                            d="M111.197 104.091V104.652C112.142 104.713 113.088 104.774 114.033 104.841C114.173 104.841 114.314 104.853 114.454 104.871C114.527 104.871 114.6 104.841 114.655 104.786C114.71 104.731 114.735 104.664 114.735 104.585C114.735 104.512 114.704 104.438 114.649 104.39C114.594 104.341 114.527 104.31 114.454 104.304C114.082 104.261 113.704 104.255 113.344 104.225L111.593 104.109L111.197 104.091C110.837 104.066 110.837 104.627 111.197 104.652C111.557 104.676 111.557 104.115 111.197 104.091Z"
                            fill="#010E30"
                          />
                          <path
                            d="M78.531 36.7892C78.4456 37.2772 78.4883 37.7774 78.6713 38.241C78.8482 38.7046 79.1532 39.1072 79.5436 39.4122C79.9462 39.705 80.4159 39.8758 80.91 39.9124C81.4041 39.949 81.8982 39.8453 82.3313 39.6135C82.7644 39.3695 83.1121 39.0035 83.3439 38.5643C83.5757 38.1251 83.6733 37.631 83.6245 37.1369C84.1857 37.8567 84.8689 38.6253 85.7778 38.6802C86.0706 38.6924 86.3634 38.6314 86.6257 38.5094C86.8941 38.3874 87.1259 38.2044 87.3089 37.9726C87.6688 37.5029 87.8518 36.9234 87.8274 36.3317C88.0775 36.9478 88.5289 37.4602 89.1023 37.7896C89.6818 38.119 90.3467 38.241 91.0055 38.1434C91.6643 38.0458 92.2682 37.7286 92.7196 37.2467C93.1771 36.7648 93.4577 36.1426 93.5187 35.4838C93.6956 36.2951 94.6045 36.8136 95.4219 36.6977C96.2454 36.5818 96.9225 35.9352 97.2397 35.1666C97.5569 34.4041 97.5508 33.5379 97.4044 32.7327C97.2275 31.775 96.8249 30.8051 96.0502 30.2256C95.9038 30.1341 95.7696 30.0182 95.6537 29.884C95.5622 29.7254 95.4951 29.5546 95.4646 29.3716C95.2023 28.3712 94.5679 27.5111 93.6895 26.9682C92.8538 26.4558 91.8656 26.2728 90.8957 26.1691C90.0173 26.0776 89.0657 26.0593 88.3276 26.5412C88.1812 26.6571 88.0226 26.7547 87.8457 26.8218C87.559 26.9072 87.254 26.7791 86.9734 26.6693C85.9852 26.2667 84.9238 25.9922 83.8563 26.0776C83.1365 26.1508 82.4411 26.3338 81.7823 26.6266C81.3431 26.7974 80.9222 27.0292 80.5379 27.3037C79.751 27.9076 79.2569 28.8226 78.9214 29.7559C78.3724 31.287 78.2077 33.0194 78.8482 34.5139C78.8909 34.5871 78.9153 34.6725 78.9153 34.764C78.8909 34.8616 78.836 34.9531 78.7628 35.0202C78.592 35.2398 78.4761 35.496 78.4212 35.7644C78.3663 36.0389 78.3846 36.3195 78.4639 36.5818L78.531 36.7892Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M78.3054 36.9783C78.0858 38.2349 78.6775 39.6013 79.867 40.1625C80.3184 40.3882 80.8186 40.4919 81.3188 40.4553C81.819 40.4248 82.307 40.254 82.7218 39.9734C83.1366 39.6928 83.4721 39.3024 83.6856 38.851C83.8991 38.3996 83.9906 37.8933 83.9479 37.3931L83.466 37.5944C84.137 38.4484 85.0276 39.3817 86.2232 39.1926C87.4737 39.0035 88.1691 37.7713 88.1569 36.5879L87.6323 36.7282C87.8641 37.2406 88.2179 37.6859 88.6632 38.0214C89.1085 38.363 89.6331 38.5826 90.1882 38.6619C90.7433 38.7351 91.3106 38.668 91.8291 38.4545C92.3476 38.241 92.8051 37.8994 93.1467 37.4541C93.5432 36.96 93.7872 36.3622 93.8482 35.7339L93.2992 35.8071C93.3907 36.1304 93.5554 36.4232 93.7933 36.655C94.0312 36.8929 94.324 37.0637 94.6412 37.1491C94.9828 37.2467 95.3427 37.2528 95.6904 37.1796C96.0381 37.1064 96.3614 36.9478 96.6359 36.7282C97.9474 35.7034 98.0206 33.8429 97.6058 32.3545C97.3923 31.5127 96.9165 30.7624 96.2455 30.2134C96.1784 30.1768 96.1052 30.1646 96.032 30.189C95.9588 30.2073 95.8978 30.2561 95.8612 30.3171C95.8307 30.3781 95.8185 30.4574 95.8368 30.5245C95.8551 30.5916 95.8978 30.6526 95.9588 30.6892C96.9592 31.4639 97.3191 32.9462 97.2703 34.154C97.2276 35.3008 96.4895 36.7221 95.1597 36.6611C94.8608 36.6489 94.5741 36.5452 94.3362 36.3622C94.0983 36.1792 93.9275 35.923 93.8482 35.6363C93.7689 35.3069 93.3297 35.4167 93.2931 35.7095C93.2199 36.2951 92.9576 36.8441 92.5489 37.2711C92.1402 37.6981 91.6034 37.9848 91.0178 38.0885C89.81 38.2776 88.59 37.5273 88.1203 36.411C88.0105 36.1426 87.5957 36.2951 87.5957 36.5513C87.6079 37.4907 87.0589 38.5582 86.0097 38.6131C85.0764 38.668 84.3932 37.814 83.8686 37.1552C83.8259 37.1186 83.7771 37.0881 83.7222 37.082C83.6673 37.0698 83.6124 37.0759 83.5636 37.1003C83.5148 37.1186 83.466 37.1552 83.4355 37.204C83.405 37.2467 83.3867 37.3016 83.3867 37.3565C83.4233 37.6859 83.3867 38.0214 83.2769 38.3325C83.1671 38.6436 82.9963 38.9303 82.7645 39.1743C82.5327 39.4122 82.2582 39.6013 81.9471 39.7233C81.636 39.8453 81.3066 39.8941 80.9772 39.8758C80.6478 39.8514 80.3306 39.7538 80.0439 39.5952C79.7572 39.4366 79.501 39.2231 79.2997 38.9608C79.0984 38.6985 78.952 38.3996 78.8727 38.0824C78.7934 37.7652 78.7812 37.4297 78.8361 37.1064C78.9032 36.777 78.3603 36.6245 78.3054 36.9783Z"
                            fill="#010E30"
                          />
                          <path
                            d="M89.9321 45.4815C90.1273 45.0545 90.2493 44.597 90.292 44.1273C90.292 44.0541 90.2615 43.9809 90.2066 43.926C90.1517 43.8711 90.0846 43.8467 90.0053 43.8467C89.9321 43.8467 89.8589 43.8772 89.8101 43.9321C89.7613 43.987 89.7308 44.0541 89.7247 44.1273L89.7064 44.2798C89.7064 44.3103 89.7064 44.3103 89.7064 44.2798V44.3164L89.6942 44.3896C89.6759 44.4872 89.6576 44.5787 89.6332 44.6824C89.6088 44.7861 89.5783 44.8715 89.5478 44.9691C89.5295 45.0179 89.5112 45.0667 89.4929 45.1155C89.4746 45.1643 89.5173 45.0606 89.4929 45.1277C89.4807 45.1521 89.4685 45.1826 89.4563 45.207C89.4258 45.268 89.4136 45.3473 89.4319 45.4144C89.4502 45.4815 89.4929 45.5425 89.5539 45.5852C89.621 45.6218 89.6942 45.634 89.7674 45.6157C89.8406 45.5974 89.9016 45.5486 89.9382 45.4876H89.9321V45.4815Z"
                            fill="#010E30"
                          />
                          <path
                            d="M117.937 47.0917C118.273 47.8115 118.706 48.4764 119.218 49.0803C119.468 49.3792 119.737 49.6598 120.023 49.9221C120.322 50.221 120.676 50.4528 121.067 50.6053C121.408 50.7212 121.555 50.1783 121.213 50.0624C120.884 49.9221 120.585 49.7086 120.335 49.4463C120.066 49.1962 119.81 48.9278 119.572 48.6411C119.108 48.0799 118.724 47.4638 118.419 46.805C118.383 46.7379 118.322 46.6952 118.248 46.6769C118.175 46.6586 118.102 46.6708 118.035 46.7074C117.974 46.744 117.931 46.805 117.913 46.8782C117.895 46.9453 117.901 47.0185 117.937 47.0856V47.0917Z"
                            fill="#010E30"
                          />
                          <path
                            d="M123.976 55.6866C124.214 56.4735 124.544 57.2238 124.958 57.9314C124.995 57.9924 125.056 58.0351 125.129 58.0534C125.202 58.0717 125.276 58.0595 125.337 58.0229C125.398 57.9863 125.446 57.9253 125.465 57.8582C125.483 57.7911 125.477 57.7118 125.44 57.6508C125.05 56.9859 124.733 56.2783 124.501 55.5402C124.397 55.1925 123.854 55.3389 123.958 55.6927L123.976 55.6866Z"
                            fill="#010E30"
                          />
                          <path
                            d="M69.5095 66.2031C69.5095 66.2031 73.3037 67.5939 76.067 72.9375C78.8303 78.275 70.7295 70.9916 69.8023 68.7163C68.8812 66.4349 69.5095 66.2031 69.5095 66.2031Z"
                            fill="white"
                          />
                          <path
                            d="M77.5062 73.7858C76.0056 71.6081 74.5355 69.3206 72.5286 67.5638C70.4241 65.7216 67.8194 64.6907 65.1293 64.0563C63.4579 63.6293 61.7499 63.3609 60.0297 63.2389C58.3888 63.1718 56.7418 63.2816 55.1253 63.5622C53.1306 63.8977 51.1786 64.4284 49.2876 65.1421C48.2201 65.5386 47.1709 65.99 46.1461 66.4902C45.6032 66.7525 45.0664 67.0331 44.5357 67.3198C44.0599 67.5577 43.6085 67.8444 43.1937 68.1799C42.4556 68.796 41.9554 69.65 41.7785 70.5894C41.6138 71.5776 41.9188 72.578 42.8155 73.0965C43.7122 73.615 44.8041 73.5235 45.7923 73.2856C46.9452 73.0172 48.0798 72.7244 49.2693 72.6268C49.8671 72.578 50.4649 72.5597 51.0627 72.578C51.4226 72.578 51.4226 72.0168 51.0627 72.0168C49.9159 71.9924 48.7752 72.0839 47.6467 72.2913C47.0733 72.395 46.5243 72.5414 45.9509 72.6817C45.4202 72.8403 44.8651 72.9196 44.31 72.9318C43.4194 72.9135 42.5166 72.4682 42.3336 71.5288C42.1506 70.5894 42.6203 69.6012 43.2425 68.9302C43.9501 68.1677 44.9688 67.7224 45.8838 67.2649C46.872 66.7647 47.8785 66.3072 48.9094 65.9046C50.7516 65.1726 52.6609 64.6175 54.6068 64.2393C56.1989 63.9221 57.8215 63.7757 59.4441 63.794C61.0362 63.8245 62.6283 64.099 64.1777 64.4284C66.8434 64.9896 69.5152 65.8558 71.6685 67.576C73.6022 69.1132 75.0296 71.1628 76.4204 73.1758C76.6278 73.4747 76.8352 73.7797 77.0426 74.0847C77.2439 74.3775 77.7319 74.0969 77.5306 73.798H77.5062V73.7858Z"
                            fill="#010E30"
                          />
                          <path
                            d="M95.6357 80.9349C95.6357 80.9349 112.209 79.7149 130.387 75.756L129.448 73.7979L103.871 79.0682L95.6357 80.9349Z"
                            fill="#010E30"
                          />
                          <path
                            d="M128.24 68.271C128.24 68.271 141.02 65.16 145.284 63.7021L144.686 61.9819C144.686 61.9819 141.465 63.757 138.818 64.7757C136.164 65.7822 128.24 68.271 128.24 68.271Z"
                            fill="#010E30"
                          />
                          <path
                            d="M75.3468 71.1929C75.3163 71.2783 81.5993 74.6943 91.2922 76.7561L91.5606 75.0054C91.5606 75.0054 86.7477 74.2917 84.1857 73.578C81.6237 72.8643 75.3468 71.1929 75.3468 71.1929Z"
                            fill="#010E30"
                          />
                          <path
                            d="M122.72 123.775C122.72 123.775 130.918 121.53 149.285 119.389L148.419 117.876C148.419 117.876 140.013 119.218 137.878 119.688C135.749 120.158 122.72 123.775 122.72 123.775Z"
                            fill="#010E30"
                          />
                          <path
                            d="M89.9443 119.023C89.9443 119.023 99.1675 120.304 114.192 125.837L114.448 124.007C114.448 124.007 108.171 122.238 105.097 121.427C101.284 120.42 89.9443 119.023 89.9443 119.023Z"
                            fill="#010E30"
                          />
                          <path
                            d="M111.501 104.481C111.501 104.481 114.539 105.713 116.034 108.556L114.314 104.371L111.501 104.481Z"
                            fill="#010E30"
                          />
                          <path
                            d="M82.3925 145.607C82.3925 145.607 79.6475 150.597 78.4763 150.932C77.3051 151.268 83.6918 151.012 85.6072 159.71L106.573 156.685C106.573 156.685 109.281 149.938 108.47 148.102C107.976 146.979 102.925 146.729 102.925 146.729C102.925 146.729 95.8979 145.735 82.3925 145.607Z"
                            fill="#E9E9E9"
                          />
                          <path
                            d="M68.3748 159.106C71.3455 159.594 74.3467 159.875 77.354 159.96C80.2393 160.046 83.1368 159.96 86.016 159.771C88.6573 159.582 91.2925 159.302 93.9155 158.948C96.1969 158.643 98.4722 158.277 100.747 157.899C102.516 157.6 104.292 157.289 106.073 157.038L106.573 156.971C106.634 156.971 106.695 156.947 106.744 156.91C106.793 156.874 106.829 156.825 106.847 156.764C107.317 155.233 107.72 153.677 108.086 152.122C108.244 151.439 108.397 150.749 108.537 150.06C108.604 149.718 108.671 149.383 108.726 149.035C108.781 148.803 108.824 148.566 108.848 148.328C108.848 148.218 108.818 148.108 108.769 148.01C108.72 147.913 108.647 147.827 108.555 147.76C108.061 147.346 107.342 147.199 106.732 147.047C105.682 146.815 104.615 146.632 103.547 146.51C100.711 146.15 97.85 145.955 94.9952 145.796C92.1831 145.638 89.3771 145.528 86.565 145.442C85.1315 145.4 83.6858 145.32 82.2462 145.339H82.1852C82.1364 145.339 82.0876 145.351 82.0449 145.375C82.0022 145.4 81.9656 145.436 81.9412 145.479C81.1421 147.224 80.1051 148.877 78.696 150.188C77.1832 151.597 75.2983 152.384 73.4134 153.171C72.4435 153.555 71.498 154.007 70.583 154.513C69.7351 155.007 68.9909 155.611 68.6005 156.538C68.2284 157.423 68.1674 158.411 68.1308 159.363C68.1125 159.863 68.1613 160.369 68.4907 160.772C68.7652 161.077 69.1251 161.302 69.5216 161.406C70.0157 161.546 70.5159 161.656 71.0222 161.723C71.5834 161.821 72.1446 161.9 72.7058 161.967C73.8465 162.101 74.9872 162.181 76.134 162.217C78.4703 162.291 80.8005 162.187 83.1307 162.028C85.4609 161.87 87.7667 161.699 90.0847 161.485C92.4393 161.266 94.7878 160.955 97.1302 160.625C98.2892 160.461 99.4543 160.284 100.613 160.101C101.705 159.924 102.803 159.692 103.901 159.564C104.621 159.478 105.499 159.424 106 158.814C106.158 158.6 106.28 158.362 106.353 158.106C106.469 157.801 106.573 157.49 106.677 157.167C106.75 156.947 106.829 156.733 106.896 156.508C107.006 156.16 106.463 156.014 106.353 156.361C106.195 156.88 106.012 157.392 105.823 157.899C105.768 158.136 105.652 158.35 105.481 158.527C105.219 158.734 104.902 158.862 104.566 158.899C104.194 158.966 103.816 158.99 103.444 159.051C102.907 159.137 102.37 159.241 101.827 159.326C100.705 159.515 99.5702 159.692 98.4356 159.863C96.1603 160.204 93.8728 160.528 91.5853 160.772C89.3283 161.01 87.0652 161.174 84.8021 161.333C80.343 161.662 75.8107 161.912 71.376 161.199C70.8758 161.119 70.3634 161.04 69.8754 160.912C69.5094 160.814 69.1068 160.674 68.8689 160.351C68.5822 159.96 68.6676 159.405 68.692 158.948C68.7103 158.478 68.7652 158.014 68.8506 157.551C68.936 157.099 69.0946 156.666 69.3325 156.27C69.5948 155.873 69.9425 155.532 70.3451 155.276C71.1991 154.733 72.1019 154.269 73.0413 153.891C74.8652 153.104 76.7501 152.415 78.33 151.176C79.7818 150.054 80.9225 148.553 81.8009 146.937C82.0144 146.54 82.2157 146.132 82.4048 145.723L82.1608 145.863C83.3259 145.882 84.491 145.912 85.6561 145.943C88.3157 146.016 90.9692 146.119 93.6288 146.248C96.5141 146.394 99.4055 146.577 102.285 146.888C103.425 147.01 104.548 147.15 105.676 147.364C106.109 147.449 106.542 147.535 106.976 147.651C107.146 147.699 107.311 147.748 107.482 147.803C107.555 147.827 107.628 147.858 107.701 147.882L107.75 147.901C107.689 147.876 107.805 147.925 107.75 147.901L107.86 147.949C107.964 147.998 108.061 148.053 108.159 148.12C108.214 148.157 108.11 148.071 108.171 148.12L108.22 148.163C108.232 148.175 108.244 148.187 108.257 148.2C108.202 148.163 108.311 148.254 108.257 148.2C108.269 148.2 108.281 148.236 108.281 148.242C108.287 148.254 108.263 148.163 108.281 148.23C108.299 148.297 108.281 148.212 108.281 148.212V148.267C108.269 148.334 108.257 148.407 108.244 148.48C108.214 148.651 108.183 148.822 108.153 148.993C108.086 149.365 108.013 149.737 107.933 150.097C107.506 152.158 106.994 154.19 106.396 156.203L106.292 156.544L106.561 156.337C104.859 156.557 103.169 156.855 101.486 157.136C99.2896 157.508 97.0936 157.862 94.8854 158.179C92.3051 158.551 89.7126 158.85 87.114 159.058C84.2714 159.283 81.4227 159.399 78.5679 159.356C75.5789 159.326 72.5899 159.1 69.6253 158.673C69.2532 158.618 68.875 158.557 68.5029 158.496C68.1491 158.441 67.9966 158.978 68.3504 159.039L68.3748 159.106Z"
                            fill="#010E30"
                          />
                          <path
                            d="M87.846 149.188C86.8273 148.419 85.6866 147.827 84.4727 147.437C83.271 147.053 81.9168 146.815 80.7029 147.26C80.3674 147.388 80.5138 147.931 80.8554 147.803C82.0083 147.376 83.271 147.632 84.4056 148.004C85.5463 148.383 86.6138 148.944 87.5715 149.67C87.8521 149.895 88.1266 149.407 87.846 149.188Z"
                            fill="white"
                          />
                          <path
                            d="M86.3455 151.195C85.3512 150.469 84.2532 149.908 83.082 149.523C82.5025 149.334 81.9108 149.194 81.313 149.096C80.6786 148.968 80.0198 148.974 79.3915 149.108C79.3244 149.133 79.2634 149.176 79.2268 149.243C79.1902 149.31 79.1841 149.383 79.2024 149.45C79.2207 149.517 79.2695 149.578 79.3305 149.615C79.3915 149.651 79.4708 149.664 79.5379 149.645C80.1296 149.523 80.7335 149.523 81.3191 149.657C83.0332 149.95 84.6558 150.64 86.0588 151.677C86.3577 151.896 86.6383 151.408 86.3455 151.195Z"
                            fill="white"
                          />
                          <path
                            d="M134.932 157.161L135.438 159.033L137.25 159.54C137.25 159.54 147.961 161.162 150.792 161.455C153.622 161.748 162.845 162.449 165.615 162.303C168.378 162.163 172.288 162.516 174.149 161.351C176.009 160.186 174.368 155.867 173.898 155.776C173.429 155.684 164.846 151.048 164.45 150.804C164.053 150.56 134.932 157.161 134.932 157.161Z"
                            fill="white"
                          />
                          <path
                            d="M134.792 154.342L135.115 155.745C135.115 155.745 137.896 157.404 143.258 157.77C148.62 158.136 152.439 158.826 152.439 158.826C152.439 158.826 164.804 160.162 169.031 159.363C173.258 158.563 172.239 159.491 174.137 158.502C176.034 157.514 174.594 156.148 174.594 156.148L134.792 154.342Z"
                            fill="white"
                          />
                          <path
                            d="M160.192 145.144C160.192 145.144 163.187 150.451 164.438 150.804C165.688 151.158 158.911 150.896 156.861 160.125L134.596 156.917L133.474 154.483L132.608 150.652C132.608 150.652 125.355 146.797 160.192 145.144Z"
                            fill="#E9E9E9"
                          />
                          <path
                            d="M155.983 159.613L161.79 160.125C161.79 160.125 169.22 160.259 170.794 160.015C172.368 159.771 175.131 158.82 175.131 158.82L174.6 156.306L171.904 154.47L165.56 151.616L164.328 150.542L157.874 153.415L156.001 159.478L155.983 159.613Z"
                            fill="#E9E9E9"
                          />
                          <path
                            d="M174.722 158.795C172.789 159.625 170.501 159.832 168.397 159.942C165.493 160.058 162.589 159.997 159.698 159.753C156.526 159.527 153.36 159.18 150.206 158.771C147.278 158.399 144.357 157.966 141.441 157.52C139.275 157.191 137.116 156.837 134.944 156.538L134.328 156.453L134.572 156.593C134.511 156.489 134.456 156.386 134.414 156.276L134.377 156.184C134.353 156.13 134.395 156.227 134.377 156.184L134.353 156.123C134.316 156.026 134.273 155.934 134.243 155.837C134.139 155.574 134.054 155.306 133.962 155.038C133.669 154.141 133.413 153.232 133.175 152.317C132.998 151.634 132.828 150.945 132.669 150.255C132.626 150.066 132.584 149.883 132.541 149.694C132.523 149.615 132.504 149.535 132.486 149.456C132.468 149.377 132.486 149.517 132.486 149.487C132.486 149.456 132.486 149.444 132.486 149.426C132.462 149.468 132.474 149.359 132.486 149.426C132.492 149.407 132.498 149.389 132.504 149.365C132.462 149.426 132.523 149.322 132.504 149.365L132.541 149.304C132.577 149.243 132.498 149.346 132.553 149.291C132.608 149.237 132.632 149.212 132.675 149.176C132.718 149.139 132.767 149.102 132.699 149.157L132.791 149.09C132.919 149.005 133.059 148.925 133.2 148.858L133.316 148.803L133.425 148.755L133.675 148.657C134.7 148.297 135.756 148.023 136.829 147.834C138.257 147.547 139.702 147.327 141.136 147.138C142.771 146.912 144.411 146.729 146.058 146.559C147.699 146.388 149.365 146.235 151.018 146.101C152.494 145.973 153.976 145.863 155.452 145.76C156.55 145.68 157.648 145.607 158.753 145.54C159.283 145.509 159.832 145.516 160.363 145.448H160.436L160.192 145.308C160.997 147.132 162.138 148.791 163.553 150.206C164.285 150.92 165.103 151.542 165.987 152.055C166.908 152.567 167.866 153.025 168.842 153.415C169.848 153.836 170.861 154.245 171.837 154.745C172.734 155.208 173.71 155.727 174.228 156.63C174.722 157.49 174.789 158.527 174.85 159.497C174.881 159.979 174.942 160.546 174.6 160.936C174.308 161.266 173.85 161.4 173.435 161.498C171.154 162.034 168.75 162.193 166.414 162.248C164.023 162.297 161.626 162.187 159.241 162.028C156.849 161.87 154.422 161.687 152.012 161.467C149.609 161.247 147.169 160.918 144.753 160.576C143.564 160.406 142.38 160.229 141.191 160.04C140.026 159.851 138.86 159.619 137.689 159.46C137.037 159.375 136.079 159.393 135.64 158.814C135.505 158.6 135.39 158.374 135.292 158.136C135.146 157.825 134.999 157.514 134.853 157.197C134.755 157.002 134.67 156.794 134.59 156.587C134.481 156.245 133.938 156.398 134.048 156.74C134.261 157.313 134.511 157.874 134.798 158.411C134.895 158.655 135.017 158.887 135.164 159.112C135.408 159.43 135.749 159.655 136.134 159.765C136.524 159.875 136.927 159.942 137.335 159.973C137.854 160.034 138.366 160.137 138.885 160.223C140.117 160.43 141.355 160.631 142.594 160.814C145.082 161.186 147.577 161.552 150.084 161.827C152.555 162.101 155.038 162.284 157.514 162.467C162.419 162.84 167.378 163.102 172.252 162.303C173.161 162.156 174.399 162.059 175.04 161.29C175.375 160.881 175.448 160.369 175.43 159.857C175.418 159.332 175.375 158.814 175.302 158.295C175.168 157.282 174.85 156.3 174.106 155.574C173.332 154.824 172.288 154.324 171.312 153.873C169.318 152.951 167.177 152.268 165.365 150.993C163.681 149.81 162.358 148.169 161.357 146.382C161.107 145.943 160.881 145.491 160.674 145.028C160.65 144.985 160.613 144.948 160.57 144.924C160.528 144.899 160.479 144.887 160.43 144.887C159.369 144.942 158.313 145.009 157.246 145.076C154.763 145.241 152.287 145.424 149.81 145.638C146.894 145.894 143.984 146.187 141.087 146.577C138.799 146.882 136.469 147.205 134.249 147.87C133.614 148.059 132.937 148.273 132.394 148.669C132.193 148.803 132.035 148.999 131.949 149.23C131.919 149.346 131.913 149.462 131.937 149.584C132.041 150.17 132.205 150.755 132.346 151.329C132.699 152.89 133.145 154.422 133.675 155.928C133.773 156.203 133.889 156.471 134.017 156.74C134.054 156.831 134.121 156.91 134.2 156.965C134.285 157.02 134.383 157.051 134.481 157.045C137.03 157.38 139.727 157.831 142.313 158.222C145.955 158.783 149.603 159.289 153.263 159.71C156.99 160.131 160.735 160.473 164.487 160.546C166.134 160.576 167.781 160.558 169.421 160.436C170.788 160.351 172.148 160.137 173.478 159.808C174.003 159.674 174.521 159.497 175.021 159.277C175.332 159.137 175.046 158.649 174.722 158.795Z"
                            fill="#010E30"
                          />
                          <path
                            d="M154.787 149.456C155.806 148.682 156.947 148.084 158.161 147.681C159.369 147.285 160.711 147.01 161.937 147.468C162.278 147.596 162.425 147.053 162.089 146.925C160.796 146.443 159.362 146.705 158.088 147.114C156.8 147.529 155.593 148.157 154.513 148.968C154.226 149.182 154.513 149.67 154.794 149.45H154.787V149.456Z"
                            fill="#010E30"
                          />
                          <path
                            d="M156.367 151.591C157.349 150.865 158.441 150.298 159.594 149.907C160.161 149.712 160.747 149.566 161.339 149.456C161.985 149.34 162.65 149.267 163.303 149.431C163.37 149.444 163.449 149.438 163.51 149.395C163.571 149.358 163.62 149.297 163.638 149.23C163.657 149.163 163.65 149.084 163.614 149.023C163.577 148.962 163.522 148.913 163.455 148.889C162.79 148.742 162.095 148.736 161.43 148.87C160.783 148.974 160.143 149.126 159.521 149.334C158.289 149.743 157.13 150.334 156.086 151.097C155.794 151.31 156.086 151.798 156.367 151.591Z"
                            fill="#010E30"
                          />
                          <path
                            d="M20.9776 44.8169C21.2521 44.6705 21.5571 44.518 21.8682 44.579C22.1122 44.6522 22.3318 44.7986 22.5026 44.9938C27.1264 49.4285 31.4391 53.9974 36.0568 58.4382C42.4008 48.2939 45.9571 42.6026 55.0827 28.2676C55.2657 27.987 55.5463 27.7857 55.8757 27.7125C56.199 27.6393 56.5467 27.7003 56.8273 27.8772C59.5113 29.5669 62.0489 31.4823 64.4096 33.5929C64.6658 33.8247 64.8305 34.1419 64.8732 34.4896C64.9159 34.8373 64.8244 35.185 64.6292 35.4656C55.5646 48.361 46.256 61.0612 36.6851 73.5784C36.6241 73.6577 36.5509 73.7248 36.4594 73.7736C36.374 73.8224 36.2764 73.8529 36.1727 73.859C36.0751 73.8651 35.9714 73.859 35.8799 73.8224C35.7823 73.7919 35.6969 73.737 35.6237 73.6699C26.9983 65.8558 15.4815 54.8026 12.6267 51.8929C12.5413 51.8014 12.4742 51.6977 12.4315 51.5818C12.3888 51.4659 12.3705 51.3378 12.3766 51.2158C12.3827 51.0938 12.4193 50.9718 12.4803 50.862C12.5413 50.7522 12.6206 50.6546 12.7182 50.5814C14.4384 49.2638 18.6657 46.0674 20.9776 44.8169Z"
                            fill="#D3D4D6"
                          />
                          <path
                            d="M21.1178 45.0667C21.4167 44.9081 21.7156 44.7556 22.0328 44.963C22.289 45.1643 22.5269 45.3839 22.7465 45.6218C23.2223 46.0854 23.6981 46.5429 24.1678 47.0065C25.1194 47.9459 26.071 48.8853 27.0104 49.8308C28.8831 51.7035 30.7375 53.6006 32.6285 55.4672C33.7021 56.5347 34.7818 57.59 35.8676 58.6392C35.8981 58.6697 35.9347 58.688 35.9774 58.7063C36.0201 58.7185 36.0628 58.7246 36.1055 58.7185C36.1482 58.7124 36.1909 58.7002 36.2214 58.6758C36.258 58.6514 36.2885 58.6209 36.3068 58.5843C38.2832 55.4245 40.2596 52.2647 42.2421 49.1049C44.2429 45.9207 46.2437 42.7426 48.2506 39.5645C49.4767 37.6247 50.7028 35.691 51.9289 33.7573C52.6304 32.6532 53.3258 31.5552 54.0273 30.4572L55.1497 28.676C55.2717 28.4259 55.4608 28.2185 55.6926 28.0721C55.9061 27.9623 56.1562 27.9318 56.388 27.9928C56.6625 28.0965 56.9248 28.2429 57.1566 28.4259C57.4555 28.615 57.7483 28.8102 58.0411 29.0054C58.6023 29.3775 59.1513 29.7618 59.6942 30.1583C60.8044 30.9635 61.878 31.8053 62.9272 32.6837C63.1834 32.9033 63.4396 33.1168 63.6958 33.3364C63.952 33.5255 64.1899 33.7512 64.3912 34.0013C64.7023 34.4588 64.6108 34.9773 64.3119 35.4043C63.4945 36.5816 62.6649 37.7406 61.8414 38.9057C58.4986 43.621 55.1253 48.318 51.7093 52.9906C48.2994 57.6632 44.8529 62.3053 41.3759 66.923C40.5158 68.0637 39.6557 69.2044 38.7895 70.3451L37.4597 72.0897L36.807 72.9376C36.6423 73.1511 36.4593 73.5293 36.1604 73.5659C35.9164 73.5964 35.7578 73.4073 35.5992 73.2609L34.9709 72.6997L33.7509 71.5895C32.903 70.8148 32.0612 70.034 31.2194 69.2593C27.8461 66.1361 24.5033 62.9946 21.1849 59.8287C18.7205 57.4741 16.2561 55.1195 13.8344 52.71C13.4989 52.3745 13.1451 52.0512 12.8279 51.6974C12.7486 51.6181 12.6937 51.5205 12.6693 51.4168C12.6449 51.307 12.6449 51.1972 12.6754 51.0935C12.7547 50.9105 12.8889 50.758 13.0658 50.6604C13.3647 50.4286 13.6697 50.1968 13.9747 49.9711C15.5973 48.745 17.2321 47.5372 18.9279 46.4148C19.6416 45.939 20.3614 45.4754 21.1117 45.0667C21.4289 44.8959 21.1483 44.4079 20.825 44.5787C19.056 45.5425 17.4029 46.7564 15.7742 47.9398C14.9873 48.5132 14.2065 49.0988 13.4257 49.6844C13.139 49.904 12.8523 50.1175 12.5656 50.3432C12.3643 50.4957 12.2118 50.7031 12.1386 50.9471C12.0654 51.1911 12.0715 51.4473 12.1569 51.6852C12.2911 51.9658 12.4802 52.2098 12.7181 52.4111L13.261 52.954C13.7246 53.4176 14.1882 53.8751 14.6579 54.3326C15.9084 55.5526 17.165 56.7726 18.4277 57.9804C21.7339 61.1585 25.0645 64.3061 28.4134 67.4354C30.1458 69.058 31.8904 70.6684 33.635 72.2666C34.0559 72.6509 34.4768 73.0352 34.9038 73.4195C35.2881 73.7733 35.6541 74.2186 36.2336 74.1393C36.8497 74.0539 37.1852 73.3646 37.5268 72.9193L38.8871 71.132C42.48 66.4045 46.0302 61.6526 49.556 56.8702C53.0757 52.0939 56.5588 47.281 60.0053 42.4437C60.8776 41.2237 61.7438 40.0037 62.6039 38.7837C63.037 38.1737 63.4701 37.5637 63.8971 36.9476C64.0862 36.667 64.2875 36.3864 64.4888 36.1119C64.7084 35.8435 64.8975 35.5446 65.0378 35.2213C65.1232 34.9773 65.1537 34.7211 65.1293 34.471C65.1049 34.2148 65.0195 33.9708 64.8853 33.7512C64.7206 33.5133 64.5193 33.2998 64.2936 33.1229C64.0313 32.8911 63.7629 32.6593 63.4945 32.4336C62.427 31.5247 61.329 30.6585 60.2005 29.835C59.6332 29.4202 59.0537 29.0115 58.4742 28.6211C58.2119 28.432 57.9435 28.2673 57.6751 28.0904C57.3884 27.8769 57.0773 27.6939 56.7601 27.5292C56.5283 27.4255 56.2782 27.3828 56.022 27.4011C55.7719 27.4194 55.5279 27.4987 55.3083 27.6329C54.7898 27.9623 54.5092 28.615 54.1859 29.1152C52.7585 31.36 51.3311 33.6048 49.9098 35.8435C47.7016 39.3327 45.4934 42.8219 43.2913 46.3172C41.321 49.4526 39.3507 52.5941 37.3865 55.7356L35.7944 58.2793L36.2336 58.2244C32.2076 54.357 28.3463 50.3249 24.3569 46.4209C23.7957 45.8719 23.2345 45.3229 22.6733 44.7861C22.4537 44.5299 22.1548 44.3591 21.8254 44.2859C21.4533 44.2371 21.1239 44.3957 20.8128 44.5665C20.5139 44.7434 20.8006 45.2314 21.1178 45.0667Z"
                            fill="#010E30"
                          />
                          <path
                            d="M14.9814 162.162C14.9814 161.821 16.6223 100.467 16.7565 84.4241C16.7809 81.7462 19.2148 79.599 22.1916 79.6478L49.0438 80.0626C51.923 80.1053 54.241 82.2037 54.2898 84.8023L54.9425 162.162H14.9814Z"
                            fill="white"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M22.1856 79.9282C19.343 79.8855 17.0616 81.929 17.0372 84.43C16.9701 92.4515 16.5248 111.807 16.0978 129.192C15.8843 137.884 15.6769 146.089 15.5183 152.14C15.4573 154.543 15.4024 156.611 15.3597 158.234L15.3292 159.393C15.3048 160.265 15.2865 160.948 15.2743 161.418C15.2682 161.607 15.2682 161.766 15.2621 161.882H54.6559L54.0032 84.8082C53.9605 82.3865 51.7889 80.3918 49.0378 80.343L22.1856 79.9282ZM22.1917 79.367C19.0929 79.3182 16.5004 81.563 16.476 84.4239C16.4089 92.4393 15.9636 111.789 15.5366 129.174C15.2377 141.264 14.951 152.408 14.7985 158.136C14.7314 160.643 14.6948 162.113 14.6948 162.162V162.443H55.2232L54.5644 84.796C54.5156 82.0205 52.0451 79.8306 49.0439 79.7818L22.1917 79.367Z"
                            fill="#010E30"
                          />
                          <path
                            d="M54.9606 162.162C54.9606 161.833 54.4482 104.206 54.4482 104.206L82.2886 104.609C84.6188 104.645 86.4976 106.347 86.5342 108.452L87.4797 162.162H54.9606Z"
                            fill="white"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M54.168 103.919L82.3012 104.328C84.7595 104.365 86.7847 106.164 86.8274 108.446L87.779 162.443H54.6804V162.162C54.6804 161.998 54.5523 147.51 54.4242 133.065C54.3632 125.843 54.2961 118.627 54.2473 113.216L54.168 104.206C54.168 104.206 54.168 104.206 54.4486 104.206H54.168V103.919ZM54.7353 104.487L54.8146 113.21C54.8634 118.62 54.9244 125.831 54.9915 133.059C55.1074 146.406 55.2294 159.789 55.2416 161.882H87.2056L86.2601 108.452C86.2235 106.524 84.4972 104.92 82.289 104.883L54.7353 104.487Z"
                            fill="#010E30"
                          />
                          <path
                            d="M87.7298 162.162C87.7298 161.845 86.888 124.379 86.949 126.41L110.269 126.648C112.288 126.673 113.923 127.722 113.954 129.015L114.771 162.156H87.7298V162.162Z"
                            fill="white"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M87.2299 126.697C87.236 126.862 87.236 127.081 87.2421 127.35C87.2604 128.179 87.2848 129.479 87.3214 131.095C87.3946 134.328 87.4922 138.83 87.5898 143.405C87.6325 145.357 87.6752 147.327 87.7179 149.212C87.8521 155.337 87.968 160.625 87.9985 161.882H114.479L113.667 129.027C113.655 128.503 113.32 127.99 112.697 127.594C112.081 127.197 111.221 126.941 110.257 126.929L87.2299 126.697ZM86.9493 126.154V126.13L110.27 126.368C111.325 126.38 112.289 126.661 113.009 127.118C113.722 127.576 114.216 128.234 114.235 129.009L115.064 162.437H87.4495V162.156V162.15V162.126C87.4495 162.102 87.4495 162.071 87.4495 162.034C87.4495 161.955 87.4434 161.839 87.4434 161.693C87.4373 161.4 87.4312 160.985 87.419 160.461C87.3946 159.411 87.3641 157.929 87.3214 156.166C87.2787 154.153 87.2238 151.774 87.1689 149.255C87.1262 147.358 87.0835 145.381 87.0408 143.417C86.9371 138.842 86.8395 134.34 86.7724 131.107C86.7358 129.491 86.7114 128.192 86.6931 127.362C86.687 126.947 86.6809 126.648 86.6748 126.484C86.6748 126.404 86.6748 126.349 86.6748 126.331C86.6748 126.331 86.6748 126.325 86.6748 126.319C86.6748 126.313 86.6748 126.295 86.6809 126.276C86.7297 126.191 86.8395 126.154 86.9493 126.154Z"
                            fill="#010E30"
                          />
                          <path
                            d="M72.9437 84.2472H74.9079C74.9811 84.2472 75.0543 84.2167 75.1092 84.1679C75.1641 84.113 75.1946 84.0459 75.1946 83.9666C75.1946 83.8873 75.1641 83.8202 75.1092 83.7653C75.0543 83.7104 74.9872 83.686 74.9079 83.686H72.9437C72.8705 83.686 72.7973 83.7165 72.7424 83.7653C72.6875 83.8202 72.6631 83.8873 72.6631 83.9666C72.6631 84.0459 72.6936 84.113 72.7424 84.1679C72.7973 84.2167 72.8705 84.2472 72.9437 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M67.8377 84.2472H70.5888C70.662 84.2472 70.7352 84.2167 70.7901 84.1679C70.845 84.113 70.8694 84.0459 70.8694 83.9666C70.8694 83.8873 70.8389 83.8202 70.7901 83.7653C70.7352 83.7104 70.6681 83.686 70.5888 83.686H67.8377C67.7645 83.686 67.6913 83.7165 67.6364 83.7653C67.5815 83.8202 67.5571 83.8873 67.5571 83.9666C67.5571 84.0459 67.5876 84.113 67.6364 84.1679C67.6913 84.2167 67.7584 84.2472 67.8377 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M62.7259 84.2472H65.477C65.5502 84.2472 65.6234 84.2167 65.6783 84.1679C65.7332 84.113 65.7576 84.0459 65.7576 83.9666C65.7576 83.8873 65.7271 83.8202 65.6783 83.7653C65.6234 83.7104 65.5563 83.686 65.477 83.686H62.7259C62.6527 83.686 62.5795 83.7165 62.5246 83.7653C62.4697 83.8202 62.4453 83.8873 62.4453 83.9666C62.4453 84.0459 62.4758 84.113 62.5246 84.1679C62.5795 84.2167 62.6527 84.2472 62.7259 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M56.8333 84.2472H60.2371C60.3103 84.2472 60.3835 84.2167 60.4384 84.1679C60.4933 84.113 60.5238 84.0459 60.5238 83.9666C60.5238 83.8873 60.4933 83.8202 60.4384 83.7653C60.3835 83.7104 60.3164 83.686 60.2371 83.686H56.8333C56.7601 83.686 56.6869 83.7165 56.632 83.7653C56.5771 83.8202 56.5527 83.8873 56.5527 83.9666C56.5527 84.0459 56.5832 84.113 56.632 84.1679C56.6869 84.2167 56.7601 84.2472 56.8333 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M50.9408 84.2472H54.4788C54.552 84.2472 54.6252 84.2167 54.6801 84.1679C54.735 84.113 54.7594 84.0459 54.7594 83.9666C54.7594 83.8873 54.7289 83.8202 54.6801 83.7653C54.6252 83.7104 54.5581 83.686 54.4788 83.686H50.9408C50.8676 83.686 50.7944 83.7165 50.7395 83.7653C50.6846 83.8202 50.6602 83.8873 50.6602 83.9666C50.6602 84.0459 50.6907 84.113 50.7395 84.1679C50.7944 84.2167 50.8676 84.2472 50.9408 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M45.4388 84.2472H48.4522C48.5254 84.2472 48.5986 84.2167 48.6535 84.1679C48.7084 84.113 48.7328 84.0459 48.7328 83.9666C48.7328 83.8873 48.7023 83.8202 48.6535 83.7653C48.5986 83.7104 48.5315 83.686 48.4522 83.686H45.4388C45.3656 83.686 45.2924 83.7165 45.2375 83.7653C45.1826 83.8202 45.1582 83.8873 45.1582 83.9666C45.1582 84.0459 45.1887 84.113 45.2375 84.1679C45.2924 84.2167 45.3656 84.2472 45.4388 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M40.5892 84.2472H43.078C43.1512 84.2472 43.2244 84.2167 43.2793 84.1679C43.3342 84.113 43.3586 84.0459 43.3586 83.9666C43.3586 83.8873 43.3281 83.8202 43.2793 83.7653C43.2244 83.7104 43.1573 83.686 43.078 83.686H40.5892C40.516 83.686 40.4428 83.7165 40.3879 83.7653C40.333 83.8202 40.3086 83.8873 40.3086 83.9666C40.3086 84.0459 40.3391 84.113 40.3879 84.1679C40.4489 84.2167 40.516 84.2472 40.5892 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M34.9588 84.2472H38.2345C38.3077 84.2472 38.3809 84.2167 38.4358 84.1679C38.4907 84.113 38.5151 84.0459 38.5151 83.9666C38.5151 83.8873 38.4846 83.8202 38.4358 83.7653C38.3809 83.7104 38.3138 83.686 38.2345 83.686H34.9588C34.8856 83.686 34.8124 83.7165 34.7575 83.7653C34.7026 83.8202 34.6782 83.8873 34.6782 83.9666C34.6782 84.0459 34.7087 84.113 34.7575 84.1679C34.8124 84.2167 34.8856 84.2472 34.9588 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M30.5057 84.2472H32.6041C32.6773 84.2472 32.7505 84.2167 32.8054 84.1679C32.8603 84.113 32.8847 84.0459 32.8847 83.9666C32.8847 83.8873 32.8542 83.8202 32.8054 83.7653C32.7505 83.7104 32.6834 83.686 32.6041 83.686H30.5057C30.4325 83.686 30.3593 83.7165 30.3044 83.7653C30.2495 83.8202 30.2251 83.8873 30.2251 83.9666C30.2251 84.0459 30.2556 84.113 30.3044 84.1679C30.3593 84.2167 30.4325 84.2472 30.5057 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M24.4793 84.2472H28.1454C28.2186 84.2472 28.2918 84.2167 28.3467 84.1679C28.4016 84.113 28.426 84.0459 28.426 83.9666C28.426 83.8873 28.3955 83.8202 28.3467 83.7653C28.2918 83.7104 28.2247 83.686 28.1454 83.686H24.4793C24.4061 83.686 24.3329 83.7165 24.278 83.7653C24.2231 83.8202 24.1987 83.8873 24.1987 83.9666C24.1987 84.0459 24.2292 84.113 24.278 84.1679C24.3329 84.2167 24.4061 84.2472 24.4793 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M19.5013 84.2472H22.1243C22.1975 84.2472 22.2707 84.2167 22.3256 84.1679C22.3805 84.113 22.4049 84.0459 22.4049 83.9666C22.4049 83.8873 22.3744 83.8202 22.3256 83.7653C22.2707 83.7104 22.2036 83.686 22.1243 83.686H19.5013C19.4281 83.686 19.3549 83.7165 19.3 83.7653C19.2451 83.8202 19.2207 83.8873 19.2207 83.9666C19.2207 84.0459 19.2512 84.113 19.3 84.1679C19.3549 84.2167 19.4281 84.2472 19.5013 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M13.8714 84.2472H17.0129C17.0861 84.2472 17.1593 84.2167 17.2142 84.1679C17.2691 84.113 17.2996 84.0459 17.2996 83.9666C17.2996 83.8873 17.2691 83.8202 17.2142 83.7653C17.1593 83.7104 17.0922 83.686 17.0129 83.686H13.8714C13.7982 83.686 13.725 83.7165 13.6701 83.7653C13.6152 83.8202 13.5908 83.8873 13.5908 83.9666C13.5908 84.0459 13.6213 84.113 13.6701 84.1679C13.725 84.2167 13.7982 84.2472 13.8714 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            d="M8.89339 84.2472H11.5164C11.5896 84.2472 11.6628 84.2167 11.7177 84.1679C11.7726 84.113 11.797 84.0459 11.797 83.9666C11.797 83.8873 11.7665 83.8202 11.7177 83.7653C11.6628 83.7104 11.5957 83.686 11.5164 83.686H8.89339C8.82019 83.686 8.74699 83.7165 8.69209 83.7653C8.63719 83.8202 8.61279 83.8873 8.61279 83.9666C8.61279 84.0459 8.64329 84.113 8.69209 84.1679C8.74699 84.2167 8.82019 84.2472 8.89339 84.2472Z"
                            fill="#0147FF"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M27.2426 105.628C27.3646 105.536 27.5415 105.561 27.633 105.689L49.6235 135.255C49.8065 135.499 50.1725 135.512 50.3677 135.268L60.939 122.012C61.366 121.476 62.1956 121.5 62.586 122.061L81.6424 149.273C81.8071 149.511 82.1426 149.542 82.35 149.34L94.0864 138.031C94.5073 137.628 95.1783 137.653 95.5687 138.086L109.288 153.336C109.391 153.452 109.385 153.629 109.269 153.732C109.153 153.836 108.976 153.83 108.873 153.714L95.1539 138.464C94.977 138.269 94.672 138.257 94.4829 138.44L82.7465 149.749C82.289 150.188 81.5509 150.115 81.191 149.597L62.1285 122.384C61.9516 122.128 61.5734 122.116 61.3782 122.36L50.8069 135.615C50.386 136.146 49.5808 136.128 49.1721 135.591L27.1877 106.018C27.0962 105.896 27.1206 105.719 27.2426 105.628Z"
                            fill="#010E30"
                          />
                          <path
                            d="M27.0958 108.214C26.4431 106.719 26.0893 105.109 26.0527 103.48L25.6989 103.749C26.4126 103.974 26.9738 104.481 27.535 104.956C28.1694 105.493 28.7916 106.036 29.4077 106.585C29.6822 106.823 30.0787 106.426 29.8042 106.189C29.1393 105.597 28.4683 105.017 27.7912 104.444C27.1995 103.944 26.6017 103.45 25.8514 103.212C25.8087 103.2 25.766 103.2 25.7233 103.206C25.6806 103.212 25.644 103.23 25.6074 103.261C25.5708 103.285 25.5464 103.322 25.5281 103.358C25.5098 103.395 25.4976 103.437 25.4976 103.48C25.5403 105.213 25.9246 106.914 26.62 108.5C26.7603 108.836 27.2422 108.549 27.0958 108.214Z"
                            fill="#010E30"
                          />
                          <path
                            d="M56.6933 70.6074C55.7539 70.6989 54.9487 71.2357 54.2472 71.8274C54.0886 71.9494 53.9605 72.1019 53.869 72.2788C53.7775 72.4557 53.7226 72.6448 53.7104 72.8461C53.6921 73.206 53.808 73.5659 54.0398 73.8404C54.6498 74.5785 55.7234 74.2918 56.5408 74.1576C56.9678 74.0905 57.468 74.06 57.8096 73.7611C58.1512 73.4622 58.2183 72.9742 58.1329 72.5411C58.0719 72.2849 57.9926 72.0287 57.8889 71.7847C57.7974 71.5285 57.7181 71.2601 57.6022 71.0161C57.3704 70.5281 56.8397 70.5403 56.3883 70.6623C56.3212 70.6867 56.2663 70.7355 56.2358 70.7965C56.2053 70.8575 56.1992 70.9307 56.2175 70.9978C56.2358 71.0649 56.2785 71.1259 56.3395 71.1625C56.4005 71.1991 56.4737 71.2113 56.5408 71.1991C56.6689 71.1564 56.797 71.132 56.9312 71.1381C57.0776 71.1564 57.1081 71.2601 57.1508 71.3943C57.285 71.7603 57.4375 72.1202 57.5412 72.4984C57.6205 72.7729 57.6693 73.1572 57.407 73.3585C57.1447 73.5598 56.7482 73.5476 56.4554 73.6025C56.0894 73.6757 55.7234 73.7245 55.3574 73.755C55.2049 73.7733 55.0524 73.7672 54.906 73.7245C54.7596 73.6818 54.6254 73.6147 54.5034 73.5171C54.418 73.4317 54.3509 73.328 54.3082 73.2121C54.2655 73.0962 54.2472 72.9742 54.2594 72.8522C54.2716 72.7302 54.3082 72.6143 54.3692 72.5045C54.4302 72.3947 54.5095 72.3032 54.6132 72.2361C55.1927 71.742 55.9125 71.2357 56.6872 71.1625C56.7604 71.1625 56.8336 71.132 56.8824 71.0771C56.9373 71.0222 56.9678 70.9551 56.9678 70.8819C56.9678 70.8087 56.9373 70.7355 56.8885 70.6806C56.8397 70.6379 56.7665 70.6074 56.6933 70.6074Z"
                            fill="#010E30"
                          />
                        </svg>
                        <p className="text-gray-500">No strategies available</p>
                      </div>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
          <CongratulationsPopup
            isOpen={isCongratsPopupOpen}
            onClose={() => setIsCongratsPopupOpen(false)}
            message="deactivated"
          />
        </main>
      </div >
    </div >
  );

}