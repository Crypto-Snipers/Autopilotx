import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { X, Loader2, BadgeInfo, Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { setSessionItem } from '@/lib/sessionStorageUtils';
import DeltaExchangeLogo from '../assets/DeltaExchangeLogo.png';

interface AddBrokerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AddBrokerModal: React.FC<AddBrokerModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [brokerId, setBrokerId] = useState('');
  const [app_name, setAppName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  // const [selectedCurrency, setSelectedCurrency] = useState<'INR' | 'USDT' | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const { toast } = useToast();
  const { user, hasCustomAuth } = useAuth();
  const [location, navigate] = useLocation();
  const [brokerIdError, setBrokerIdError] = useState('');


  if (!isOpen) return null;

  // Condistion on user ID, that is should only accepts digits
  const isValidateBrokerId = (id: string) => /^\d+$/.test(id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!brokerId) {
      setBrokerIdError('User Id required');
      return;
    } else if (!isValidateBrokerId(brokerId)) {
      setBrokerIdError('User ID should contain only numbers');
      return;
    } else {
      setBrokerIdError('');
    }

    if (!brokerId || !apiKey || !apiSecret) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      // Step 1: Add broker
      const brokerData = {
        broker_id: brokerId,
        app_name: app_name,
        api_key: apiKey,
        api_secret: apiSecret,
        email: user?.email || '',
        broker_name: "delta_exchange"
      };

      console.log("Sending broker data:", brokerData);
      // Define the expected response type
      interface VerifyResponse {
        success?: boolean;
        message?: string;
        [key: string]: any;
      }

      try {
        const verifyResponse: VerifyResponse = await apiRequest("POST", "/api/broker/verify", {
          email: user?.email || '',
          broker_name: "delta_exchange",
          broker_id: brokerId,
          app_name: app_name,
          api_key: apiKey,
          api_secret: apiSecret
        });

        if (verifyResponse?.success) {
          toast({
            title: "Success",
            description: "Broker connected successfully",
          });


          // Store broker info in localStorage/sessionStorage for immediate access
          setSessionItem("broker_name", "Delta_Exchange");
          setSessionItem("api_verified", "");
          setSessionItem("broker_id", brokerId || "");
          // setSessionItem("currency", selectedCurrency || "");

          // Close modal and call success callback
          onClose();
          if (onSuccess) onSuccess();
          window.location.reload();

          // Use navigation instead of page reload to reflect changes
          // This avoids the full page reload that's causing authentication issues
          setTimeout(() => {
            // Navigate to the same page to trigger a re-render without full reload
            const currentPath = location;
            navigate(currentPath);
          }, 500);
        } else {
          toast({
            title: "Warning",
            description: verifyResponse?.message || "Broker added but verification pending",
          });
        }
      } catch (error) {
        console.error("Error adding broker:", error);
        toast({
          title: "Error",
          description: "An error occurred while connecting the broker",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl shadow-lg w-[800px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-base font-medium text-gray-800">Add Broker</h2>
          <div className="flex items-center gap-4">
            <a
              href="https://docs.delta.exchange"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 text-sm hover:underline"
            >
              View Docs
            </a>
            <button
              className="text-gray-400 hover:text-gray-600"
              onClick={onClose}
              disabled={isLoading}
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Broker selection pill */}
        <div className="p-4 flex items-center justify-between bg-blue-100">
          <div className="flex items-center space-x-2">
            <img
              src={DeltaExchangeLogo}
              alt="Delta Logo"
              className="h-6 w-6"
            />
            <span className="text-base font-semibold text-blue-900">Delta Exchange</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-blue-900">How to add Delta exchange?</span>
            <a
              href=""
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
              title="Watch tutorial"
            >
              <BadgeInfo className="h-5 w-5 text-blue-600" />
            </a>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-2 gap-6 p-6 relative">
          {/* Vertical divider */}
          <div className="absolute left-1/2 top-6 bottom-6 w-px bg-gray-200 transform -translate-x-1/2"></div>

          {/* Left column: Instructions */}
          <div className="text-sm text-gray-700 space-y-3">

            <div className='flex gap-1'>
              <p>1.</p>
              <div>
                <span className='text-md'>Go to : </span>
                <a
                  href="https://www.delta.exchange/app/account/manageapikeys"
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://www.delta.exchange/app/account/manageapikeys
                </a>
              </div>
            </div>

            <div className='flex gap-1 py-2'>
              <p>2.</p>
              <p>Click "Create New API Key". Name it appropriately (e.g., "AlgoTest").</p>
            </div>

            <div className='flex gap-1 py-2'>
              <p>3.</p>
              <div>
                <span>Copy and paste the whitelisted IP below:</span>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value="13.232.102.237"
                    readOnly
                    className="w-full p-2 border rounded-lg bg-gray-100 text-gray-700 text-sm"
                  />
                  <button
                    type="button"
                    className="px-3 py-2 text-xs rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white transition"
                    onClick={() => {
                      navigator.clipboard.writeText("13.232.102.237")
                      toast({
                        title: "Successful",
                        description: "Text copied!",
                      });
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <p className='py-2'>4. Enable "Trading" permission and create the key.</p>
            <p className='py-2'>5. Paste the API Key and API Secret on the right.</p>
          </div>

          {/* Right column */}
          {/* Form */}
          <form onSubmit={handleSubmit} className="px-4">
            <div className="mb-4">
              <label className="text-sm text-gray-600 mt-2 mb-2 block">
                User Id <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="12345678"
                value={brokerId}
                minLength={7}
                onChange={(e) => {
                  const value = e.target.value;
                  setBrokerId(value);
                  if (value && !isValidateBrokerId(value)) {
                    setBrokerIdError('User ID should contain only numbers');
                  } else {
                    setBrokerIdError('');
                  }
                }}
                disabled={isLoading}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 text-sm ${brokerIdError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-200 focus:ring-blue-500'
                  }`}
              />
              {brokerIdError && (
                <p className="text-red-500 text-sm mt-1">{brokerIdError}</p>
              )}
            </div>

            {/* <div className="mb-4">
              <label className="text-sm text-gray-600 mb-2 block">App Name (any)</label>
              <input
                type="text"
                placeholder="App name"
                value={app_name}
                onChange={(e) => setAppName(e.target.value)}
                disabled={isLoading}
                className="w-full p-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div> */}

            <div className="mb-4">
              <label className="text-sm text-gray-600 mb-2 block">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  placeholder="Enter your API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isLoading}
                  className="w-full p-3 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-600 mb-2 block">API Secret Key</label>
              <div className="relative">
                <input
                  type={showApiSecret ? "text" : "password"}
                  placeholder="Enter your API Secret Key"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  disabled={isLoading}
                  className="w-full p-3 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowApiSecret(!showApiSecret)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pb-6">
              <button
                type="submit"
                disabled={isLoading}
                // disabled={isLoading || !brokerId}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-lg text-sm transition cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex justify-center items-center">
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Connecting...
                  </span>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div >
  );
};

export default AddBrokerModal;