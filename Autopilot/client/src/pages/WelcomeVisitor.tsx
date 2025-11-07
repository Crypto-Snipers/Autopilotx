import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { 
  User, 
  ShieldCheck, 
  Zap,
  Link as LinkIcon,
  TrendingUp,
  BarChart2, 
  Bell,
  LogIn,
  Shield,
  Radio,
  Workflow, 
  InstagramIcon,
  YoutubeIcon,
  Send 
} from 'lucide-react';
import icon from '../assets/8-02.png';
import "../types/herosection.css"; 
import dashboard from '../assets/dashboard.png'
import MidBanner from '../assets/crs_dashboard_img.jpg'

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
}

// Hook for observing element intersection
const useIntersectionObserver = (options: IntersectionObserverInit): [React.RefCallback<HTMLDivElement>, boolean] => {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!node) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, options);

    observer.observe(node);
    
    return () => observer.disconnect();
  }, [node, options]);

  return [setNode, isVisible];
};

// Wrapper component for section animations
const AnimatedSection = ({ children, className = '' }: AnimatedSectionProps) => {
  const [ref, isVisible] = useIntersectionObserver({
    threshold: 0.1,
  });

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-1000 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      {children}
    </div>
  );
};


// Header component
const Header = () => (
  <header className="w-full fixed top-0 left-0 z-50 bg-[#0F2027]/80 backdrop-blur-md border-b border-slate-900">
    <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-8 py-2">
      {/* Logo */}
      <div className="flex items-center">
        <img
          src={icon}
          alt="AutopilotX Logo"
          className="h-16 md:h-20 w-auto object-contain"
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => window.location.href = "/signin"}
          className="hidden sm:inline-block text-slate-300 hover:text-white transition-colors px-4 py-2 rounded-md text-sm"
        >
          Log in
        </button>
        <button
          onClick={() => window.location.href = "/signup"}
          className="bg-[#06a57f] hover:bg-[#05b289] text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2 text-sm"
        >
          Sign up
        </button>
      </div>
    </nav>
  </header>
);

// Ripple Grid for Hero Section
const RippleGrid = () => {
  const lines = 9;
  return (
    <div className="absolute inset-0 grid-container -z-10">
      {/* Vertical lines */}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={`v-${i}`}
          className="absolute top-0 bottom-0 w-[1px] bg-[#06a57f]/50 line-animate"
          style={{ left: `${(i / (lines - 1)) * 100}%` }}
        />
      ))}

      {/* Horizontal lines */}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={`h-${i}`}
          className="absolute left-0 right-0 h-[1px] bg-[#06a57f]/50 line-animate"
          style={{ top: `${(i / (lines - 1)) * 100}%` }}
        />
      ))}
    </div>
  );
};

// Performance Graph for Strategy Cards
const PerformanceGraph = ({ showMarker = false }) => (
  <div className="px-3 pt-4 pb-2 rounded-t-2xl relative h-[140px] bg-[#162B32]">
    <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="greenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#06a57f" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#05b289" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#05b288" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      <path
        d="M 50,180 L 80,160 L 120,140 L 170,40 L 200,130 L 240,80 L 280,110 L 280,190 L 50,190 Z"
        fill="url(#greenGradient)"
      />
      <path
        d="M 50,180 L 80,160 L 120,140 L 170,40 L 200,130 L 240,80 L 280,110"
        fill="none"
        stroke="#05b289"
        strokeWidth="3"
      />

      {showMarker && (
        <g>
          <line
            x1="210" y1="20" x2="210" y2="190"
            stroke="#05b288" strokeWidth="2" strokeDasharray="4"
          />
          <rect x="190" y="5" width="40" height="18" rx="4" fill="#05b289" />
          <text x="210" y="19" fontSize="10" fill="white" textAnchor="middle">
            1 Mar
          </text>
        </g>
      )}
    </svg>
  </div>
);

// --- Page Sections ---
const HeroSection = () => (
    <section className="relative flex flex-col md:flex-row items-center justify-between px-4 sm:px-8 md:px-16 lg:px-32 min-h-screen z-10 text-center md:text-left">
        {/* Left Content */}
        <div className="flex-1 space-y-5 relative z-10">
            <div>
                <span className="bg-[#06a57f1a] text-[#06a57f] text-sm font-medium px-4 py-2 rounded-full inline-block">
                    Future of crypto trading
                </span>
            </div>
            <div className="absolute -left-16 -top-16 w-72 h-72 bg-[#06a57f]/10 blur-3xl rounded-full"></div>
            
            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
                Deploy Smart Strategies. <br className="hidden sm:block" /> Trade Automatically. <br className="hidden sm:block" /> Earn Profit.
            </h1>
            <p className="text-base md:text-lg text-slate-400 max-w-md mx-auto md:mx-0">
                Experience effortless crypto trading with ready-to-use strategies.
                Deploy them in a click, and watch your portfolio grow all on AutopilotX.
            </p>
            <div>
                <button
                    onClick={() => window.location.href = "/signin"}
                    className="mt-4 text-white font-medium px-6 py-3 rounded-md transition-transform hover:scale-[1.02] bg-[#06a57f] hover:bg-[#05b289]"
                >
                    Get Started
                </button>
            </div>

        </div>

        {/* Right Image with Ripple Grid */}
        <div className="flex-1 flex justify-center mt-10 md:mt-0 relative z-10 w-full">
          <div className="absolute -center-16 -top-16 w-72 h-72 bg-[#06a57f]/10 blur-3xl rounded-full"></div>
            <RippleGrid />
            <div className="absolute -center-16 -top-16 w-72 h-72 bg-[#06a57f]/10 blur-2xl rounded-full"></div>
            <div className="absolute -center-16 -bottom-16 w-72 h-72 bg-[#06a57f]/10 blur-2xl rounded-full"></div>
            
            <img
                src={dashboard}
                alt="Crypto Trading Dashboard"
                className="w-full max-w-md md:max-w-3xl object-contain relative z-20"
            />
        </div>
    </section>
);


// Mid Banner Section
const MidBannerSection = () => (
  <section className="px-2 sm:px-6 md:px-8">
    <div className="bg-[#1e2a3b]/60 rounded-lg md:rounded-xl shadow-xl shadow-green-500/10 border border-slate-700 overflow-hidden max-w-5xl mx-auto scale-90 md:scale-95">
      {/* Browser Header */}
      <div className="h-8 md:h-10 bg-[#0F2027] flex items-center px-3">
        <div className="flex space-x-1.5">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-red-500 rounded-full"></div>
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 rounded-full"></div>
        </div>
      </div>

      {/* Image Content */}
      <div className="p-2 sm:p-3 bg-[#0F2027]">
        <img
          src={MidBanner}
          alt="Platform Banner"
          className="w-full h-auto rounded-md"
        />
      </div>
    </div>
  </section>
);


// Strategies Section
const StrategiesSection = () => {
    const strategies = [
        { id: 1, pair: "BTC/USDT", name: "BlackBox Strategy 1", description: "A dynamic Bitcoin trading strategy built for speed, precision, and consistency.", winRate: 67, maxDrawdown: 40, totalTrades: 968 },
        { id: 2, pair: "ETH/USDT", name: "BlackBox Strategy 2", description: "A fast-paced Ethereum scalping strategy designed to capture quick, short-term profits.", winRate: 72, maxDrawdown: 32, totalTrades: 1045 },
    ];
    return (
        <div className="relative text-white flex flex-col items-center justify-center px-4 sm:px-8 overflow-hidden">
            {/* Background Lines with Glowing Dots */}
            <div className="absolute inset-0 opacity-30 pointer-events-none">
                 <svg className="w-full h-full" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                    {[
                        { color: "#05b288", points: "0,300 200,250 400,280 600,240 800,300 1000,250 1200,280 1400,260 1600,300 1800,270", yValues: [300, 250, 280, 240, 300, 250, 280, 260, 300, 270] },
                        { color: "#4FFFE2", points: "0,350 200,310 400,330 600,290 800,360 1000,310 1200,340 1400,320 1600,350 1800,315", yValues: [350, 310, 330, 290, 360, 310, 340, 320, 350, 315] },
                        { color: "#06a57f", points: "0,400 200,370 400,380 600,350 800,400 1000,370 1200,390 1400,375 1600,395 1800,360", yValues: [400, 370, 380, 350, 400, 370, 390, 375, 395, 360] },
                    ].map((line, lineIndex) => (
                        <g key={`line-${lineIndex}`}>
                            <polyline points={line.points} fill="none" stroke={line.color} strokeWidth="2" />
                            {[0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800].map((x, i) => (
                                <circle key={`dot${lineIndex}-${i}`} cx={x} cy={line.yValues[i]} r="5" fill={line.color} style={{ filter: `drop-shadow(0 0 8px ${line.color})` }} className="animate-pulse" />
                            ))}
                        </g>
                    ))}
                </svg>
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center tracking-tight drop-shadow-lg z-10">
                Proven Strategies at Your Fingertips
            </h1>
            <p className="text-center mt-6 text-base sm:text-lg text-slate-400 max-w-3xl mx-auto">
                Discover data-backed, performance-tested trading strategies built by experts. Deploy instantly and start trading with confidence.
            </p>
            <div className="flex flex-wrap gap-10 justify-center z-10 mt-12 w-full">
                {strategies.map((item) => (
                    <div key={item.id} className="rounded-2xl shadow-lg overflow-hidden border border-[#05b288]/50 w-full max-w-md sm:max-w-sm bg-[#162B32]/90 backdrop-blur-sm hover:scale-[1.03] transition-transform duration-300">
                        <PerformanceGraph showMarker={item.id === 2} />
                        <div className="p-6 rounded-b-2xl bg-[#0F2027]/90">
                            <span className="inline-block px-3 py-1 text-sm rounded-full bg-[#05b288]/20 text-[#05b288] mb-2">{item.pair}</span>
                            <h2 className="text-xl font-semibold text-white mb-2">{item.name}</h2>
                            <p className="text-sm text-gray-300 mb-4">{item.description}</p>
                            <div className="mb-3">
                                <div className="flex justify-between text-xs font-medium mb-1 text-gray-400">
                                    <span>Win Rate</span>
                                    <span className="text-white">{item.winRate}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-700 rounded-full">
                                    <div className="h-2 rounded-full bg-gradient-to-r from-[#06a57f] via-[#05b289] to-[#05b288]" style={{ width: `${item.winRate}%` }}></div>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm mb-6">
                                <div className="flex justify-between"><span className="text-gray-400">Max Drawdown</span><span className="text-white">{item.maxDrawdown}%</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">Total Trades</span><span className="text-white">{item.totalTrades}</span></div>
                            </div>
                            <button 
                            onClick={() => window.location.href = "/signin"}
                            className="w-full py-2.5 text-sm rounded-full font-semibold text-[#05b289] border border-[#05b289] hover:bg-[#05b289] hover:text-white transition"
                            >
                              Learn More
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Working Section
const HowItWorksSection = () => {
    const features = [
        { icon: <User size={20} />, title: "Create an Account", description: "Start by creating a secure account. Your privacy and security are our top priorities." },
        { icon: <LinkIcon size={20} />, title: "Authentication", description: "Use our robust authentication methods to securely link your exchange accounts." },
        { icon: <ShieldCheck size={20} />, title: "Connect to Broker", description: "Connect your preferred broker with API keys that only grant trading permissions." },
        { icon: <Zap size={20} />, title: "Choose a Strategy", description: "Browse our library of proven strategies and select the one that fits your risk tolerance." },
        { icon: <TrendingUp size={20} />, title: "Start Profiting", description: "Activate your chosen strategy and let our automated system handle the trades for you." },
    ];
    return (
        <div className="text-center py-20 sm:py-24 px-4 sm:px-8">
            <div className="absolute -center-16 -top-16 w-72 h-72 bg-[#06a57f]/10 blur-3xl rounded-full"></div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">Transparent. Powerful.</h2>
            <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-3xl mx-auto">
                We believe in full transparency. Dive deep into the historical performance of every strategy. Analyze metrics, understand the logic, and trade with confidence.
            </p>
            {/* <div className="mt-16 max-w-6xl mx-auto bg-[#162B32]/50 border border-slate-800 rounded-2xl p-6 sm:p-8 md:p-12 relative overflow-hidden"> */}
            <div className="mt-16 max-w-6xl mx-auto bg-[#162B32]/50 border border-slate-800 rounded-2xl p-6 sm:p-8 md:p-12 relative overflow-hidden shadow-xl shadow-green-500/10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                    {features.map((feature, index) => (
                        <div key={index} className="text-left">
                            <div className="flex items-center gap-3">
                                <div className="text-[#06a57f]">{feature.icon}</div>
                                <h4 className="font-bold text-white">{feature.title}</h4>
                            </div>
                            <p className="mt-2 text-slate-400 text-sm">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Trust Section
const TrustSection = () => {
    const apiFeatures = [
        { icon: <LogIn size={20} />, title: "Secure Sign-in", description: "Sign in with your email and password to access your account. with in built authentication." },
        { icon: <Shield size={20} />, title: "Secure Data", description: "Your data is safe and secure with us." },
        { icon: <Radio  size={20} />, title: "Safe Connection", description: "Safely connect to broker with API keys that only grant trading permissions." },
    ];
    const userManagementFeatures = [
        { icon: <BarChart2 size={20} />, title: "Analytics", description: "Track your portfolio and strategy performance with in-depth analytics." },
        { icon: <Bell size={20} />, title: "Notifications", description: "Stay updated with real-time alerts on trades, market moves, and account activity." },
        { icon: <Workflow  size={20} />, title: "Integrations", description: "Connect to a growing list of top-tier crypto exchanges seamlessly." },
    ];
    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                <div className="relative text-center lg:text-left">
                    <div className="absolute -left-16 -top-16 w-72 h-72 bg-[#06a57f]/10 blur-3xl rounded-full"></div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white relative">Why trust us?</h2>
                    <p className="mt-6 text-base sm:text-lg text-slate-400 relative">
                        Our platform is built on precision, transparency, and trust. Every feature is designed to help traders make confident, data-driven decisions in real time.
                    </p>
                </div>
                <div>
                    <div>
                        <p className="text-[#06a57f] font-semibold mb-8">Privacy & Security</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-12">
                            {apiFeatures.map((feature, index) => (
                                <div key={index}>
                                    <div className="flex items-center gap-3">
                                        <div className="text-[#06a57f]">{feature.icon}</div>
                                        <h4 className="font-bold text-white">{feature.title}</h4>
                                    </div>
                                    <p className="mt-2 text-slate-400 text-sm">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-16">
                        <p className="text-[#06a57f] font-semibold mb-8">Platform Features</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-12">
                            {userManagementFeatures.map((feature, index) => (
                                <div key={index}>
                                    <div className="flex items-center gap-3">
                                        <div className="text-[#06a57f]">{feature.icon}</div>
                                        <h4 className="font-bold text-white">{feature.title}</h4>
                                    </div>
                                    <p className="mt-2 text-slate-400 text-sm">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Footer Component
const Footer = () => {
    return (
        <footer className="bg-[#0A191E]/50 border-t border-slate-800 px-4 sm:px-8 py-12 relative z-10">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-8">
                <div>
                    <img src={icon} alt="AutopilotX" className="h-20 sm:h-28 w-auto mx-auto md:mx-0"/>
                    <p className="text-slate-500 text-xs mt-2">&copy; {new Date().getFullYear()} AutopilotX - All rights reserved.</p>
                </div>
                <div>
                  <h4 className="font-bold text-[#06a57f] mb-4">Follow Us</h4>
                  <div className="flex items-start justify-center gap-8 text-slate-200">
                      <a href="#" className="flex flex-col items-center gap-2 hover:text-white transition-colors">
                        <YoutubeIcon />
                        <span className="text-xs">YouTube</span>
                      </a>
                      <a href="#" className="flex flex-col items-center gap-2 hover:text-white transition-colors">
                        <InstagramIcon />
                        <span className="text-xs">Instagram</span>
                      </a>
                      <a href="#" className="flex flex-col items-center gap-2 hover:text-white transition-colors">
                        <Send />
                        <span className="text-xs">Telegram</span>
                      </a>
                  </div>
                </div>
            </div>
        </footer>
    );
};


// --- Main App Component ---

export default function App() {
  return (
    <>
      <style>{`
        @keyframes line-anim {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .line-animate {
          animation: line-anim 1s ease-out forwards;
        }
      `}</style>

      <div className="min-h-screen bg-[#0A191E] font-sans antialiased text-white flex items-center justify-center">
        <div className="w-full max-w-screen-2xl mx-auto bg-[#0F2027] shadow-2xl overflow-hidden border border-white/10 relative">
          
          {/* Background Glow Effect */}
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vh] sm:w-[1000px] sm:h-[800px] bg-[#06a57f]/10 blur-[100px] sm:blur-[150px] rounded-full animate-pulse -z-0"></div>

          <div className="relative z-10">
            <Header />
            <main className="flex flex-col gap-20 py-20 md:gap-28 md:py-16">
              <AnimatedSection>
                <HeroSection />
              </AnimatedSection>
              <AnimatedSection>
                <MidBannerSection />
              </AnimatedSection>
              <AnimatedSection>
                <StrategiesSection />
              </AnimatedSection>
              <AnimatedSection>
                <HowItWorksSection />
              </AnimatedSection>
              <AnimatedSection>
                <TrustSection />
              </AnimatedSection>
            </main>
            <Footer />
          </div>
        </div>
      </div>
    </>
  );
}

