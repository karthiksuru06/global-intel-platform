import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

const INITIAL_STOCKS = [
    { symbol: "SENSEX", price: 73128.45, change: 0.85 },
    { symbol: "NIFTY 50", price: 22153.20, change: 0.92 },
    { symbol: "S&P 500", price: 5123.41, change: 0.45 },
    { symbol: "NASDAQ", price: 16274.94, change: -0.12 },
    { symbol: "GOLD", price: 2164.20, change: 1.15 },
    { symbol: "BRENT OIL", price: 82.14, change: -0.65 },
    { symbol: "BTC/USD", price: 67241.50, change: 2.45 },
    { symbol: "EUR/USD", price: 1.0845, change: -0.05 },
];

export default function StockTicker() {
    const [stocks, setStocks] = useState(INITIAL_STOCKS);

    useEffect(() => {
        const interval = setInterval(() => {
            setStocks((prev) =>
                prev.map((s) => ({
                    ...s,
                    price: +(s.price * (1 + (Math.random() - 0.5) * 0.001)).toFixed(2),
                    change: +(s.change + (Math.random() - 0.5) * 0.05).toFixed(2),
                }))
            );
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full bg-black/40 border-t border-intel-cyan/20 h-6 flex items-center overflow-hidden font-mono z-50">
            <div className="flex items-center gap-2 px-3 border-r border-intel-cyan/30 bg-intel-cyan/5 h-full">
                <Activity className="w-3 h-3 text-intel-cyan animate-pulse" />
                <span className="text-[9px] text-intel-cyan font-bold tracking-tighter uppercase">Market Ticker</span>
            </div>
            <div className="flex flex-1 overflow-hidden">
                <div className="flex animate-scroll whitespace-nowrap py-1">
                    {[...stocks, ...stocks].map((stock, i) => {
                        const isUp = stock.change >= 0;
                        return (
                            <div key={i} className="flex items-center gap-2 px-6 border-r border-white/5">
                                <span className="text-[10px] text-intel-muted">{stock.symbol}</span>
                                <span className="text-[10px] text-intel-text tabular-nums">{stock.price}</span>
                                <div className={`flex items-center gap-0.5 text-[9px] ${isUp ? "text-intel-green" : "text-intel-red"}`}>
                                    {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                    {isUp ? "+" : ""}{stock.change}%
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="px-3 text-[9px] text-intel-muted/50 border-l border-white/10 uppercase">
                Live Feed: Bloomberg Terminal
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 40s linear infinite;
        }
      `}} />
        </div>
    );
}
