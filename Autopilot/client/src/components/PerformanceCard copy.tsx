import React, { useState, useEffect } from 'react';
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import CongratulationsPopup from '@/components/congratulationsPopup';
import { apiRequest } from '@/lib/queryClient';
import { Settings } from 'lucide-react';
import EditStrategyModal from './EditStrategyModal';
import { type StrategyConfig } from './EditStrategyModal'

interface PerformanceGraphProps {
    showMarker?: boolean;
}

const PerformanceGraph: React.FC<PerformanceGraphProps> = ({ showMarker = false }) => {

    return (
        <div className="bg-white p-4 rounded-lg relative">
            <svg
                viewBox="0 0 300 200"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
            >
                {/* Y-axis labels */}
                <text x="10" y="30" fontSize="12" fill="#666">60.00k</text>
                <text x="10" y="90" fontSize="12" fill="#666">40.00k</text>
                <text x="10" y="150" fontSize="12" fill="#666">20.00k</text>
                <text x="30" y="190" fontSize="12" fill="#666">0</text>

                {/* Y-axis line */}
                <line x1="50" y1="20" x2="50" y2="190" stroke="#e5e7eb" strokeWidth="1" />

                {/* X-axis labels */}
                <text x="70" y="190" fontSize="12" fill="#666">2022</text>
                <text x="170" y="190" fontSize="12" fill="#666">2023</text>
                <text x="260" y="190" fontSize="12" fill="#666">2024</text>

                {/* Gradient definition */}
                <defs>
                    <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
                    </linearGradient>
                </defs>

                {/* Area chart path */}
                <path
                    d="M 50,180 
             L 80,160 
             L 120,140 
             L 170,40 
             L 200,130 
             L 240,80 
             L 280,110 
             L 280,190 
             L 50,190 Z"
                    fill="url(#blueGradient)"
                />

                {/* Line chart path */}
                <path
                    d="M 50,180 
             L 80,160 
             L 120,140 
             L 170,40 
             L 200,130 
             L 240,80 
             L 280,110"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                />

                {/* Marker line (if showMarker is true) */}
                {showMarker && (
                    <g>
                        <line x1="210" y1="20" x2="210" y2="190" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" />
                        <rect x="195" y="10" width="30" height="16" rx="3" fill="#3b82f6" />
                        <text x="210" y="22" fontSize="10" fill="white" textAnchor="middle">1 Mar</text>
                    </g>
                )}
            </svg>

            {/* Alternative implementation using absolute positioning (optional) */}
            {/*
      {showMarker && (
        <div className="absolute h-full w-px border-l border-dashed border-blue-500" style={{ left: '70%', top: '10%', bottom: '10%' }}>
          <div className="bg-blue-500 text-white text-xs rounded px-2 py-0.5 absolute -top-6 -translate-x-1/2" style={{ left: '50%' }}>
            1 Mar
          </div>
        </div>
      )}
      */}
        </div>
    );
};

export interface PerformanceData {
    _id: string;
    name: string;
    type: string;
    description: string;
    leverage: string;
    margin: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    isDeployed: boolean;
    BTC: boolean;
    ETH: boolean;
    SOL: boolean;
    TotalTrades: number;
    Returns: number;
    WinRate: number;
    MaxDrawdown: number;
}

interface PerformanceCardProps {
    data: PerformanceData;
    showMarker?: boolean;
    onDeploy?: () => void;
}

const PerformanceCard: React.FC<PerformanceCardProps> = ({ data, showMarker = false, onDeploy }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [role, setRole] = useState<string>("user");
    const [isCongratsPopupOpen, setIsCongratsPopupOpen] = useState(false);
    const [multiplier, setMultiplier] = useState(1);
    const [open, setOpen] = React.useState(false)
    const [StrategyData, setStrategyData] = React.useState<StrategyConfig | null>(null)

    // Fetch and handle strategy information
    const handleOpenEdit = async () => {
        try {
            const symbol = data.BTC ? "BTC" : data.ETH ? "ETH" : null
            if (!symbol) return

            const response = await apiRequest<{
                status: string
                configs: StrategyConfig[]
            }>("GET", `/api/fetch_strategy_info?symbol=${encodeURIComponent(symbol)}`)

            if (response?.status === "success" && response.configs.length > 0) {
                setStrategyData(response.configs[0]) // store in state
                setOpen(true) // now open the modal
            }
        } catch (err) {
            console.error("Error fetching strategy:", err)
        }
    }


    // Check User role
    useEffect(() => {
        const checkAdminStatus = async () => {
            if (user?.email) {
                try {
                    const response = await apiRequest<{ success: boolean; email: string; role: string; }>(
                        "GET",
                        `/api/get-role?email=${encodeURIComponent(user.email)}`
                    );

                    console.log("User role response:", response);
                    // Set role state based on response.role
                    if (response?.role === "superadmin" || response?.role === "admin") {
                        setRole(response.role);
                    } else {
                        setRole("user");
                    }
                } catch (error) {
                    console.error("Error checking user role:", error);
                    setRole("user");
                }
            }
        };
        checkAdminStatus();
    }, [user]);


    // Function to check if the user is approved
    const checkUserApproval = async (): Promise<{ approved: boolean; message: string }> => {
        try {
            if (!user?.email) {
                return { approved: false, message: 'User not authenticated' };
            }

            // const baseUrl = import.meta.env.VITE_API_URL || '';
            // const apiUrl = baseUrl && baseUrl.startsWith('http')
            //     ? new URL('/api/user/approved', baseUrl)
            //     : new URL('/api/user/approved', window.location.origin);

            // apiUrl.searchParams.append('email', encodeURIComponent(user.email));
            // apiUrl.searchParams.append('email', user.email);

            const data = await apiRequest<{
                approved: boolean; user?: { status?: string }; message?: string
            }>(
                "GET",
                `/api/user/approved?email=${encodeURIComponent(user.email)}`
            );

            console.log('Approval API Response:', data);

            const isApproved = Boolean(
                data.approved || (data.user && data.user.status === 'approved')
            );
            console.log('Approval status from API:', data.approved);
            console.log('data.user: ', data.user);
            console.log('data.user.status: ', data.user?.status)

            return {
                approved: isApproved,
                message: data.message || 'Your account is yet to be approved.'
            };
        } catch (error) {
            console.error('Error checking user approval:', error);
            return {
                approved: false,
                message: error instanceof Error ? error.message : 'Failed to verify account approval status. Please try again.'
            };
        }
    };


    // Function to handle strategy deployment
    const handleDeployStrategy = async () => {
        try {
            if (!user?.email) {
                toast({
                    title: "Authentication Required",
                    description: "Please log in to deploy strategies.",
                    variant: "destructive"
                });
                return;
            }

            // Check if user is approved before deploying
            const { approved, message } = await checkUserApproval();
            if (!approved) {
                toast({
                    title: "Account Not Approved",
                    description: message,
                    variant: "destructive"
                });
                return;
            }

            // const baseUrl = import.meta.env.VITE_API_URL || '';
            // const apiUrl = baseUrl && baseUrl.startsWith('http')
            //     ? new URL('/api/add-strategy', baseUrl)
            //     : new URL('/api/add-strategy', window.location.origin);


            // Build query string safely
            const params = new URLSearchParams({
                email: user.email,
                strategy_name: data.name,
                multiplier: String(multiplier)
            });
            // const params = new URLSearchParams();
            // params.append('email', user.email);
            // params.append('strategy_name', data.name);
            // params.append('multiplier', String(multiplier));

            // Api call
            const response = await apiRequest<{ status: string; message: string }>(
                "POST",
                `/api/add-strategy?${params.toString()}`
            );

            if (response.status === 'fail') {
                throw new Error(response.message || "Failed to deploy strategy.");
            }

            setIsCongratsPopupOpen(true);

            if (onDeploy) {
                onDeploy();
            }

        } catch (error: any) {
            console.error('Error deploying strategy:', error);

            let errorMsg = "Failed to deploy strategy. Please try again.";

            // Check for insufficient balance/margin conditions (case-insensitive)
            const errorMessage = error?.message?.toLowerCase() || "";

            if (errorMessage.includes("insufficient free margin") ||
                errorMessage.includes("insufficient balance") ||
                errorMessage.includes("available: 0") ||
                errorMessage.includes("free margin 0")) {
                errorMsg = "Insufficient balance available";
            } else if (error?.message?.includes("usd") || error?.message?.includes("USD")) {
                // Show the actual error message if it contains currency info
                errorMsg = error.message;
            }

            toast({
                title: "Deployment Failed",
                description: errorMsg,
                variant: "destructive"
            });
        }
    };


    return (
        <>
            <div className="bg-white rounded-lg shadow-sm p-6 w-full">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-lg font-medium text-gray-800">{data.name}</h3>
                        <p className="text-sm text-gray-500">{data.type}</p>
                    </div>
                    <div className="flex space-x-2">
                        {data.ETH && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">ETH</span>}
                        {data.BTC && <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">BTC</span>}
                        {data.SOL && <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">SOL</span>}
                    </div>
                </div>
                {/* <p className="text-sm text-gray-600 mb-4">{data.description}</p> */}
                <div className="flex space-x-4 mb-4">
                    <div className="text-sm">
                        <span className="text-[#06C10F] font-medium">Leverage: {data.leverage}</span>
                    </div>
                    <div className="text-sm">
                        <span className="text-red-500 font-medium">Margin: ${data.margin} <span className='text-black ml-1 mr-1'>|</span> ₹50,000</span>
                    </div>
                </div>

                <div className="mb-4">
                    <PerformanceGraph showMarker={showMarker} />
                </div>

                <div className="grid grid-cols-2 gap-y-2 mb-4">
                    <div className="text-sm text-gray-600">Total Trades:</div>
                    <div className="text-sm font-medium text-right">{data.TotalTrades.toLocaleString()}</div>

                    <div className="text-sm text-gray-600">Total Returns:</div>
                    <div className="text-sm font-medium text-right text-green-600">{data.Returns}%</div>

                    <div className="text-sm text-gray-600">Win Rate:</div>
                    <div className="text-sm font-medium text-right">{data.WinRate}%</div>


                    <div className="text-sm text-gray-600">Max Drawdown:</div>
                    <div className="text-sm font-medium text-right text-red-500">{data.MaxDrawdown}%</div>
                </div>

                <div className="flex items-center gap-2 w-full">
                    <div className="flex items-center gap-2 w-1/2">
                        <button
                            className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-background h-10 w-full border border-blue-600 text-blue-600 font-medium py-2 rounded-full transition-colors duration-200 hover:bg-blue-600 hover:text-white active:bg-blue-700"
                            onClick={handleDeployStrategy}
                            disabled={isCongratsPopupOpen}
                        >
                            Deploy Strategy
                        </button>
                    </div>

                    <div className="flex items-center justify-center w-1/2 border border-blue-600 rounded-full px-4 h-10">
                        <div className="text-sm font-semibold text-blue-600">Multiplier</div>
                        <input
                            type="number"
                            min={1}
                            max={50}
                            step={1}
                            className="w-16 text-center font-semibold text-sm text-blue-600 focus:outline-none ml-2"
                            value={multiplier}
                            onChange={e => setMultiplier(Number(e.target.value))}
                            disabled={isCongratsPopupOpen}
                        />
                    </div>

                    {/* Configure button */}
                    <div>
                        {(role === 'admin' || role === 'superadmin') && (
                            <button
                                onClick={handleOpenEdit}
                                className="cursor-pointer"
                            >
                                <Settings className='text-blue-600' />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {StrategyData && (
                <EditStrategyModal
                    open={open}
                    onOpenChange={setOpen}
                    initial={StrategyData}
                    onSave={(updated) => {
                        setStrategyData(updated) // Update state after saving
                    }}
                />
            )}
            <CongratulationsPopup isOpen={isCongratsPopupOpen} onClose={() => setIsCongratsPopupOpen(false)} message='deployed' />
        </>
    );
};

export default PerformanceCard;