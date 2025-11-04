import React, { useEffect, useRef, useState } from 'react';
import { Plus, Play, RefreshCw, ChevronDown, UserRoundPlus } from 'lucide-react';
import AddBrokerModal from './addBrokerModal';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { getSessionItem, setSessionItem } from '@/lib/sessionStorageUtils';
import { useOutsideClick } from '@/hooks/use-outside-click';
import AddBrokerModalCoinDcx from './addBrokerModalCoinDcx';
import TradingCharacter from '../assets/undraw_crypto-portfolio_cat.svg';

interface TradingGreetingCardProps {
  userName?: string;
  brokerName?: string;
}

// Define the type for broker data returned from API
interface BrokerData {
  api_verified: string;
  broker_name?: string;
  // Add other properties that might be returned from the API
}

// const TradingGreetingCard = ({ userName, pnl: propPnl = 0, brokerName }: TradingGreetingCardProps) => {
const TradingGreetingCard = ({ userName, brokerName }: TradingGreetingCardProps) => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalOpenCoinDcx, setIsModalOpenCoinDcx] = useState(false);
  const [isBrokerConnected, setIsBrokerConnected] = useState(false);
  const [email, setEmail] = useState<string | undefined>(undefined);
  // const [sessionPnl, setSessionPnl] = useState<number | undefined>(undefined);
  const [balance, setBalance] = useState<number | undefined>(undefined);
  const { toast } = useToast();
  const [openDropdown, setOpenDropdown] = useState<null | string>(null); // can be 'add', 'create', or null
  const connectDeltaRef = useRef(null);
  const connectCoinDcxRef = useRef(null);

  const handleToggle = (dropdownName: string) => {
    setOpenDropdown(openDropdown === dropdownName ? null : dropdownName);
  };

  // Close dropdowns if clicked outside
  useOutsideClick(connectDeltaRef, () => {
    if (openDropdown === 'add') setOpenDropdown(null);
  });

  useOutsideClick(connectCoinDcxRef, () => {
    if (openDropdown === 'create') setOpenDropdown(null);
  });


  const deltaOptions = [
    { icon: <Plus className='w-5 h-5' />, name: 'Add Broker', action: 'addBroker' },
    { icon: <UserRoundPlus className='w-5 h-5' />, name: 'Create Account', href: 'https://www.delta.exchange/app/signup' }
  ];

  const coindcxOptions = [
    { icon: <Plus className='w-5 h-5' />, name: 'Add Broker', action: 'addBroker' },
    { icon: <UserRoundPlus className='w-5 h-5' />, name: 'Create Account', href: 'https://account.coindcx.com/signup' }
  ];


  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);
  const handleBrokerSuccess = () => setIsBrokerConnected(true);

  const handleOpenModalCoinDcx = () => setIsModalOpenCoinDcx(true);
  const handleCloseModalCoinDcx = () => setIsModalOpenCoinDcx(false);
  const handleBrokerSuccessCoinDcx = () => setIsBrokerConnected(true);

  // Check session storage for broker connection on component mount and whenever dependencies change
  useEffect(() => {
    // Force a check of session storage values
    const checkBrokerConnection = () => {
      const bn = getSessionItem('broker_name', '');
      const api_verified = getSessionItem('api_verified', '');
      const email = getSessionItem('signupEmail', '');

      if (email) {
        setEmail(email);
      }

      // Check all possible conditions that indicate a broker is connected
      if (api_verified === 'true' || bn || brokerName) {
        console.log('Setting broker connected to TRUE');
        setIsBrokerConnected(true);
      } else {
        console.log('Broker connection conditions not met');
      }
    };

    // Run the check immediately
    checkBrokerConnection();

    // Set up an interval to periodically check session storage
    const intervalId = setInterval(checkBrokerConnection, 2000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [brokerName]);

  // fetch user broker is connected or not
  const { data: brokerData, isLoading: isLoadingBroker } = useQuery<BrokerData>({
    queryKey: ['/get-broker', email],
    staleTime: 30000,
    enabled: !!email, // Only run the query when email is available
    queryFn: () => {
      // Make sure email is not null before using it
      if (!email) {
        throw new Error('Email is required for this API call');
      }
      return apiRequest('GET', `/api/broker?email=${encodeURIComponent(email)}`);
    },
    retry: 1, // Only retry once to avoid excessive failed requests
  });


  // Fetch user balance for Total Value
  const { data: balanceData, isError: isBalanceError, error: balanceError } = useQuery({
    queryKey: ['/user-balance', email],
    staleTime: 30000,
    enabled: !!email && isBrokerConnected, // Only run when email is available and broker is connected
    queryFn: () => {
      if (!email) {
        throw new Error('Email is required for this API call');
      }
      return apiRequest('GET', `/api/user/balance?email=${encodeURIComponent(email)}`);
    },
    retry: 1
  });

  // Handle balance error
  useEffect(() => {
    if (isBalanceError && balanceError) {
      console.error('Error fetching balance:', balanceError);
      // We'll still use the session balance as fallback
    }
  }, [isBalanceError, balanceError]);

  // Update broker connection status when broker data is available
  useEffect(() => {
    if (brokerData?.api_verified === "true") {
      console.log('Broker data:', brokerData);
      setIsBrokerConnected(true);
    }
  }, [brokerData?.api_verified]);


  // Update balance from the balance endpoint data if available
  useEffect(() => {
    if (balanceData !== undefined) {
      try {
        const balanceValue = typeof balanceData === 'number' ? balanceData : parseFloat(String(balanceData));
        if (!isNaN(balanceValue)) {
          console.log('Setting balance from API:', balanceValue);
          setBalance(balanceValue);
          // Also update session storage for consistency
          setSessionItem('balance', balanceValue);
        }
      } catch (error: unknown) {
        console.error('Error parsing balance data:', error);
      }
    } else {
      // Try to get balance from session storage as fallback
      const storedBalance = getSessionItem('balance', 0);
      if (storedBalance) {
        try {
          const parsedBalance = parseFloat(String(storedBalance));
          if (!isNaN(parsedBalance)) {
            setBalance(parsedBalance);
          }
        } catch (error: unknown) {
          console.error('Error parsing stored balance:', error);
        }
      }
    }
  }, [balanceData]);

  return (
    <div className="bg-background w-full rounded-3xl shadow-sm">
      {/* Greeting */}
      <div className="flex justify-between items-start py-5 px-6">
        <div>
          <h1 className="text-[30px] leading-[30px] font-semibold text-foreground mb-4 flex font-poppins">Hi, {userName || 'User'}!</h1>
          <p className="text-forground mt-1 font-poppins">
            Trade Intelligently. Execute Instantly. Grow Confidently.
          </p>
        </div>
      </div>

      {/* If broker is not connected */}
      {!isBrokerConnected && (
        <div className="bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#05b289] via-[#06a07c] to-[#047158] bg-opacity-20 rounded-2xl px-6 py-6 flex flex-col md:flex-row justify-between items-center text-white border-2">
          {/* // <div className="bg-gradient-to-r from-[#00b24a] via-[#00d458] to-[#9dfcc5] bg-opacity-20 rounded-2xl px-6 py-6 flex flex-col md:flex-row justify-between items-center text-white border-2"> */}
          {/* // <div className="bg-[#00ed64] rounded-2xl px-6 py-6 flex flex-col md:flex-row justify-between items-center text-white border-2"> */}
          <div className="max-w-lg">
            <h2 className="text-lg font-bold mb-2">Ready to Trade Smarter? Connect your Broker!</h2>
            <p className="mb-3  text-sm">
              Add your <span className="font-bold">broker</span> account to activate strategy deployment and start trading smarter.
            </p>
            <div className="flex gap-4 flex-wrap">
              {/* Connect Delta Dropdown */}
              <div className="relative" ref={connectDeltaRef}>
                <button
                  onClick={() => handleToggle('delta')}
                  className="bg-white border border-white text-black px-2 py-2.5 rounded-full font-semibold flex items-center justify-center gap-2 hover:bg-gray-200 transition-all duration-300 w-45"
                >
                  <div className="flex items-center gap-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-palette="DeltaIndiaLogoMobile"><path d="M7.80664 8.00006L15.6132 12.0001L23.4197 8.00006L7.80664 0V8.00006Z" fill="#FD7D02"></path><path d="M7.80762 15.9999V24L23.4207 15.9999L15.6141 11.9999L7.80762 15.9999Z" fill="url(#paint0_linear_552_5865)"></path><path d="M23.4208 16.0002V8.00012L15.6143 12.0002L23.4208 16.0002Z" fill="#2CB72C"></path><path d="M7.80652 8.00012V16.0002L0 12.0002L7.80652 8.00012Z" fill="#FF9300"></path><defs><linearGradient id="paint0_linear_552_5865" x1="18.0135" y1="8.62916" x2="9.25394" y2="16.5192" gradientUnits="userSpaceOnUse"><stop stop-color="#168016"></stop><stop offset="1" stop-color="#2CB72C"></stop></linearGradient></defs></svg>
                    <span>Connect Delta</span>
                  </div>
                  <ChevronDown className={`transition-transform duration-300 ${openDropdown === 'delta' ? 'rotate-180' : ''}`} />
                </button>
                {openDropdown === 'delta' && (
                  <div className="absolute top-full mt-2 w-44 bg-white text-black rounded-xl shadow-lg py-2 z-10 animate-fade-in-down">
                    {deltaOptions.map((option) => (
                      <a
                        key={option.name}
                        href={option.href || '#'}
                        onClick={(e) => {
                          e.preventDefault();
                          if (option.action === 'addBroker') {
                            handleOpenModal();
                          } else if (option.href) {
                            window.open(option.href, '_blank');
                          }
                          setOpenDropdown(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm font-medium cursor-pointer"
                      >
                        {option.icon}
                        {option.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Connect CoinDCX Dropdown */}
              <div className="relative" ref={connectCoinDcxRef}>
                <button
                  onClick={() => handleToggle('coindcx')}
                  className="text-white px-2 py-2 rounded-full font-semibold flex items-center justify-center gap-2 hover:bg-[#1a785f] transition-all duration-300 border-2 border-gray-200 w-45"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src="https://coindcx.com/blog/wp-content/uploads/2021/09/ProfilePic.svg"
                      alt="CoinDCX Logo"
                      className="h-7 w-7"
                    />
                    <span>Connect CoinDCX</span>
                  </div>
                  <ChevronDown className={`transition-transform duration-300 ${openDropdown === 'coindcx' ? 'rotate-180' : ''}`} />
                </button>
                {openDropdown === 'coindcx' && (
                  <div className="absolute top-full mt-2 w-48 bg-white text-black rounded-xl shadow-lg py-2 z-10 animate-fade-in-down">
                    {coindcxOptions.map((option) => (
                      <a
                        key={option.name}
                        href={option.href || '#'}
                        onClick={(e) => {
                          e.preventDefault();
                          if (option.action === 'addBroker') {
                            handleOpenModalCoinDcx();
                          } else if (option.href) {
                            window.open(option.href, '_blank');
                          }
                          setOpenDropdown(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm font-medium cursor-pointer"
                      >
                        {option.icon}
                        {option.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Trading character illustration */}
          <div className="relative w-56 h-42" >
            <img src={TradingCharacter} alt="trading" />
          </div>
        </div>
      )}

      {/* Add Broker Modal for Delta */}
      <AddBrokerModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleBrokerSuccess}
      />

      {/* Add Broker Modal for CoinDCX */}
      <AddBrokerModalCoinDcx
        isOpen={isModalOpenCoinDcx}
        onClose={handleCloseModalCoinDcx}
        onSuccess={handleBrokerSuccessCoinDcx}
      />
    </div>
  );
};

export default TradingGreetingCard;
