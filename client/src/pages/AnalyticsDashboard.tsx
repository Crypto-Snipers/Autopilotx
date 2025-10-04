import { useEffect, useState } from "react"
import { TrendingUp, Users, Wallet, BarChart3, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Line, LineChart, ResponsiveContainer } from "recharts"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import Lowheader from "@/components/Lowheader"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useLocation } from "wouter"
import CryptoMarketOverview from "@/components/CryptoMarketOverview"

// Spinner for loading states
const spinner = (
    <span className="flex items-center justify-center h-6">
        <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </span>
);


interface AdminUser {
    is_admin: boolean
    name: string
}

interface User {
    name: string
    email: string
}

// Fetch all users and return count and user list
const fetchAllUsers = async (): Promise<User[]> => {
    try {
        const res = await apiRequest<{ success: boolean, count: number; users: User[] }>(
            "GET",
            "/api/all-users"
        );

        if (!res.users || !Array.isArray(res.users)) {
            throw new Error("Invalid response format");
        }

        return res.users;
    } catch (error) {
        console.error("Error fetching all users:", error);
        throw new Error("Failed to fetch all users");
    }
};


// Fetch all the active users
const fetchActiveUsers = async (): Promise<number> => {
    try {
        const res = await apiRequest<{ success: boolean; count: number; users: [] }>(
            "GET",
            "/api/active-users"
        );

        if (!res.success) throw new Error("Failed to fetch active users");

        return res.count;
    } catch (error) {
        console.error("Error fetching active users:", error);
        throw new Error("Failed to fetch active users");
    }
};

// Fetch total funds deployed
const fetchTotalFundsDeployed = async (): Promise<number> => {
    try {
        const res = await apiRequest<{ success: boolean; total_used_margin: number }>(
            "GET",
            "/api/total-funds-deployed"
        );

        if (!res.success) throw new Error("Failed to fetch total funds deployed");

        return res.total_used_margin;
    } catch (error) {
        console.error("Error fetching total funds deployed:", error);
        throw new Error("Failed to fetch total funds deployed");
    }
};

// Fetch total value of funds(futures wallets) 
const fetchtotalFunds = async (): Promise<number> => {
    try {
        const res = await apiRequest<{ success: boolean; total_futures_wallets_usd: number }>(
            "GET",
            "/api/total-funds"
        );

        if (!res.success) throw new Error("Failed to fetch total funds deployed");

        const total = res.total_futures_wallets_usd;
        return total;
    } catch (error) {
        console.error("Error fetching total funds:", error);
        throw new Error("Failed to fetch total funds deployed");
    };
}

// Fetch total volumes generated
const fetchTotalVolumesGenerated = async (): Promise<number> => {
    try {
        const res = await apiRequest<{ success: boolean; total_volumes: number }>(
            "GET",
            "/api/total-volumes-generated"
        );

        if (!res.success) throw new Error("Failed to fetch total volumes generated");
        const total = res.total_volumes;
        return total;
    } catch (error) {
        console.error("Error fetching total volumes generated:", error);
        throw new Error("Failed to fetch total volumes generated");
    }
}

// Fetch all strategies
const fetchAllStrategies = async (): Promise<number> => {
    try {
        const res = await apiRequest<{ success: boolean; total_strategies: number }>(
            "GET",
            "/api/total-strategies"
        );

        if (!res.success) throw new Error("Failed to fetch total volumes generated");
        const total = res.total_strategies;
        return total;
    } catch (error) {
        console.error("Error fetching total volumes generated:", error);
        throw new Error("Failed to fetch total volumes generated");
    }
}

// Fetch active strategies
const fetchActiveStrategies = async (): Promise<number> => {
    try {
        const res = await apiRequest<{ success: boolean; total_active_strategies: number }>(
            "GET",
            "/api/active-strategies"
        );

        if (!res.success) throw new Error("Failed to fetch active strategies");
        const total = res.total_active_strategies;
        return total;
    } catch (error) {
        console.error("Error fetching active strategies:", error);
        throw new Error("Failed to fetch active strategies");
    }
}


export default function AnalyticsDashboard() {
    const [currentUser, setCurrentUser] = useState<AdminUser | null>(null)
    const [isAuthLoading, setIsAuthLoading] = useState(true)
    const [_, navigate] = useLocation()
    const { toast } = useToast()
    // Per-metric state
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [totalUsersLoading, setTotalUsersLoading] = useState(true);
    const [totalUsersError, setTotalUsersError] = useState<string | null>(null);

    const [totalActiveUsers, setTotalActiveUsers] = useState<number | null>(null);
    const [totalActiveUsersLoading, setTotalActiveUsersLoading] = useState(true);
    const [totalActiveUsersError, setTotalActiveUsersError] = useState<string | null>(null);

    const [totalFunds, setTotalFunds] = useState<number | null>(null);
    const [totalFundsLoading, setTotalFundsLoading] = useState(true);
    const [totalFundsError, setTotalFundsError] = useState<string | null>(null);

    const [totalVolumes, setTotalVolumes] = useState<number | null>(null);
    const [totalVolumesLoading, setTotalVolumesLoading] = useState(true);
    const [totalVolumesError, setTotalVolumesError] = useState<string | null>(null);

    const [totalFundsDeployed, setTotalFundsDeployed] = useState<number | null>(null);
    const [totalFundsDeployedLoading, setTotalFundsDeployedLoading] = useState(true);
    const [totalFundsDeployedError, setTotalFundsDeployedError] = useState<string | null>(null);

    const [totalStrategies, setTotalStrategies] = useState<number | null>(null);
    const [totalStrategiesLoading, setTotalStrategiesLoading] = useState(true);
    const [totalStrategiesError, setTotalStrategiesError] = useState<string | null>(null);

    const [totalActiveStrategies, setTotalActiveStrategies] = useState<number | null>(null);
    const [totalActiveStrategiesLoading, setTotalActiveStrategiesLoading] = useState(true);
    const [totalActiveStrategiesError, setTotalActiveStrategiesError] = useState<string | null>(null);


    // Check admin access if a user tried to access this page directly
    useEffect(() => {
        const checkAdminAccess = async () => {
            try {
                const email = sessionStorage.getItem('signupEmail') || '';
                const res = await apiRequest<{ success: boolean; email: string; role: string; }>(
                    "GET",
                    `/api/get-role?email=${encodeURIComponent(email)}`
                );

                if (res?.role !== "superadmin" && res?.role !== "admin") {
                    toast({
                        title: "Access Denied",
                        description: "You don't have permission to access the admin dashboard.",
                        variant: "destructive",
                    });
                    navigate("/home");
                    return;
                }

                setCurrentUser({
                    is_admin: res.role === "admin" || res.role === "superadmin",
                    name: res.email, // or use res.name if available
                });
            } catch (err) {
                console.error("Auth check failed:", err);
                setCurrentUser({ is_admin: true, name: "Admin" }); // fallback, remove if not intended
            } finally {
                setIsAuthLoading(false);
            }
        };

        checkAdminAccess();
    }, [navigate, toast]);

    // Generate sample sparkline data for each metric
    const generateSparklineData = (trend: "up" | "down" | "mixed") => {
        const baseData = []
        for (let i = 0; i < 7; i++) {
            let value
            if (trend === "up") {
                value = 50 + Math.random() * 30 + i * 5
            } else if (trend === "down") {
                value = 80 - Math.random() * 20 - i * 3
            } else {
                value = 50 + Math.random() * 40 + Math.sin(i) * 15
            }
            baseData.push({ value })
        }
        return baseData
    }


    // Fetch all users
    useEffect(() => {
        fetchAllUsers()
            .then(users => {
                setTotalUsers(users.length);
                setTotalUsersLoading(false);
            })
            .catch(err => {
                setTotalUsersError(`Failed to fetch users: ${err}`);
                setTotalUsersLoading(false);
            });
    }, []);

    // Fetch active users
    useEffect(() => {
        fetchActiveUsers()
            .then(count => {
                setTotalActiveUsers(count);
                setTotalActiveUsersLoading(false);
            })
            .catch(err => {
                setTotalActiveUsersError(`Failed to fetch active users: ${err}`);
                setTotalActiveUsersLoading(false);
            });
    }, []);

    // Fetch total funds deployed
    useEffect(() => {
        fetchTotalFundsDeployed()
            .then(total => {
                setTotalFundsDeployed(total);
                setTotalFundsDeployedLoading(false);
            })
            .catch(err => {
                setTotalFundsDeployedError(`Failed to fetch total funds deployed: ${err}`);
                setTotalFundsDeployedLoading(false);
            });
    }, []);

    // Fetch total value of funds
    useEffect(() => {
        fetchtotalFunds()
            .then(total => {
                setTotalFunds(total);
                setTotalFundsLoading(false);
            })
            .catch(err => {
                setTotalFundsError(`Failed to fetch total funds: ${err}`);
                setTotalFundsLoading(false);
            });
    }, []);

    // Fetch total volumes generated
    useEffect(() => {
        fetchTotalVolumesGenerated()
            .then(total => {
                setTotalVolumes(total);
                console.log("Total Volumes:", total);
                setTotalVolumesLoading(false);
            })
            .catch(err => {
                setTotalVolumesError(`Failed to fetch total volumes generated: ${err}`);
                setTotalVolumesLoading(false);
            });
    }, []);

    // Fetch all strategies
    useEffect(() => {
        fetchAllStrategies()
            .then(total => {
                setTotalStrategies(total);
                setTotalStrategiesLoading(false);
            })
            .catch(err => {
                setTotalStrategiesError(`Failed to fetch total strategies: ${err}`);
                setTotalStrategiesLoading(false);
            });
    }, []);

    // Fetch active strategies
    useEffect(() => {
        fetchActiveStrategies()
            .then(total => {
                setTotalActiveStrategies(total);
                setTotalActiveStrategiesLoading(false);
            })
            .catch(err => {
                setTotalActiveStrategiesError(`Failed to fetch active strategies: ${err}`);
                setTotalActiveStrategiesLoading(false);
            });
    }, []);

    const metrics = [
        {
            title: "Total Users",
            value: totalUsersLoading
                ? spinner
                : totalUsersError
                    ? totalUsersError
                    : typeof totalUsers === "number"
                        ? totalUsers.toString()
                        : "0",
            change: "+2.8%",
            changeType: "positive" as const,
            icon: Users,
            description: "All registered users",
            sparklineData: generateSparklineData("up"),
            sparklineColor: "#10b981",
        },
        {
            title: "Total Active Users",
            value: totalActiveUsersLoading
                ? spinner
                : totalActiveUsersError
                    ? totalActiveUsersError
                    : typeof totalActiveUsers === "number"
                        ? totalActiveUsers.toString()
                        : "0",
            change: "+4.5%",
            changeType: "positive" as const,
            icon: Activity,
            description: "Users with broker connected",
            sparklineData: generateSparklineData("up"),
            sparklineColor: "#3b82f6",
        },
        {
            title: "Total Funds",
            value: totalFundsLoading
                ? spinner
                : totalFundsError
                    ? totalFundsError
                    : typeof totalFunds === "number"
                        ? `$${totalFunds.toLocaleString()}`
                        : "$0",
            change: "+3.8%",
            changeType: "positive" as const,
            icon: Wallet,
            description: "Present market value",
            sparklineData: generateSparklineData("mixed"),
            sparklineColor: "#f59e0b",
        },
        {
            title: "Total Funds Deployed",
            value: totalFundsDeployedLoading
                ? spinner
                : totalFundsDeployedError
                    ? totalFundsDeployedError
                    : typeof totalFundsDeployed === "number"
                        ? `$${totalFundsDeployed.toLocaleString()}`
                        : "0",
            change: "+5.7%",
            changeType: "positive" as const,
            icon: TrendingUp,
            description: "Capital allocated to strategies",
            sparklineData: generateSparklineData("up"),
            sparklineColor: "#8b5cf6",
        },
        {
            title: "Total Volumes Generated",
            value: totalVolumesLoading
                ? spinner
                : totalVolumesError
                    ? totalVolumesError
                    : typeof totalVolumes === "number"
                        ? `$${totalVolumes.toLocaleString()}`
                        : "0",
            change: "+2.4%",
            changeType: "positive" as const,
            icon: BarChart3,
            description: "Cumulative trading volume",
            sparklineData: generateSparklineData("up"),
            sparklineColor: "#ef4444",
        },
    ];

    const performanceMetrics = [
        {
            label: "Avg. Win Rate",
            value: "67.8%",
            trend: "up",
        },
        {
            label: "Avg. Return",
            value: "300%",
            trend: "up",
        },
        {
            label: "Total Strategies",
            value: totalStrategies !== null ? totalStrategies.toString() : spinner,
            trend: "up",
        },
        {
            label: "Active Strategies",
            value: totalActiveStrategies !== null ? totalActiveStrategies.toString() : spinner,
            trend: "up",
        },
    ]

    return (
        <div className="flex min-h-screen bg-neutral-50">
            <Sidebar />
            <div className="flex-1 md:ml-[14rem]">
                <Header />
                <Lowheader />
                {/* Main Content */}
                <main className="container mx-auto p-6 space-y-6">
                    <div>
                        {/* Welcome Section */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Analytics Dashboard</h2>
                            <p className="text-gray-600">Monitor your platform's key performance metrics and trading strategies.</p>
                        </div>

                        {/* Main Metrics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
                            {metrics.map((metric, index) => {
                                const Icon = metric.icon
                                return (
                                    <Card key={index} className="relative overflow-hidden">
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium text-gray-600">{metric.title}</CardTitle>
                                            <Icon className="w-4 h-4 text-gray-400" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</div>
                                            <div className="flex items-center space-x-2 mb-3">
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-xs ${metric.changeType === "positive" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                                        }`}
                                                >
                                                    {metric.change}
                                                </Badge>
                                                <span className="text-xs text-gray-500">vs last month</span>
                                            </div>

                                            {/* Sparkline Chart */}
                                            <div className="h-12 mb-2">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={metric.sparklineData}>
                                                        <Line
                                                            type="monotone"
                                                            dataKey="value"
                                                            stroke={metric.sparklineColor}
                                                            strokeWidth={2}
                                                            dot={false}
                                                            activeDot={false}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>

                                            <p className="text-xs text-gray-500">{metric.description}</p>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>

                        {/* Performance Overview */}
                        <div className="py-8 w-full h-full mx-auto m-2 p-2 flex flex-wrap">
                            <CryptoMarketOverview />
                        </div>
                        {/* <Card className="mb-8">
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold">Performance Overview</CardTitle>
                                <CardDescription>Key trading performance indicators</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {performanceMetrics.map((metric, index) => (
                                    <div key={index} className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">{metric.label}</span>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-sm font-medium text-gray-900">{metric.value}</span>
                                            {metric.trend === "up" ? (
                                                <ArrowUpRight className="w-3 h-3 text-green-500" />
                                            ) : (
                                                <ArrowDownRight className="w-3 h-3 text-red-500" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card> */}
                    </div>
                </main>
            </div>
        </div>
    )
}

