import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

import { Card, CardContent } from "@/components/ui/card";
import Lowheader from "@/components/Lowheader";
import TradingGreetingCard from "@/components/TradingGreetingCard";
import { apiRequest } from "@/lib/queryClient";
import DeployedStrategies from "@/components/DeployedStrategies";
import CryptoSniperWelcome from "@/components/CryptoSniperWelcome";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch"
import { ChevronDown, RefreshCcw, TrendingUp } from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import CryptoMarketOverview from "@/components/CryptoMarketOverview";

export default function Home() {

  const queryClient = useQueryClient();

  // Set up automatic refetching for all queries
  useQuery({
    queryKey: ['refetch-all'],
    queryFn: () => Promise.resolve(),
    refetchInterval: 1000, // Refetch every second
    refetchOnWindowFocus: true,
  });


  const { user, updateUserPhone } = useAuth();
  const { toast } = useToast();
  const [userName, setUserName] = useState<string | undefined>(undefined);
  const [brokerName, setBrokerName] = useState<string | undefined>(undefined);
  const [brokerIsActive, setBrokerIsActive] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState<string | undefined>(undefined)
  const [phone, setPhone] = useState<string | undefined>(undefined)
  const [password, setPassword] = useState<string | undefined>(undefined)
  const [balance, setBalance] = useState(0)
  const [balances, setBalances] = useState({ usd: 0, inr: 0 });
  const [currencies, setCurrencies] = useState(['usd']);
  const [showNotifications, setShowNotifications] = useState(false);
  const [brokerID, setbrokerID] = useState("")
  const [mounted, setMounted] = useState(false)
  const [runAllEnabled, setRunAllEnabled] = useState(false)
  const [isLoadingDeactivate, setIsLoadingDeactivate] = useState(false)
  const [isManuallyRefreshing, setIsManuallyRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    // If user is available from auth context, store their email in session storage
    if (user?.email) {
      sessionStorage.setItem("signupEmail", user.email);
      setEmail(user.email);
    }

    // Helper to safely get sessionStorage item
    const safeGet = (key: string) => {
      const v = sessionStorage.getItem(key);
      return v !== null && v !== "undefined" ? v : undefined;
    };

    const emailFromStorage = safeGet("signupEmail");
    const phoneFromStorage = safeGet("signupPhone");
    const userNameFromStorage = safeGet("signupName");
    const brokerNameFromStorage = safeGet("broker_name");
    const brokerIsActiveFromStorage = safeGet("api_verified");
    const balanceFromStorage = safeGet("balance");
    // const pnlFromStorage = safeGet("pnl");
    const notification = safeGet("showNotifications");
    const userDataStr = safeGet("user_dict");
    const brokerIdFromStorage = safeGet("broker_id");
    const userData = userDataStr ? JSON.parse(userDataStr) : null;

    setShowNotifications(notification === 'true');

    // Set state from session storage or user object
    if (userNameFromStorage) {
      setUserName(userNameFromStorage);
    } else if (user?.user_metadata?.name) {
      setUserName(user.user_metadata.name);
      sessionStorage.setItem("signupName", user.user_metadata.name);
    }

    if (emailFromStorage && !email) {
      setEmail(emailFromStorage);
    }

    if (phoneFromStorage) {
      setPhone(phoneFromStorage);
    } else if (user?.user_metadata?.phone) {
      setPhone(user.user_metadata.phone);
      sessionStorage.setItem("signupPhone", user.user_metadata.phone);
    }

    if (brokerNameFromStorage) {
      setBrokerName(brokerNameFromStorage);
    }

    if (brokerIdFromStorage) {
      setbrokerID(brokerIdFromStorage);
    }

    if (brokerIsActiveFromStorage) {
      setBrokerIsActive(brokerIsActiveFromStorage);
    }

    if (balanceFromStorage && !isNaN(Number(balanceFromStorage))) {
      setBalance(Number(balanceFromStorage));
    } else {
      setBalance(0);
    }
  }, [setShowNotifications]);


  useEffect(() => {
    const completeProfileIfNeeded = async () => {
      if (userName && email && phone) {
        const user_dict = {
          "name": user?.identities?.[0]?.identity_data?.full_name || userName,
          "email": email,
          "phone": phone,
          "status": "pending",
          "broker_name": ""
        };

        try {
          const completeResponse = await apiRequest<{ message?: string }>(
            "POST",
            "/api/auth/complete-profile",
            user_dict
          );

          if (completeResponse.message === "Registration completed successfully") {
            const userEmail = user?.email || email;
            if (userEmail) {
              localStorage.setItem(`profile_completed_${userEmail}`, 'true');
            }
          }

        } catch (error) {
          console.error("Profile completion error:", error);
          console.log(user_dict);
        }
      }
    };

    completeProfileIfNeeded();
  }, [userName, email, phone, user, toast]);

  useEffect(() => {
    // This function handles the profile completion process
    const handleProfileCompletion = async () => {
      // Check if user exists
      if (!user) {
        console.log("No user found in auth context");
        return;
      }

      // Check if we've already completed the profile for this user
      const userEmail = user.email || user.user_metadata?.email;
      if (!userEmail) {
        console.log("No email found for user");
        return;
      }

      const profileCompletedKey = `profile_completed_${userEmail}`;
      const isProfileCompleted = localStorage.getItem(profileCompletedKey) === 'true';

      if (isProfileCompleted) {
        // Profile already completed, just set the user data without API call
        let fullName;

        // Handle both Supabase and custom auth user objects
        if (user.user_metadata?.custom_auth) {
          // Custom auth user
          fullName = user.user_metadata?.name || user.user_metadata?.user?.name;
          setUserName(fullName);
          setEmail(userEmail);
        } else if (user.identities && user.identities.length > 0) {
          // Supabase auth user
          fullName = user.identities[0].identity_data?.full_name;
          if (typeof fullName === 'string') {
            setUserName(fullName);
          }
          setEmail(userEmail);
        }

        return;
      }

      // Set user data based on auth type
      let fullName;

      if (user.user_metadata?.custom_auth) {
        // Custom auth user
        fullName = user.user_metadata?.name || user.user_metadata?.user?.name;
        setUserName(fullName);
        setEmail(userEmail);
      } else if (user.identities && user.identities.length > 0) {
        // Supabase auth user
        fullName = user.identities[0].identity_data?.full_name;
        if (typeof fullName === 'string') {
          setUserName(fullName);
        }
        setEmail(userEmail);
      }

      // Only proceed if we have the necessary user information

      if (userEmail && (fullName || userName)) {
        const user_dict = {
          "name": fullName || userName || "",
          "email": userEmail || "",
          "phone": phone || "",
          "password": password || "",
          "status": "pending",
          "broker_name": ""
        };

        try {
          const completeResponse = await apiRequest<{ message?: string }>(
            "POST",
            "/api/auth/complete-profile",
            user_dict
          );

          if (completeResponse?.message === "Registration completed successfully") {
            localStorage.setItem(profileCompletedKey, 'true');
          }


        } catch (error) {
          console.error("Profile completion error:", error);
        }
      }
    };


    // Execute the profile completion handler
    handleProfileCompletion();
  }, [user, userName, email, phone, password]);


  // fetch user broker is connected or not
  type BrokerData = {
    broker_name: string;
    api_verified: boolean;
    broker_id: number;
    balances?: {
      USDT?: number;
      USD?: number;
      INR?: number;
    };
  } | null;


  const { data: brokerData, isLoading: isLoadingBroker, error: brokerError } = useQuery<BrokerData>({
    queryKey: ['/get-broker', email],
    staleTime: 30000,
    enabled: !!email, // Only run the query when email is available
    queryFn: async () => {
      if (!email) throw new Error('Email is required for this API call');
      try {
        return await apiRequest("GET", `/api/broker?email=${encodeURIComponent(email)}`);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          return null; // Broker not connected
        }
        throw err;
      }
    },
    retry: 1,
    refetchInterval: 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (brokerData) {
      setBrokerName(brokerData.broker_name);
      setBrokerIsActive(String(brokerData.api_verified));
      sessionStorage.setItem("broker_name", brokerData.broker_name);
      sessionStorage.setItem("api_verified", String(brokerData.api_verified));
      sessionStorage.setItem("broker_id", String(brokerData.broker_id));
    }
  }, [brokerData]);

  // fetch user balance 
  // type BalanceData = {
  //   balance: number | string;
  //   currency?: string;
  //   [key: string]: any;
  // };

  // Update the balance data type
  type BalanceData = {
  balance: number | string | { usd: number; inr: number };
  currency?: string;
};


  const {
    data: Balances,
    isLoading: isLoadingBalance,
    isError: isBalanceError,
    isFetching: isFetchingBalance,
    refetch
  } = useQuery<BalanceData>({
    queryKey: ['/user-balance', email],
    staleTime: 30000,
    enabled: !!email,
    queryFn: () => {
      if (!email) {
        throw new Error('Email is required for this API call');
      }
      return apiRequest("GET", `/api/user/balance?email=${encodeURIComponent(email)}`);
    },
    retry: 1, // Only retry once to avoid excessive failed requests
    refetchInterval: 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const handleRefreshBalance = async () => {
    setIsManuallyRefreshing(true);
    const start = Date.now();
    let timeoutId;
    try {
      if (!email) throw new Error('Email is required');
      // Call the refreshed_wallet API
      const refreshedBalance = await apiRequest<number>(
        'GET',
        `/api/user/refreshed_wallet?email=${encodeURIComponent(email)}`
      );
      if (typeof refreshedBalance === 'number' && !isNaN(refreshedBalance)) {
        setBalance(refreshedBalance);
        sessionStorage.setItem('balance', refreshedBalance.toString());
        sessionStorage.setItem('currency', 'USD');
      }
    } catch (error: any) {
      console.error('Failed to refresh balance:', error);
      // Optionally show a toast or error message here
    } finally {
      const elapsed = Date.now() - start;
      const delay = Math.max(300 - elapsed, 0);
      timeoutId = setTimeout(() => {
        setIsManuallyRefreshing(false);
      }, delay);
    }
    return () => clearTimeout(timeoutId);
  };

  useEffect(() => {
    if (Balances) {
      try {
        console.log('Balance data from API:', Balances);

        // ✅ Handle new format with both USD and INR
        if (typeof Balances.balance === 'object' && Balances.balance !== null) {
          const { balance, currency } = Balances;

          setBalances({
            usd: balance.usd || 0,
            inr: balance.inr || 0,
          });

          if (Array.isArray(currency)) {
            setCurrencies(currency as ('usd' | 'inr')[]);
          } else if (typeof currency === 'string') {
            setCurrencies([currency.toLowerCase() as 'usd' | 'inr']);
          } else {
            setCurrencies(brokerName === 'coindcx' ? ['usd', 'inr'] : ['usd']);
          }

          sessionStorage.setItem(
            'balances',
            JSON.stringify({ usd: balance.usd || 0, inr: balance.inr || 0 })
          );
          sessionStorage.setItem('currencies', JSON.stringify(currencies));
        } else {
          // ✅ Handle old format with single balance + currency
          const rawBalance = Balances.balance;
          const balanceValue =
            typeof rawBalance === 'number'
              ? rawBalance
              : parseFloat(rawBalance as string);

          if (!isNaN(balanceValue)) {
            const currency =
              (Balances.currency || 'usd').toLowerCase() as 'usd' | 'inr';

            setBalances({
              usd: currency === 'usd' ? balanceValue : 0,
              inr: currency === 'inr' ? balanceValue : 0,
            });
            setCurrencies([currency]);

            sessionStorage.setItem(
              'balances',
              JSON.stringify({
                usd: currency === 'usd' ? balanceValue : 0,
                inr: currency === 'inr' ? balanceValue : 0,
              })
            );
            sessionStorage.setItem('currencies', JSON.stringify([currency]));
          }
        }
      } catch (error) {
        console.error('Error parsing balance data:', error);
      }
    } else if (isBalanceError || isLoadingBalance) {
      // ✅ Fallback to brokerData or session storage
      if (brokerData?.balances?.USDT) {
        const balanceFromBroker = parseFloat(brokerData.balances.USDT.toString());
        if (!isNaN(balanceFromBroker)) {
          setBalances({ usd: balanceFromBroker, inr: 0 });
          setCurrencies(['usd']);
          sessionStorage.setItem(
            'balances',
            JSON.stringify({ usd: balanceFromBroker, inr: 0 })
          );
          sessionStorage.setItem('currencies', JSON.stringify(['usd']));
        }
      } else {
        const storedBalances = sessionStorage.getItem('balances');
        const storedCurrencies = sessionStorage.getItem('currencies');
        if (storedBalances && storedCurrencies) {
          try {
            const parsedBalances = JSON.parse(storedBalances);
            const parsedCurrencies = JSON.parse(storedCurrencies);
            setBalances(parsedBalances);
            setCurrencies(parsedCurrencies);
          } catch (error) {
            console.error('Error parsing stored balance data:', error);
          }
        }
      }
    }
  }, [Balances, brokerData, isBalanceError, isLoadingBalance, brokerName]);


  // Helper function to format currency display
  const formatBalanceDisplay = () => {
    if (isLoadingBalance) return 'Loading…';

    // Determine which balance to show based on broker and available currencies
    const showINR = currencies.includes('inr') && balances.inr > 0;
    const showUSD = currencies.includes('usd') && balances.usd > 0;

    if (brokerName === 'coindcx') {
      // For CoinDCX, show both if both are available and > 0
      if (showUSD && showINR) {
        return `$${balances.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ₹${balances.inr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } else if (showINR) {
        return `₹${balances.inr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } else {
        return `$${balances.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    } else {
      // For Delta Exchange, show USD only
      return `$${balances.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  // Helper function to get total balance value for color coding
  const getTotalBalanceForColor = () => {
    // Use USD as primary, but if only INR is available, use that
    if (currencies.includes('usd') && balances.usd > 0) {
      return balances.usd;
    } else if (currencies.includes('inr') && balances.inr > 0) {
      return balances.inr;
    }
    return 0;
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = parseInt((entry.target as HTMLElement).dataset.index || '0', 10);
            setActiveIndex(index);
          }
        });
      },
      {
        root: container,
        threshold: 0.6
      }
    );

    const children = Array.from(container.children);
    children.forEach(child => observer.observe(child));

    return () => {
      children.forEach(child => observer.unobserve(child));
    };
  }, []);


  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      {/* // <div className="flex min-h-screen bg-white"> */}
      <Sidebar />

      <div className="flex-1 md:ml-[14rem]">
        <Header />
        <Lowheader />

        <style>{`
          /* Light custom scrollbar for Home page */
          .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #e2e8f0 #f8fafc; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        `}</style>

        <main className="p-2 md:p-4">
          <div className="flex justify-between w-full min-h-0">
            {/* user connection here flex-col lg:flex-row gap-6 */}
            <div ref={scrollRef} className="basis-[63%] flex flex-col min-h-0 max-h-[calc(100vh-140px)] overflow-y-auto snap-y snap-mandatory scroll-smooth pr-4 custom-scrollbar">
              {brokerIsActive === "true" ? (
                <div className="p-2 bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                  <Card className="w-full max-w-5xl bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                    <CardContent className="p-0">
                      {/* Top Section */}
                      <div className="p-2 flex items-start justify-between mb-2">
                        <div>
                          <h1 className="font-[500] text-[30px] leading-[38px] tracking-[0] font-poppins text-gray-900 mb-3">Hi, {userName ? userName : "User"}!</h1>
                          <p className="text-base text-gray-600">Hey, Trade Intelligently. Execute Instantly. Grow Confidently.</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500 mb-2">Total Value</div>

                          <div className="flex items-center">
                            {isManuallyRefreshing ? (
                              // Spinner when clicks refresh btn
                              <svg
                                className="w-6 h-6 ml-2 mt-2 text-blue-400 animate-spin"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                />
                              </svg>
                            ) : (
                              // Balance text when not manually refreshing
                              <span
                                className={`text-2xl p-1 font-bold ${getTotalBalanceForColor() > 0
                                  ? 'text-green-600'
                                  : getTotalBalanceForColor() < 0
                                    ? 'text-red-600'
                                    : 'text-blue-600'
                                  }`}
                              >
                                {formatBalanceDisplay()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Section */}
                      <div className="py-2 px-8 flex items-center justify-between bg-[#DCE6FF] rounded-lg">
                        {/* Delta Section */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-32 h-10 rounded-lg flex items-center justify-start overflow-hidden">
                              {brokerName === 'delta_exchange' ? (

                                <svg width="150" height="30" viewBox="0 0 139 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="nav_deltaIndiaLogoWithText__6NlId">
                                  <path d="M10.1209 10.0001L19.8791 15.0001L29.6372 10.0001L10.1209 0V10.0001Z" fill="url(#paint0_linear_1_43)"></path>
                                  <path d="M10.1212 19.9999V30L29.6375 19.9999L19.8793 14.9999L10.1212 19.9999Z" fill="url(#paint1_linear_1_43)"></path>
                                  <path d="M29.6381 20.0002V10.0001L19.8799 15.0002L29.6381 20.0002Z" fill="#2CB72C"></path>
                                  <path d="M10.12 10.0001V20.0002L0.361877 15.0002L10.12 10.0001Z" fill="#FF9300"></path>
                                  <path fill-rule="evenodd" clip-rule="evenodd" d="M43.7278 4.6629H40V13.427H43.7278C44.6324 13.427 45.4273 13.2585 46.14 12.8933C46.8526 12.5281 47.4008 12.0225 47.7846 11.3483C48.1683 10.6742 48.3602 9.91575 48.3602 9.04496C48.3602 8.17416 48.1683 7.41573 47.7846 6.74157C47.4008 6.06741 46.8526 5.56179 46.14 5.19661C45.4547 4.83144 44.6324 4.6629 43.7278 4.6629ZM45.3177 11.658C44.8517 11.9108 44.3035 12.0232 43.673 12.0232H41.5898V6.06807H43.673C44.3035 6.06807 44.8517 6.18043 45.3177 6.43324C45.7837 6.65797 46.1674 7.02314 46.4141 7.47258C46.6608 7.92202 46.7978 8.45573 46.7978 9.04562C46.7978 9.63552 46.6608 10.1692 46.4141 10.6187C46.1674 11.0681 45.7837 11.4052 45.3177 11.658Z" fill="currentColor"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M50.658 10.5621H55.7563C55.7683 10.4759 55.7751 10.3951 55.7812 10.322C55.789 10.2285 55.7958 10.1477 55.8112 10.0846C55.8112 9.41042 55.6741 8.82053 55.4 8.28682C55.0985 7.7812 54.7147 7.35985 54.2213 7.07894C53.728 6.79804 53.1523 6.65759 52.5219 6.65759C51.8914 6.65759 51.3158 6.82613 50.795 7.10703C50.2742 7.38794 49.8905 7.80929 49.589 8.31491C49.2874 8.82053 49.1504 9.41042 49.1504 10.0565C49.1504 10.7307 49.2874 11.2925 49.589 11.8262C49.8905 12.3318 50.3016 12.7531 50.8498 13.034C51.3981 13.343 52.0285 13.4835 52.7412 13.4835C53.2894 13.4835 53.8102 13.3992 54.2488 13.2026C54.6873 13.006 55.0437 12.7531 55.3452 12.388L54.5229 11.4329C54.0843 11.9104 53.4813 12.1633 52.7686 12.1633C52.2204 12.1633 51.7544 12.0228 51.3706 11.7419C50.9869 11.4329 50.7402 11.0396 50.658 10.5621ZM50.6592 9.52277C50.714 9.04524 50.9333 8.65198 51.2622 8.34299C51.6185 8.06209 52.0297 7.89355 52.4957 7.89355C52.9891 7.89355 53.4002 8.034 53.7292 8.34299C54.0581 8.65198 54.2774 9.04524 54.3322 9.52277H50.6592Z" fill="currentColor"></path><path d="M57.0195 4.12897H58.5545V13.3987H57.0195V4.12897Z" fill="currentColor"></path><path d="M64.5063 13.0334C64.3144 13.1739 64.1225 13.2863 63.8484 13.3705C63.6017 13.4548 63.3276 13.4829 63.0261 13.4829C62.3134 13.4829 61.7652 13.2863 61.3814 12.9211C60.9977 12.5278 60.8058 11.9941 60.8058 11.2357V8.03341H59.7368V6.79744H60.8058V5.28058H62.3408V6.79744H64.0951V8.03341H62.3408V11.2076C62.3408 11.5447 62.423 11.7694 62.5601 11.9379C62.7246 12.1065 62.9438 12.1907 63.218 12.1907C63.5469 12.1907 63.8484 12.1065 64.0677 11.9098L64.5063 13.0334Z" fill="currentColor"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M70.9715 9.49469C70.9715 8.53963 70.7248 7.83738 70.204 7.35985C69.7106 6.88231 68.9705 6.65759 68.0111 6.65759C67.4629 6.65759 66.9421 6.74186 66.4761 6.88231C65.9827 7.02276 65.5716 7.24748 65.2427 7.5003L65.8457 8.6239C66.0924 8.42727 66.3939 8.25873 66.7502 8.14637C67.1066 8.03401 67.4629 7.97783 67.8192 7.97783C68.34 7.97783 68.7512 8.09019 69.0253 8.343C69.2994 8.59581 69.4365 8.93289 69.4365 9.41042V9.52278H67.7644C66.8325 9.52278 66.1472 9.69132 65.7086 10.0565C65.2701 10.4217 65.0508 10.8992 65.0508 11.4891C65.0508 11.8823 65.1604 12.2194 65.3523 12.5284C65.5442 12.8093 65.8457 13.0621 66.202 13.2307C66.5858 13.3992 66.9969 13.4835 67.4903 13.4835C67.9837 13.4835 68.3949 13.3992 68.7512 13.2588C69.0801 13.0902 69.3542 12.8655 69.5461 12.5846V13.3992H70.9715V9.49469ZM69.4377 11.3205C69.3006 11.6576 69.1088 11.9104 68.8072 12.0789C68.5331 12.2475 68.1768 12.3598 67.793 12.3598C67.4093 12.3598 67.1078 12.2755 66.8885 12.107C66.6692 11.9385 66.5596 11.7137 66.5596 11.4328C66.5596 10.8429 66.9981 10.534 67.8753 10.534H69.4377V11.3205Z" fill="currentColor"></path><path d="M72.4583 13.1742C72.2664 12.9775 72.1567 12.7247 72.1567 12.4438C72.1567 12.1348 72.239 11.882 72.4308 11.6854C72.6227 11.4888 72.8694 11.4045 73.1435 11.4045C73.4176 11.4045 73.6643 11.4888 73.8562 11.6854C74.0481 11.882 74.1303 12.1348 74.1303 12.4438C74.1303 12.7528 74.0207 12.9775 73.8288 13.1742C73.6369 13.3708 73.3902 13.4551 73.1161 13.4551C72.8968 13.4831 72.6501 13.3708 72.4583 13.1742Z" fill="currentColor"></path><path d="M45.8933 24.7754V25.3372H40V16.6011H45.7014V17.1629H40.6304V20.618H45.1806V21.1798H40.6304V24.7754H45.8933Z" fill="currentColor"></path><path d="M51.8932 25.3652L49.7004 22.4439L47.5075 25.3652H46.8223L49.344 21.9944L46.9593 18.8483H47.6446L49.7004 21.545L51.7562 18.8483H52.4414L50.0567 21.9944L52.6059 25.3652H51.8932Z" fill="currentColor"></path><path d="M54.558 24.9721C54.0646 24.6912 53.6809 24.2979 53.4068 23.7923C53.1327 23.2867 52.9956 22.7249 52.9956 22.0788C52.9956 21.4327 53.1327 20.8709 53.4068 20.3653C53.6809 19.8597 54.0646 19.4664 54.558 19.1855C55.0514 18.9046 55.5996 18.7642 56.2026 18.7642C56.7234 18.7642 57.1894 18.8765 57.6006 19.0732C58.0117 19.2698 58.3681 19.5788 58.6148 19.972L58.1762 20.3091C57.9569 19.972 57.6554 19.7473 57.3265 19.5788C56.9975 19.4102 56.6138 19.326 56.2026 19.326C55.7092 19.326 55.2707 19.4383 54.8595 19.663C54.4758 19.8878 54.1468 20.2248 53.9276 20.6181C53.7083 21.0395 53.5986 21.517 53.5986 22.0507C53.5986 22.5844 53.7083 23.0619 53.9276 23.4833C54.1468 23.9046 54.4484 24.2136 54.8595 24.4384C55.2433 24.6631 55.7092 24.7754 56.2026 24.7754C56.6138 24.7754 56.9701 24.6912 57.3265 24.5226C57.6554 24.3541 57.9569 24.1294 58.1762 23.7923L58.6148 24.1294C58.3681 24.5226 58.0117 24.8316 57.6006 25.0282C57.1894 25.2249 56.7234 25.3372 56.2026 25.3372C55.5996 25.3934 55.0514 25.253 54.558 24.9721Z" fill="currentColor"></path><path d="M64.831 19.4946C65.297 19.9721 65.5163 20.6463 65.5163 21.5452V25.3374H64.9132V21.5733C64.9132 20.8429 64.7214 20.2811 64.365 19.8879C64.0087 19.4946 63.4879 19.3261 62.8574 19.3261C62.1174 19.3261 61.5143 19.5508 61.1032 20.0002C60.6646 20.4497 60.4453 21.0677 60.4453 21.8542V25.3374H59.8423V16.0676H60.4453V20.1688C60.6646 19.7193 60.9935 19.3823 61.4321 19.1294C61.8707 18.8766 62.3641 18.7643 62.9671 18.7643C63.7346 18.7924 64.365 19.0171 64.831 19.4946Z" fill="currentColor"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M72.1233 21.236C72.1233 20.4214 71.904 19.8315 71.4929 19.4102C71.0543 18.9888 70.4513 18.7922 69.7386 18.7922C69.2452 18.7922 68.8067 18.8764 68.3407 19.045C67.8747 19.2135 67.5184 19.4382 67.1894 19.7191L67.4909 20.1686C67.7651 19.9158 68.094 19.7191 68.4777 19.5787C68.8615 19.4382 69.2726 19.354 69.6838 19.354C70.2868 19.354 70.7528 19.5225 71.0817 19.8315C71.4107 20.1405 71.5751 20.5899 71.5751 21.2079V21.7416H69.3823C68.56 21.7416 67.9569 21.9102 67.5732 22.2473C67.1894 22.5843 66.9976 23.0338 66.9976 23.5675C66.9976 24.1293 67.1894 24.5787 67.6006 24.9158C68.0117 25.2529 68.56 25.4214 69.2726 25.4214C69.8208 25.4214 70.2868 25.3372 70.6706 25.1124C71.0543 24.8877 71.3558 24.6068 71.5477 24.2136V25.3653H72.1233V21.236ZM71.4964 23.4264C71.332 23.904 71.0305 24.2691 70.6741 24.522C70.3178 24.7748 69.8518 24.8871 69.331 24.859C68.7554 24.859 68.3168 24.7467 68.0153 24.4939C67.7138 24.2411 67.5493 23.904 67.5493 23.4826C67.5493 23.0894 67.6864 22.7523 67.9605 22.5276C68.262 22.3028 68.7006 22.1905 69.331 22.1905H71.4964V23.4264Z" fill="currentColor"></path><path d="M78.5898 19.4945C79.0558 19.972 79.2751 20.6462 79.2751 21.5451V25.3372H78.672V21.5732C78.672 20.8428 78.4801 20.281 78.1238 19.8878C77.7675 19.4945 77.2467 19.326 76.6162 19.326C75.8761 19.326 75.2731 19.5507 74.862 20.0001C74.4234 20.4496 74.2041 21.0675 74.2041 21.8541V25.3372H73.6011V18.8203H74.1767V20.2248C74.396 19.7754 74.7249 19.4102 75.1635 19.1574C75.602 18.9046 76.1228 18.7642 76.6985 18.7642C77.4934 18.7923 78.1238 19.017 78.5898 19.4945Z" fill="currentColor"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M86.7593 24.663V18.9045H86.1837V20.3652C85.9096 19.8877 85.5533 19.4944 85.0873 19.2416C84.6213 18.9888 84.0731 18.8483 83.4975 18.8483C82.8945 18.8483 82.3737 18.9888 81.8803 19.2416C81.3869 19.5225 81.0031 19.8877 80.729 20.3652C80.4549 20.8427 80.3179 21.3764 80.3179 21.9944C80.3179 22.5843 80.4549 23.1461 80.729 23.6236C81.0305 24.1012 81.3869 24.4663 81.8803 24.7472C82.3737 25.0001 82.8945 25.1405 83.4975 25.1405C84.0731 25.1405 84.5939 25.0001 85.0599 24.7472C85.5259 24.4944 85.9096 24.1293 86.1563 23.6517V24.7472C86.1563 25.618 85.9644 26.236 85.5533 26.6574C85.1695 27.0787 84.5391 27.2754 83.6894 27.2754C83.196 27.2754 82.73 27.1911 82.264 27.0225C81.798 26.854 81.4417 26.6293 81.1128 26.3203L80.7839 26.7978C81.1128 27.1068 81.5239 27.3596 82.0447 27.5563C82.5655 27.7529 83.1137 27.8372 83.6894 27.8372C84.7036 27.8372 85.4711 27.5563 85.9919 27.0506C86.5127 26.545 86.7593 25.7304 86.7593 24.663ZM85.8298 23.2868C85.6105 23.6801 85.309 23.9891 84.8978 24.2138C84.4866 24.4385 84.0481 24.5509 83.5547 24.5509C83.0613 24.5509 82.5953 24.4385 82.2116 24.2138C81.8004 23.9891 81.4989 23.6801 81.2796 23.2868C81.0603 22.8936 80.9507 22.4441 80.9507 21.9385C80.9507 21.4329 81.0603 20.9834 81.2796 20.5902C81.4989 20.1969 81.8278 19.8879 82.2116 19.6632C82.6227 19.4385 83.0613 19.3261 83.5547 19.3261C84.0481 19.3261 84.4866 19.4385 84.8978 19.6632C85.309 19.8879 85.6105 20.1969 85.8298 20.5902C86.049 20.9834 86.1587 21.4329 86.1587 21.9385C86.1587 22.4441 86.049 22.8936 85.8298 23.2868Z" fill="currentColor"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M88.4868 22.2472H93.9415L93.9963 22.1068C93.9963 21.4888 93.8866 20.927 93.6125 20.4214C93.3384 19.9158 92.9821 19.5225 92.5161 19.2416C92.0501 18.9607 91.5293 18.8203 90.9537 18.8203C90.3781 18.8203 89.8573 18.9607 89.3913 19.2416C88.9253 19.5225 88.569 19.9158 88.2949 20.4214C88.0482 20.927 87.9111 21.4888 87.9111 22.1349C87.9111 22.781 88.0482 23.3428 88.3223 23.8484C88.5964 24.354 88.9801 24.7473 89.4735 25.0282C89.9669 25.3091 90.5425 25.4495 91.173 25.4495C91.6664 25.4495 92.1324 25.3652 92.5435 25.1686C92.9547 24.972 93.311 24.7192 93.5851 24.3821L93.2288 23.9607C93.0095 24.2416 92.708 24.4944 92.3516 24.6349C91.9953 24.7754 91.6116 24.8596 91.2004 24.8596C90.6796 24.8596 90.241 24.7473 89.8299 24.5225C89.4187 24.2978 89.1172 23.9888 88.8705 23.5956C88.6238 23.2023 88.5142 22.7529 88.4868 22.2472ZM88.8706 20.5055C89.0898 20.1123 89.364 19.8314 89.7203 19.6348C90.0766 19.4381 90.4604 19.3258 90.9264 19.3539C91.3649 19.3539 91.7761 19.4662 92.1324 19.6628C92.4888 19.8876 92.7903 20.1685 93.0096 20.5336C93.2288 20.8988 93.3385 21.2921 93.3659 21.7696H88.4868C88.5416 21.2921 88.6513 20.8707 88.8706 20.5055Z" fill="currentColor"></path><line x1="99.15" y1="16" x2="99.15" y2="26" stroke="currentColor" stroke-width="0.3"></line><path d="M104 25.5V16.5H105.36V25.5H104Z" fill="currentColor"></path><path d="M108.033 25.5V16.5H109.481C109.828 17.0316 110.305 17.761 110.912 18.6882C111.523 19.6154 112.081 20.4684 112.586 21.2473C113.094 22.022 113.568 22.7555 114.005 23.4478V16.5H115.294V25.5H113.84C113.493 24.9725 113.012 24.2473 112.397 23.3242C111.782 22.397 111.22 21.546 110.711 20.7713C110.203 19.9966 109.73 19.261 109.292 18.5646V25.5H108.033Z" fill="currentColor"></path><path d="M118.073 25.5V16.5H120.297C122.004 16.5 123.297 16.8729 124.176 17.6188C125.055 18.3606 125.495 19.4773 125.495 20.9691C125.495 22.4279 125.079 23.5488 124.247 24.3317C123.419 25.1106 122.222 25.5 120.657 25.5H118.073ZM119.433 24.2885H120.734C121.822 24.2885 122.648 24.0021 123.212 23.4293C123.776 22.8523 124.058 22.0302 124.058 20.9629C124.058 19.8709 123.762 19.057 123.171 18.5213C122.579 17.9815 121.667 17.7115 120.433 17.7115H119.433V24.2885Z" fill="currentColor"></path><path d="M127.735 25.5V16.5H129.095V25.5H127.735Z" fill="currentColor"></path><path d="M133.495 21.9396H136.132C135.769 20.8558 135.334 19.5721 134.825 18.0886C134.234 19.8029 133.79 21.0865 133.495 21.9396ZM130.727 25.5L134.151 16.5H135.547L139 25.5H137.48L136.611 23.1944H133.063L132.211 25.5H130.727Z" fill="currentColor"></path><defs><linearGradient id="paint0_linear_1_43" x1="32.3212" y1="8.56271" x2="20.8051" y2="-1.10809" gradientUnits="userSpaceOnUse"><stop stop-color="#E96C04"></stop><stop offset="1" stop-color="#FF9300"></stop></linearGradient><linearGradient id="paint1_linear_1_43" x1="22.8785" y1="10.7865" x2="11.9291" y2="20.6491" gradientUnits="userSpaceOnUse"><stop stop-color="#168016"></stop><stop offset="1" stop-color="#2CB72C"></stop></linearGradient></defs></svg>
                              ) : (
                                <span className="font-bold text-[25px] select-none mr-3 whitespace-nowrap">
                                  <span style={{ color: '#1A2B49', fontFamily: 'Poppins, Arial, sans-serif', letterSpacing: '-0.04em' }}>Coin</span>
                                  <span style={{ color: '#FF4D23', fontFamily: 'Poppins, Arial, sans-serif', letterSpacing: '-0.04em' }}>DCX</span>
                                </span>
                              )}

                            </div>
                            <span className="text-xl font-semibold text-gray-900">{""}</span>
                          </div>

                        </div>

                        {/* Performance and Controls */}
                        <div className="flex items-center gap-8">
                          {/* Deactivate All */}
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                              <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-md font-semibold text-gray-900">Deactivate All</div>
                              <div className="flex items-center gap-2">
                                <span className={`${!runAllEnabled ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>off</span>
                                {isLoadingDeactivate ? (
                                  <div className="w-10 h-5 p-[6px] m-[4px] flex items-center justify-center">
                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                  </div>
                                ) : (
                                  <Switch
                                    checked={runAllEnabled}
                                    onCheckedChange={async (checked) => {
                                      if (!checked) return;

                                      try {
                                        setIsLoadingDeactivate(true);

                                        const response = await apiRequest<{ message?: string }>(
                                          "POST",
                                          "/api/strategy/deactivate-all"
                                        );


                                        setRunAllEnabled(true);

                                        toast({
                                          title: response?.message || 'Success',
                                          description: response?.message || 'Strategies deactivated successfully',
                                        });

                                        // Invalidate and refetch the deployed strategies
                                        await queryClient.invalidateQueries({
                                          queryKey: ['/deployed-strategies', email],
                                        });


                                        // Auto reset toggle after 1 second
                                        setTimeout(() => {
                                          setRunAllEnabled(false);
                                        }, 1000);

                                      } catch (error: any) {
                                        console.error('Error deactivating strategies:', error);
                                        toast({
                                          title: 'Error',
                                          description: error.response?.data?.detail || 'Failed to deactivate strategies',
                                          variant: 'destructive',
                                        });
                                        setRunAllEnabled(false);
                                      } finally {
                                        setIsLoadingDeactivate(false);
                                      }
                                    }}
                                    className="data-[state=checked]:bg-blue-600"
                                    disabled={isLoadingDeactivate}
                                  />
                                )}
                                <span className={`${runAllEnabled ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>on</span>

                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Balance refresh button */}
                        <button
                          type="button"
                          onClick={handleRefreshBalance}
                          className="group flex items-center gap-2 px-2 py-1 rounded-full bg-[#74d47742] text-green-600 font-semibold hover:bg-[rgb(22,163,74)] hover:text-white transition-colors duration-300"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="transition-transform duration-500 ease-in-out group-hover:rotate-180"
                          >
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                            <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
                            <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
                          </svg>
                          Balance
                        </button>


                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                (user || userName) ? <TradingGreetingCard userName={userName} brokerName={brokerName} /> : <CryptoSniperWelcome />
              )}

              <div className="py-8 w-full mx-auto m-2 p-2 flex flex-wrap">
                <CryptoMarketOverview />
              </div>
            </div>
            <div className="basis-[35%] h-auto sticky top-0">
              <DeployedStrategies />
            </div>

          </div>
        </main>
      </div >
    </div >
  );
}

