import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Monitor, Smartphone, Tablet, FileText, X, ArrowRight, Book, User, ShieldCheck, Zap, Command, Heart, Link as LinkIcon, CheckCircle, Settings, Code, AlertTriangle, Users, ShieldAlert, Share2, TrendingUp, ArrowLeft, MessageSquare, Search, BarChart2, Bell, GitMerge, Dribbble, Github, CodeSquare } from 'lucide-react';
import Aurora from '../components/ui/aurora';
import Particles from '../components/ui/particles';
import Orb from '../components/ui/orb';
import logo from '../assets/autopilotx_logo.jpg';
import icon from '../assets/autopilotx_icon.jpg'


// Header component
const Header = () => (
  <header className="px-8 py-4">
    <nav className="flex items-center justify-between text-white">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">Autopilotx</span>
        </div>
        {/* <div className="hidden md:flex items-center gap-6 text-sm text-slate-300">
          <a href="#" className="hover:text-white transition-colors">About</a>
          <a href="#" className="hover:text-white transition-colors">Integrations</a>
          <a href="#" className="hover:text-white transition-colors">Pricing</a>
          <a href="#" className="hover:text-white transition-colors">Customers</a>
          <a href="#" className="hover:text-white transition-colors">Changelog</a>
        </div> */}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <button
          onClick={() => window.location.href = "/signin"}
          className="hidden sm:block text-slate-300 hover:text-white transition-colors">Log in</button>
        <button
          onClick={() => window.location.href = "/signup"}
          className="bg-slate-800/80 hover:bg-slate-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2">
          Sign up
        </button>
      </div>
    </nav>
  </header>
);

// Hero section component
const HeroSection = () => (
  <div className="flex flex-col items-center justify-center text-center py-20 md:py-32 px-4 relative z-10">
    <div className="mb-6">
      <span className="bg-purple-600/20 border border-purple-400/30 text-purple-300 text-xs font-medium px-4 py-1.5 rounded-full">
        Welcome to the Future of Trading
      </span>
    </div>
    <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight max-w-3xl">
      Unlock Your Trading Potential with Automated Strategies
    </h1>
    <p className="mt-6 text-lg text-slate-400 max-w-2xl">
      Leverage our pre-built, backtested trading strategies to navigate the markets on autopilot. No coding, no guesswork, just results.
    </p>
    <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
      <button
        onClick={() => window.location.href = "/signin"}
        className="bg-white text-slate-900 hover:bg-slate-200 font-medium px-6 py-3 rounded-md transition-colors w-full sm:w-auto flex items-center justify-center gap-2">
        Get Started
      </button>
      <button className="bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium px-6 py-3 rounded-md transition-colors w-full sm:w-auto flex items-center justify-center gap-2">
        <Book size={16} />
        Read the docs
      </button>
    </div>
  </div>
);

// Security Section Component
const SecuritySection = () => {
  const features = [
    {
      icon: <FileText size={20} />,
      title: 'Momentum Trading',
      active: true,
    },
    {
      icon: <User size={20} />,
      title: 'Customer identity',
      active: false,
    },
    {
      icon: <ShieldCheck size={20} />,
      title: 'Adaptable authentication',
      active: false,
    },
  ];

  return (
    <div className="py-20 md:py-32 px-4 relative z-10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left Content */}
        <div className="text-left">
          <p className="text-purple-400 font-semibold mb-3">PROVEN STRATEGIES AT YOUR FINGERTIPS</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Deploy Strategies in Minutes
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Choose from a diverse library of strategies built by expert quants. From scalping to swing trading, find the perfect fit for your risk appetite and goals.
          </p>
          <div className="space-y-4">
            {features.map((feature, index) => (
              <button
                key={index}
                className={`w-full text-left p-4 rounded-lg border transition-all duration-300 flex items-center gap-4 ${feature.active
                  ? 'bg-slate-800/50 border-purple-600 shadow-lg'
                  : 'border-slate-800 hover:bg-slate-800/30'
                  }`}
              >
                <div className={`text-purple-400 ${!feature.active && 'opacity-60'}`}>{feature.icon}</div>
                <span className={`font-medium ${feature.active ? 'text-white' : 'text-slate-400'}`}>
                  {feature.title}
                </span>
              </button>
            ))}
          </div>
        </div>
        {/* Right Visual */}
        <div className="relative flex items-center justify-center h-80">
          {/* Grid Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#2d3748_1px,transparent_1px)] [background-size:2rem_2rem]"></div>
          <div style={{ width: '100%', height: '500px', position: 'relative' }}>
            <Orb
              hoverIntensity={0.5}
              rotateOnHover={true}
              hue={0}
              forceHoverState={false}
            >
              {/* Central Icon */}
              <div>
                <img src={logo} alt="Logo" className="w-24 h-24 rounded-2xl border border-slate-300 shadow-xl shadow-gray-200" />
              </div>
            </Orb>
          </div>
          {/* Glow */}
          <div className="absolute w-96 h-96 bg-purple-900/40 rounded-full blur-3xl"></div>

        </div>
      </div>
    </div>
  );
};

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
              <SecuritySection />
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