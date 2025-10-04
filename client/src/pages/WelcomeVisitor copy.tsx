"use client"
import { Button } from "@/components/ui/button"
import React from "react"
import { Logo } from "@/components/Logo";
import dashboardImage from '../../src/assets/snapshot.png';

interface PerformanceGraphProps {
  showMarker?: boolean
}

const PerformanceGraph: React.FC<PerformanceGraphProps> = ({ showMarker = false }) => {
  return (
    <div className="bg-white p-4 rounded-lg relative w-full h-64">
      <svg
        viewBox="0 0 300 220"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Y-axis labels */}
        <text x="10" y="40" fontSize="12" fill="#666">60.00k</text>
        <text x="10" y="100" fontSize="12" fill="#666">40.00k</text>
        <text x="10" y="160" fontSize="12" fill="#666">20.00k</text>
        <text x="30" y="200" fontSize="12" fill="#666">0</text>

        {/* Y-axis line */}
        <line x1="50" y1="20" x2="50" y2="200" stroke="#e5e7eb" strokeWidth="1" />

        {/* X-axis labels */}
        <text x="70" y="215" fontSize="12" fill="#666">2022</text>
        <text x="170" y="215" fontSize="12" fill="#666">2023</text>
        <text x="260" y="215" fontSize="12" fill="#666">2024</text>

        {/* Gradient definition */}
        <defs>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Area chart path */}
        <path
          d="M 50,200 
             L 80,180 
             L 120,150 
             L 170,60 
             L 200,140 
             L 240,100 
             L 280,130 
             L 280,220 
             L 50,220 Z"
          fill="url(#blueGradient)"
        />

        {/* Line chart path */}
        <path
          d="M 50,200 
             L 80,180 
             L 120,150 
             L 170,60 
             L 200,140 
             L 240,100 
             L 280,130"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
        />

        {/* Marker line (if showMarker is true) */}
        {showMarker && (
          <g>
            <line x1="210" y1="30" x2="210" y2="200" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" />
            <rect x="195" y="15" width="30" height="16" rx="3" fill="#3b82f6" />
            <text x="210" y="27" fontSize="10" fill="white" textAnchor="middle">1 Mar</text>
          </g>
        )}
      </svg>
    </div>
  )
}

export default function WelcomeVisitor() {
  return (
    <div className="bg-white text-black min-h-screen relative overflow-hidden">
      {/* 🔥 Full-page Animated Background */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
              <stop offset="50%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g className="animate-float-1">
            <path d="M-200,100 L800,100 L1000,300 L200,300 Z" fill="none" stroke="url(#lineGradient)" strokeWidth="1" />
            <path d="M-100,200 L900,200 L1100,400 L300,400 Z" fill="none" stroke="url(#lineGradient)" strokeWidth="1" />
          </g>
          <g className="animate-float-2">
            <path d="M-300,50 L700,50 L900,250 L100,250 Z" fill="none" stroke="url(#lineGradient)" strokeWidth="1" />
            <path d="M-150,350 L850,350 L1050,550 L250,550 Z" fill="none" stroke="url(#lineGradient)" strokeWidth="1" />
          </g>
          <g className="animate-float-3">
            <path d="M-250,150 L750,150 L950,350 L150,350 Z" fill="none" stroke="url(#lineGradient)" strokeWidth="1" />
            <path d="M-50,450 L950,450 L1150,650 L350,650 Z" fill="none" stroke="url(#lineGradient)" strokeWidth="1" />
          </g>
        </svg>

        {/* Geometric shapes */}
        <div className="absolute top-20 left-10 w-28 h-28 border border-blue-500 rotate-45 animate-spin-slow opacity-20"></div>
        <div className="absolute bottom-40 right-20 w-20 h-20 border border-blue-500 rotate-12 animate-pulse opacity-30"></div>
        <div className="absolute top-1/2 left-1/4 w-12 h-12 border border-blue-500 rotate-45 animate-bounce-slow opacity-25"></div>
      </div>

      {/* Content Layers */}
      <div className="relative z-10">
        {/* Navigation Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
          <div className="p-2">
            <Logo />
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-gray-700 hover:text-black" onClick={() => window.location.href = "/signin"}>
              Log in
            </Button>
          </div>
        </header>

        {/* Hero Section 1 */}
        <main className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-balance">
              Welcome to 
              <br />
              The Crypto Snipers!
            </h1>
            <p className="text-base md:text-lg text-gray-600 mb-8 max-w-xl mx-auto text-balance">
              View all strategies, monitor your deployments, and connect your exchange securely.
            </p>
            <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 text-base rounded-lg" onClick={() => window.location.href = "/signin"}>
              Get started
            </Button>
          </div>
        </main>

        {/* Dashboard Section */}
        <section className="w-full bg-white flex items-center justify-center mt-[-10px] py-8">
          <div className="w-full h-full max-w-6xl rounded-xl overflow-hidden shadow-lg">
            <img
              src={dashboardImage}
              alt="Dashboard Preview"
              className="w-full h-full object-cover"
            />
          </div>
        </section>

        {/* Hero Section 2 */}
        <section className="relative py-12 bg-white/80 backdrop-blur-sm overflow-hidden flex items-center justify-center">
          <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-black mb-6 leading-snug">
              <span className="block text-balance">Next-Level Crypto Strategies</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 max-w-xl mx-auto leading-relaxed">
              Gain the edge with cutting-edge tools designed to help you trade smarter and achieve more.
            </p>
          </div>
        </section>

        {/* Strategy Cards Section */}
        <section className="py-10 px-4 bg-white/80 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Strategy 1 */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-medium text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
                    ETH
                  </span>
                </div>
                <PerformanceGraph showMarker />
                <h3 className="text-xl font-bold text-gray-900 mb-3 mt-4">BlackBox Strategy 1</h3>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  A fast-paced Ethereum scalping strategy designed to capture quick, short-term profits. 
                  It uses precise indicators and smart execution to exploit small market movements.
                </p>
                <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-black bg-transparent" onClick={() => window.location.href = "/signin"}>
                  Learn more
                </Button>
              </div>

              {/* Strategy 2 */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-medium text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
                    BTC
                  </span>
                </div>
                <PerformanceGraph />
                <h3 className="text-xl font-bold text-gray-900 mb-3 mt-4">BlackBox Strategy 2</h3>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  A dynamic Bitcoin trading strategy built for speed, precision, and consistency. 
                  It focuses on high-probability setups, turning small intraday moves into steady gains.
                </p>
                <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-black bg-transparent" onClick={() => window.location.href = "/signin"}>
                  Learn more
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
