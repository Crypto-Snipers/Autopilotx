import { ArrowRight, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import NoStrategyDeployment from '../assets/undraw_relaxed-reading_wfkr.svg'

type Strategy = {
  _id: string;
  name: string;
  margin: number;
  multiplier: number;
  Qty: number;
  status: string;
};


const DeployedStrategies = () => {
  const { user } = useAuth();
  const [isActiveUser, setisActiveUser] = useState(false)
  useEffect(() => {
    if (user) {
      setisActiveUser(true)
    }
  })

  // Fetch user broker is connected or not
  const { data: strategies, isLoading: isLoadingStrategies } = useQuery({
    queryKey: ['/deployed', user?.email],
    staleTime: 30000,
    queryFn: () => {
      return apiRequest("GET", `/api/strategies/deployed?email=${encodeURIComponent(user?.email || '')}`);
      // return apiRequest("GET", `/api/strategies?email=${encodeURIComponent(user?.email || '')}`);
    },
    refetchInterval: 2000,
  });

  return (
    <div className="bg-background rounded-3xl p-6 w-full h-full max-w-md shadow-sm">
      <h2 className="text-[20px] leading-[30px] font-semibold text-gray-900 dark:text-foreground mb-4 flex justify-start font-poppins">Deployed Strategies</h2>

      {isLoadingStrategies ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        user ? (
          <div>
            {(Array.isArray(strategies) && strategies.length > 0) ? (strategies.map((strategy: any, index: any) => (
              <div
                key={index}
                className={`border border-gray-200 rounded-2xl p-4 mb-4 ${index === strategies.length - 1 ? '' : 'mb-4'
                  }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center">
                    <div className="font-medium text-[18px] leading-[28px] font-poppins mb-[18px] mr-3">{strategy.name}</div>
                    <span className="text-gray-500 text-sm">{strategy._id}</span>
                  </div>
                  <div className={`flex items-center px-3 py-1 rounded-full ${strategy.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                  >
                    <div className="w-4 h-4 mr-1">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.7502 14.5H4.25024C2.47691 14.5 1.50024 13.5233 1.50024 11.75V4.25C1.50024 2.47667 2.47691 1.5 4.25024 1.5H11.7502C13.5236 1.5 14.5002 2.47667 14.5002 4.25V11.75C14.5002 13.5233 13.5236 14.5 11.7502 14.5ZM4.25024 2.5C3.02358 2.5 2.50024 3.02333 2.50024 4.25V11.75C2.50024 12.9767 3.02358 13.5 4.25024 13.5H11.7502C12.9769 13.5 13.5002 12.9767 13.5002 11.75V4.25C13.5002 3.02333 12.9769 2.5 11.7502 2.5H4.25024ZM5.83358 10.6667V7.33333C5.83358 7.05733 5.60958 6.83333 5.33358 6.83333C5.05758 6.83333 4.83358 7.05733 4.83358 7.33333V10.6667C4.83358 10.9427 5.05758 11.1667 5.33358 11.1667C5.60958 11.1667 5.83358 10.9427 5.83358 10.6667ZM8.50024 10.6667V5.33333C8.50024 5.05733 8.27624 4.83333 8.00024 4.83333C7.72424 4.83333 7.50024 5.05733 7.50024 5.33333V10.6667C7.50024 10.9427 7.72424 11.1667 8.00024 11.1667C8.27624 11.1667 8.50024 10.9427 8.50024 10.6667ZM11.1669 10.6667V8.66667C11.1669 8.39067 10.9429 8.16667 10.6669 8.16667C10.3909 8.16667 10.1669 8.39067 10.1669 8.66667V10.6667C10.1669 10.9427 10.3909 11.1667 10.6669 11.1667C10.9429 11.1667 11.1669 10.9427 11.1669 10.6667Z" fill="#006038" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium">{strategy.status === "active" ? "Live" : "Inactive"}</span>
                  </div>
                </div>


                <div className="mt-4 space-y-2 text-blue-500 font-medium">
                  <div className="flex justify-between">
                    <span>Margin in use:</span>
                    <span>${Number(strategy.margin || 0) * Number(strategy.multiplier || 1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity in use:</span>
                    <span>{(Number(strategy.Qty || 0) * Number(strategy.multiplier || 1)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Multiplier selected:</span>
                    <span>{strategy.multiplier || 1}</span>
                  </div>
                </div>

              </div>
            ))) : (<div className="text-center py-4 text-gray-500">
              <div className="flex flex-col items-center justify-center py-8">
                <img src={NoStrategyDeployment} className='w-42 h-36 pb-4'></img>

                <p className="text-gray-500 dark:text-gray-200   mb-2">No Strategy Deployed</p>
                <button className="flex items-center text-green-600 text-sm font-medium" onClick={() => window.location.href = "/strategies"}>
                  View All
                  <ArrowRight size={16} className="ml-1" />
                </button>
              </div>
            </div>)}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Please log in to view your deployed strategies
          </div>
        )
      )}
    </div>
  );
};

export default DeployedStrategies;