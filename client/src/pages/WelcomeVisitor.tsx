import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Monitor, Smartphone, Tablet, FileText, X, ArrowRight, Book, User, ShieldCheck, Zap, Command, Heart, Link as LinkIcon, CheckCircle, Settings, Code, AlertTriangle, Users, ShieldAlert, Share2, TrendingUp, ArrowLeft, MessageSquare, Search, BarChart2, Bell, GitMerge, Dribbble, Github, CodeSquare } from 'lucide-react';
import Aurora from '../components/ui/aurora';
import Particles from '../components/ui/particles';
import Orb from '../components/ui/orb';
import logo from '../assets/autopilotx_logo.jpg';
import icon from '../assets/logo.png';
import heroimage from '../assets/herobanner.png';
import "../types/herosection.css"; 
import midbanner from '../assets/dashboard.jpeg'


// Header component
const Header = () => (
  <header className="w-full fixed top-0 left-0 z-50 bg-[#0b0f1a]/80 backdrop-blur-md px-6 sm:px-8 py-3 md:py-4">
    <nav className="flex items-center justify-between max-w-7xl mx-auto">
      
      {/* Logo */}
      <div className="flex items-center gap-4 md:gap-6">
        <img
          src={icon}
          alt="AutopilotX Logo"
          className="h-14 sm:h-16 md:h-20 w-auto object-contain"
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 md:gap-4 text-sm">
        <button
          onClick={() => (window.location.href = "/signin")}
          className="hidden sm:inline-block text-slate-300 hover:text-white transition-colors px-2 py-1 md:px-3 md:py-1.5"
        >
          Log in
        </button>
        <button
          onClick={() => (window.location.href = "/signup")}
          className="bg-[#06a57f] hover:bg-[#05b289] text-white px-3 py-1.5 md:px-4 md:py-2 rounded-md transition-colors flex items-center gap-2"
        >
          Sign up
        </button>
      </div>
    </nav>
  </header>
);



const RippleGrid = () => {
  const lines = 7; // 7x7 grid
  return (
    <div className="absolute inset-0 grid-container -z-10 slide-in-right">
      {/* Vertical lines */}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={`v-${i}`}
          className="absolute top-0 bottom-0 w-1 bg-[#06a57f] line-animate"
          style={{ left: `${(i / (lines - 1)) * 100}%` }}
        />
      ))}

      {/* Horizontal lines */}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={`h-${i}`}
          className="absolute left-0 right-0 h-1 bg-[#06a57f] line-animate"
          style={{ top: `${(i / (lines - 1)) * 100}%` }}
        />
      ))}
    </div>
  );
};

const MidBannerSection = () => (
  <section className="relative bg-[#0d0f13] w-full h-[60vh] md:h-[70vh] flex justify-center items-center overflow-hidden mb-20">
    <img
      src={midbanner} // replace with your image import/path
      alt="Mid Banner"
      className="max-w-[95%] max-h-[95%] object-cover rounded-xl"
    />
  </section>
);


const HeroSection = () => (
  <section className="relative flex flex-col md:flex-row items-center justify-between px-8 md:px-16 lg:px-24 bg-[#0b0f1a] min-h-screen z-10 mt-19">
    {/* Left Content */}
    <div className="flex-1 text-left space-y-5 relative z-10 slide-in-left">
      <div>
        <span className="bg-[#06a57f1a] text-[#06a57f] text-sm font-medium px-4 py-2 rounded-full inline-block">
          Future of crypto trading
        </span>
      </div>

      <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
        Fast and Secure <br /> Cryptocurrency Exchange
      </h1>

      <p className="text-base md:text-lg text-slate-400 max-w-md">
        Trade cryptocurrencies with ease, security, and advanced features on our
        cutting-edge platform.
      </p>

      <button
        onClick={() =>
          window.scrollTo({ top: window.innerHeight, behavior: "smooth" })
        }
        className="mt-4 bg-gradient-to-r from-[#06a57f] to-[#05b289] text-white font-medium px-6 py-3 rounded-md transition-transform hover:scale-[1.02]"
      >
        Learn More
      </button>
    </div>

    {/* Right Image with Ripple Grid */}
    <div className="flex-1 flex justify-center mt-10 md:mt-0 relative z-10 slide-in-right">
      <RippleGrid />
      <img
        src={heroimage}
        alt="Crypto Trading Dashboard"
        className="w-full max-w-lg md:max-w-xl object-contain relative z-20"
      />
    </div>
  </section>
);


const strategies = [
  {
    id: 1,
    pair: "BTC/USDT",
    name: "BlackBox Strategy 1",
    description:
      "A dynamic Bitcoin trading strategy built for speed, precision, and consistency.",
    winRate: 67,
    maxDrawdown: 40,
    totalTrades: 968,
  },
  {
    id: 2,
    pair: "ETH/USDT",
    name: "BlackBox Strategy 2",
    description:
      "A fast-paced Ethereum scalping strategy designed to capture quick, short-term profits.",
    winRate: 72,
    maxDrawdown: 32,
    totalTrades: 1045,
  },
];

const PerformanceGraph = ({ showMarker = false }: { showMarker?: boolean }) => (
  <div className="px-3 pt-4 pb-2 rounded-t-2xl relative h-[140px] bg-[#16181D]">
    <svg
      viewBox="0 0 300 200"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
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
            x1="210"
            y1="20"
            x2="210"
            y2="190"
            stroke="#05b288"
            strokeWidth="2"
            strokeDasharray="4"
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

const StrategiesSection = () => (
  <div className="relative min-h-[70vh] bg-[#0d0f13] text-white flex flex-col items-center justify-center px-8 overflow-hidden">
    {/* Background Lines with Glowing Dots */}
    <div className="absolute inset-0 opacity-30 pointer-events-none">
      <svg
        className="w-full h-full"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* === LINE 1 === */}
        <polyline
          points="0,300 200,250 400,280 600,240 800,300 1000,250 1200,280 1400,260 1600,300 1800,270"
          fill="none"
          stroke="#F7931A"
          strokeWidth="2"
        />
        {[0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800].map((x, i) => {
          const yValues = [300, 250, 280, 240, 300, 250, 280, 260, 300, 270];
          return (
            <circle
              key={`dot1-${i}`}
              cx={x}
              cy={yValues[i]}
              r="5"
              fill="#FFD27F"
              style={{ filter: 'drop-shadow(0 0 8px #F7931A)' }}
              className="animate-pulse"
            />
          );
        })}

        {/* === LINE 2 === */}
        <polyline
          points="0,350 200,310 400,330 600,290 800,360 1000,310 1200,340 1400,320 1600,350 1800,315"
          fill="none"
          stroke="#05b288"
          strokeWidth="2"
        />
        {[0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800].map((x, i) => {
          const yValues = [350, 310, 330, 290, 360, 310, 340, 320, 350, 315];
          return (
            <circle
              key={`dot2-${i}`}
              cx={x}
              cy={yValues[i]}
              r="5"
              fill="#4FFFE2"
              style={{ filter: 'drop-shadow(0 0 8px #05b288)' }}
              className="animate-pulse"
            />
          );
        })}

        {/* === LINE 3 === */}
        <polyline
          points="0,400 200,370 400,380 600,350 800,400 1000,370 1200,390 1400,375 1600,395 1800,360"
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2"
        />
        {[0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800].map((x, i) => {
          const yValues = [400, 370, 380, 350, 400, 370, 390, 375, 395, 360];
          return (
            <circle
              key={`dot3-${i}`}
              cx={x}
              cy={yValues[i]}
              r="5"
              fill="#BCA7FF"
              style={{ filter: 'drop-shadow(0 0 8px #8b5cf6)' }}
              className="animate-pulse"
            />
          );
        })}
      </svg>
    </div>

    {/* Heading */}
    <h1 className="text-4xl font-bold mb-10 text-center tracking-tight drop-shadow-lg z-10">
      Proven Strategies at Your Fingertips
    </h1>

    <div className="flex flex-wrap gap-10 justify-center z-10">
      {strategies.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl shadow-lg overflow-hidden border border-[#05b288] w-[400px] bg-[#16181D]/90 backdrop-blur-sm hover:scale-[1.03] transition-transform duration-300"
        >
          <PerformanceGraph showMarker={item.id === 2} />

          <div className="p-6 rounded-b-2xl bg-[#1e2129]/90">
            <span className="inline-block px-3 py-1 text-sm rounded-full bg-[#05b288]/20 text-[#05b288] mb-2">
              {item.pair}
            </span>

            <h2 className="text-xl font-semibold text-white mb-2">
              {item.name}
            </h2>

            <p className="text-sm text-gray-300 mb-4">{item.description}</p>

            {/* Win Rate Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs font-medium mb-1 text-gray-400">
                <span>Win Rate</span>
                <span className="text-white">{item.winRate}%</span>
              </div>
              <div className="w-full h-2 bg-gray-700 rounded-full">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-[#06a57f] via-[#05b289] to-[#05b288]"
                  style={{ width: `${item.winRate}%` }}
                ></div>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-gray-400">Max Drawdown</span>
                <span className="text-white">{item.maxDrawdown}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Trades</span>
                <span className="text-white">{item.totalTrades}</span>
              </div>
            </div>

            <button className="w-full py-2.5 text-sm rounded-full font-semibold text-[#05b289] border border-[#05b289] hover:bg-[#05b289] hover:text-white transition">
              Learn More
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export { HeroSection, StrategiesSection };













// Optimized Security Section
const OptimizedSecuritySection = () => {
  const tags = [
    { name: 'Transactions', style: { top: '10%', left: '20%', transform: 'rotate(-15deg)' } },
    { name: 'Bot Detection', style: { top: '20%', right: '15%', transform: 'rotate(10deg)' } },
    { name: 'Convenience', style: { top: '5%', right: '5%', transform: 'rotate(5deg)' } },
    { name: 'Anonymous User', style: { top: '35%', left: '25%', transform: 'rotate(8deg)' } },
    { name: 'Registration', style: { top: '45%', right: '28%', transform: 'rotate(-5deg)' } },
    { name: 'Universal Login', style: { bottom: '30%', left: '30%', transform: 'rotate(-10deg)' } },
    { name: 'Social Integrations', style: { bottom: '25%', right: '15%', transform: 'rotate(12deg)' } },
    { name: 'Privacy & Security', style: { bottom: '10%', left: '10%', transform: 'rotate(15deg)' } },
    { name: 'Directory', style: { bottom: '15%', left: '45%', transform: 'rotate(5deg)' } },
    { name: 'Progressive Profiling', style: { bottom: '5%', right: '25%', transform: 'rotate(-8deg)' } },
  ];

  return (
    <div className="py-20 md:py-32 px-4 relative z-10 text-center">
      <h2 className="text-4xl md:text-5xl font-bold text-white">Transparent. Powerful.</h2>
      <p className="mt-6 text-lg text-slate-400 max-w-3xl mx-auto">
        We believe in full transparency. Dive deep into the historical performance of every strategy. Analyze metrics, understand the logic, and trade with confidence.
      </p>
      <div className="mt-16 max-w-6xl mx-auto bg-slate-900/50 border border-slate-800 rounded-2xl p-8 md:p-12 relative overflow-hidden">
        <div className="absolute -inset-20 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.2)_0%,rgba(168,85,247,0)_60%)]"></div>
        <div className="grid md:grid-cols-2 gap-12 items-center relative">
          <div className="text-left">
            <h3 className="text-2xl font-bold text-white">Optimized for Performance</h3>
            <p className="mt-4 text-slate-400">
              Optimized for Performance
              Our infrastructure is built for speed and reliability, ensuring your trades execute at the right price, every time. Minimize slippage and maximize your returns.
            </p>
            <button className="mt-8 text-purple-400 font-medium flex items-center gap-2 hover:text-purple-300 transition-colors">
              Learn more <ArrowRight size={16} />
            </button>
          </div>
          <div className="relative h-64 md:h-80">
            {/* Central Icon */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-white rounded-xl flex items-center justify-center border border-slate-700">
              {/* <Command className="text-white w-10 h-10" /> */}
              <img src={icon} alt="Icon" className="w-10 h-10" />
            </div>
            {/* Floating Tags */}
            {tags.map(tag => (
              <div key={tag.name} className="absolute" style={tag.style}>
                <span className="text-xs text-white bg-purple-600/80 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
                  {tag.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Features Section
const FeaturesSection = () => {
  const features = [
    { icon: <Heart size={20} />, title: "Filters", description: "Login box must find the right balance for the user convenience, privacy and security." },
    { icon: <LinkIcon size={20} />, title: "Configurable", description: "Login box must find the right balance for the user convenience, privacy and security." },
    { icon: <CheckCircle size={20} />, title: "Authorization", description: "Login box must find the right balance for the user convenience, privacy and security." },
    { icon: <Settings size={20} />, title: "Management", description: "Login box must find the right balance for the user convenience, privacy and security." },
    { icon: <Code size={20} />, title: "Building", description: "Login box must find the right balance for the user convenience, privacy and security." },
  ];

  return (
    <div className="py-20 md:py-24 px-4 relative z-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Extensibility Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-white">Extensibility</h3>
            <p className="mt-2 text-slate-400">Your login box must find the right balance between user convenience, privacy and security.</p>
            <div className="mt-8 h-48 relative flex items-center justify-center">
              {/* Graph SVG */}
              <svg width="100%" height="100%" viewBox="0 0 300 120" preserveAspectRatio="none" className="absolute inset-0">
                <path d="M0 80 Q 50 20, 100 70 T 200 50 T 300 100" stroke="rgba(168, 85, 247, 0.5)" fill="none" strokeWidth="2" />
                <path d="M0 80 Q 50 20, 100 70 T 200 50" stroke="#A855F7" fill="none" strokeWidth="2" />
                <circle cx="100" cy="70" r="4" fill="#A855F7" />
                <circle cx="200" cy="50" r="4" fill="#A855F7" />
                <circle cx="300" cy="100" r="4" fill="rgba(168, 85, 247, 0.5)" />
              </svg>
              {/* Alert Box */}
              <div className="absolute" style={{ top: '20%', left: '45%' }}>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs flex items-center gap-2 shadow-lg">
                  <AlertTriangle className="text-red-500" size={14} />
                  <span className="text-slate-300">Alert</span>
                  <p className="text-slate-400">The login page has mobile issues.</p>
                </div>
              </div>
              {/* Pointer */}
              <svg className="absolute w-6 h-6 text-white" style={{ top: '45%', left: '68%' }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.223 21.32L9.5 16l-4.1-1.64.823-5.68L19.5 2 4.223 21.32z" />
              </svg>
            </div>
          </div>

          {/* Infinite Options Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 flex flex-col">
            <h3 className="text-xl font-bold text-white">Infinite options</h3>
            <p className="mt-2 text-slate-400">Quickly apply filters to refine your issues lists and create custom views.</p>
            <div className="flex-grow flex items-center justify-center mt-8">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-full border-2 border-slate-800 animate-pulse"></div>
                <div className="absolute inset-2 rounded-full border-2 border-slate-800 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="absolute inset-4 rounded-full border-2 border-slate-800 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                <div className="absolute inset-8 bg-slate-800 rounded-full flex items-center justify-center">
                  <span className="text-white">Autopilotx</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 mt-16">
          {features.map((feature, index) => (
            <div key={index}>
              <div className="flex items-center gap-3">
                <div className="text-purple-400">{feature.icon}</div>
                <h4 className="font-bold text-white">{feature.title}</h4>
              </div>
              <p className="mt-2 text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Issues Section
const IssuesSection = () => {
  const issues = [
    { icon: <Users size={24} />, title: "Anonymous User", description: "Incorporate rich user profiling, and facilitate more transactions." },
    { icon: <ShieldAlert size={24} />, title: "Bot Detection", description: "Incorporate rich user profiling, and facilitate more transactions." },
    { icon: <Share2 size={24} />, title: "Social integrations", description: "Incorporate rich user profiling, and facilitate more transactions." },
    { icon: <TrendingUp size={24} />, title: "Progressive Profiling", description: "Incorporate rich user profiling, and facilitate more transactions." },
    { icon: <Users size={24} />, title: "Anonymous User 2", description: "Incorporate rich user profiling, and facilitate more transactions." },
    { icon: <ShieldAlert size={24} />, title: "Bot Detection 2", description: "Incorporate rich user profiling, and facilitate more transactions." },
  ];

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtStart, setIsAtStart] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(false);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setIsAtStart(scrollLeft < 10);
      setIsAtEnd(scrollLeft + clientWidth >= scrollWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll();
      const resizeObserver = new ResizeObserver(handleScroll);
      resizeObserver.observe(container);
      return () => {
        container.removeEventListener('scroll', handleScroll);
        resizeObserver.unobserve(container);
      };
    }
  }, []);

  return (
    <div className="py-20 md:py-32 px-4 relative z-10 text-center">
      <p className="text-purple-400 font-semibold mb-3">The security first platform</p>
      <h2 className="text-4xl md:text-5xl font-bold text-white">Spot issues faster</h2>
      <p className="mt-6 text-lg text-slate-400 max-w-3xl mx-auto">
        All the lorem ipsum generators on the Internet tend to repeat predefined chunks as necessary, making this the first true generator on the Internet.
      </p>
      <div className="mt-16 max-w-6xl mx-auto relative">
        <div ref={scrollContainerRef} className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide space-x-8 pb-8 -mx-4 px-4">
          {issues.map((issue, index) => (
            <div key={index} className="snap-start shrink-0 w-[calc(80%)] sm:w-[calc(45%)] md:w-[calc(30%)] lg:w-[calc(23%)]">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-full flex flex-col relative overflow-hidden text-left">
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[radial-gradient(ellipse_at_bottom,_rgba(168,85,247,0.25)_0%,rgba(168,85,247,0)_70%)]"></div>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 border border-slate-700 mb-6">
                  <div className="text-purple-400">{issue.icon}</div>
                </div>
                <h3 className="text-lg font-bold text-white">{issue.title}</h3>
                <p className="mt-2 text-slate-400 text-sm flex-grow">{issue.description}</p>
                <button className="mt-6 text-purple-400 text-sm font-medium flex items-center gap-2 hover:text-purple-300 transition-colors self-start">
                  Learn more <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-4 mt-4 pr-4 md:pr-0">
          <button onClick={() => scroll('left')} disabled={isAtStart} className="w-9 h-9 rounded-full border border-slate-700 hover:bg-slate-800 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <ArrowLeft size={16} />
          </button>
          <button onClick={() => scroll('right')} disabled={isAtEnd} className="w-9 h-9 rounded-full border border-slate-700 hover:bg-slate-800 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Trust Section
const TrustSection = () => {
  const apiFeatures = [
    { icon: <MessageSquare size={20} />, title: "Discussions", description: "Login box must find the right balance for the user convenience, privacy and security." },
    { icon: <Users size={20} />, title: "Team views", description: "Login box must find the right balance for the user convenience, privacy and security." },
    { icon: <Search size={20} />, title: "Powerful search", description: "Login box must find the right balance for the user convenience, privacy and security." },
  ];

  const userManagementFeatures = [
    { icon: <BarChart2 size={20} />, title: "Analytics", description: "Login box must find the right balance for the user convenience, privacy and security." },
    { icon: <Bell size={20} />, title: "Notifications", description: "Login box must find the right balance for the user convenience, privacy and security." },
    { icon: <GitMerge size={20} />, title: "Integrations", description: "Login box must find the right balance for the user convenience, privacy and security." },
  ];

  return (
    <div className="py-20 md:py-32 px-4 relative z-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div className="relative">
            <div className="absolute -left-16 -top-16 w-72 h-72 bg-purple-600/20 blur-3xl"></div>
            <h2 className="text-4xl md:text-5xl font-bold text-white relative">Why trust us?</h2>
            <p className="mt-6 text-lg text-slate-400 relative">
              Many desktop publishing packages and web page editors now use lorem ipsum as their default model text, and a search will uncover many web sites still in their infancy.
            </p>
          </div>
          <div>
            {/* API Authorization */}
            <div>
              <p className="text-purple-400 font-semibold mb-8">API Authorization</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-12">
                {apiFeatures.map((feature, index) => (
                  <div key={index}>
                    <div className="flex items-center gap-3">
                      <div className="text-purple-400">{feature.icon}</div>
                      <h4 className="font-bold text-white">{feature.title}</h4>
                    </div>
                    <p className="mt-2 text-slate-400 text-sm">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* User Management */}
            <div className="mt-16">
              <p className="text-purple-400 font-semibold mb-8">User Management</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-12">
                {userManagementFeatures.map((feature, index) => (
                  <div key={index}>
                    <div className="flex items-center gap-3">
                      <div className="text-purple-400">{feature.icon}</div>
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
    </div>
  );
};

// Footer Component
const Footer = () => {
  const footerLinks = {
    Products: ["Features", "Integrations", "Pricing & Plans", "Changelog", "Our method"],
    Company: ["About us", "Diversity & Inclusion", "Blog", "Careers", "Financial statements"],
    Resources: ["Community", "Terms of service", "Report a vulnerability", "Brand Kit"],
    Legals: ["Refund policy", "Terms & Conditions", "Privacy policy"],
  };

  return (
    <footer className="bg-slate-950/50 border-t border-slate-800 px-8 py-16 relative z-10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-8">
        <div className="md:col-span-6 lg:col-span-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-bold text-lg text-white">Autopilotx</span>
          </div>
          <p className="text-slate-400 text-sm mb-6">&copy; Autopilotx - All rights reserved.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <a href="#" className="hover:text-white transition-colors"><X size={18} /></a>
            <a href="#" className="hover:text-white transition-colors"><Dribbble size={18} /></a>
            <a href="#" className="hover:text-white transition-colors"><Github size={18} /></a>
          </div>
        </div>

        <div className="md:col-span-2 lg:col-span-2">
          <h4 className="font-bold text-white mb-4">Products</h4>
          <ul className="space-y-3">
            {footerLinks.Products.map(link => (
              <li key={link}><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{link}</a></li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2 lg:col-span-2">
          <h4 className="font-bold text-white mb-4">Company</h4>
          <ul className="space-y-3">
            {footerLinks.Company.map(link => (
              <li key={link}><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{link}</a></li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2 lg:col-span-2">
          <h4 className="font-bold text-white mb-4">Resources</h4>
          <ul className="space-y-3">
            {footerLinks.Resources.map(link => (
              <li key={link}><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{link}</a></li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2 lg:col-span-2">
          <h4 className="font-bold text-white mb-4">Legals</h4>
          <ul className="space-y-3">
            {footerLinks.Legals.map(link => (
              <li key={link}><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{link}</a></li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
};


// Main App component
export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 font-sans antialiased text-white flex items-center justify-center">
      <div className="w-full max-w-screen-2xl mx-auto bg-slate-950/80 rounded-xl shadow-2xl overflow-hidden border border-white/10 relative">
        {/* Background Glow Effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-[800px] h-[600px] bg-purple-700/30 blur-[150px] rounded-full animate-pulse"></div>
        </div>

        {/* Sparkles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-sparkle"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${Math.random() * 2 + 1}s`
              }}
            ></div>
          ))}
        </div>

        {/* Particles Background */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <Particles
            particleColors={['#ffffff', '#ffffff']}
            particleCount={200}
            particleSpread={10}
            speed={0.1}
            particleBaseSize={100}
            moveParticlesOnHover={true}
            alphaParticles={false}
            disableRotation={false}
          />
        </div>


        <div className="relative z-10">
          <div className="border-t border-slate-800">
            <Header />
            <main>
              <HeroSection />
              <MidBannerSection />
              <StrategiesSection />
              <OptimizedSecuritySection />
              <FeaturesSection />
              <IssuesSection />
              <TrustSection />
            </main>
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}