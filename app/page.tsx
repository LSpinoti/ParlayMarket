'use client';

import Link from 'next/link';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function Home() {
  return (
    <div className="min-h-[80vh]">
      {/* Available Parlays Section */}
      <div className="max-w-7xl mx-auto mb-16">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-4xl font-bold">Available Parlays</h2>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-8">
          {['all', 'created', 'filled', 'resolved'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner size="lg" />
        ) : filteredParlays.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold mb-2">No Parlays Found</h3>
            <p className="text-gray-400">
              {filter === 'all' 
                ? 'Be the first to create a parlay!'
                : `No ${filter} parlays at the moment.`
              }
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredParlays.map((parlay) => (
              <ParlayCard key={parlay.id} parlay={parlay} />
            ))}
          </div>
        )}
      </div>

      <div className="text-center max-w-4xl mx-auto mb-12">
        <h1 className="text-6xl font-bold mb-6">
          Welcome to <span className="text-blue-500">ParlayMarket</span>
        </h1>
        
        <p className="text-xl text-gray-400 mb-12 leading-relaxed">
          The first fully collateralized parlay marketplace on <span className="text-orange-500 font-semibold">Flare Network</span>.
          Create multi-leg parlays, trade positions as tokens, and settle using Polymarket's API resolution data.
        </p>

        <div className="min-h-screen bg-black relative overflow-hidden" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)', width: '100vw' }}>
      {/* Spotlight effect */}
      <div className="absolute inset-0">
        {/* Main spotlight cone */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px]"
          style={{
            background: 'conic-gradient(from 180deg at 50% 0%, transparent 120deg, rgba(255,255,255,0.03) 180deg, transparent 240deg)',
          }}
        />
        {/* Subtle glow */}
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-30"
          style={{
            background: 'radial-gradient(ellipse at center top, rgba(255,255,255,0.1) 0%, transparent 70%)',
          }}
        />
      </div>
        </div>

      {/* Vertical lines background */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute inset-0 flex justify-center gap-8">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="w-px h-full bg-gradient-to-b from-transparent via-gray-700 to-transparent" />
          ))}
        </div>
      </div>

      {/* Dynamic side gradient lines with glow */}
      <style jsx>{`
        @keyframes slideDown {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes slideUp {
          0% { transform: translateY(100%); }
          100% { transform: translateY(-100%); }
        }
        @keyframes glow {
          0%, 100% { opacity: 0.3; box-shadow: 0 0 4px rgba(255,255,255,0.3); }
          50% { opacity: 1; box-shadow: 0 0 12px rgba(255,255,255,0.8); }
        }
      `}</style>
      <div className="absolute left-0 top-0 bottom-0 w-[50%] pointer-events-none overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/50 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.6)]" style={{ animation: 'glow 2s ease-in-out infinite' }} />
        <div className="absolute left-[2%] top-[3%] bottom-[3%] w-px bg-gradient-to-b from-transparent via-white/45 to-transparent shadow-[0_0_8px_rgba(255,255,255,0.5)]" style={{ animation: 'glow 2.5s ease-in-out infinite 0.2s' }} />
        <div className="absolute left-[4%] top-[6%] bottom-[6%] w-px bg-gradient-to-b from-transparent via-white/40 to-transparent shadow-[0_0_7px_rgba(255,255,255,0.45)]" style={{ animation: 'glow 3s ease-in-out infinite 0.4s' }} />
        <div className="absolute left-[6%] top-[9%] bottom-[9%] w-px bg-gradient-to-b from-transparent via-white/35 to-transparent shadow-[0_0_6px_rgba(255,255,255,0.4)]" style={{ animation: 'glow 2.2s ease-in-out infinite 0.6s' }} />
        <div className="absolute left-[8%] top-[12%] bottom-[12%] w-px bg-gradient-to-b from-transparent via-white/30 to-transparent shadow-[0_0_5px_rgba(255,255,255,0.35)]" style={{ animation: 'glow 2.8s ease-in-out infinite 0.8s' }} />
        <div className="absolute left-[10%] top-[15%] bottom-[15%] w-px bg-gradient-to-b from-transparent via-white/25 to-transparent shadow-[0_0_4px_rgba(255,255,255,0.3)]" style={{ animation: 'glow 3.2s ease-in-out infinite 1s' }} />
        <div className="absolute left-[12%] top-[18%] bottom-[18%] w-px bg-gradient-to-b from-transparent via-white/22 to-transparent shadow-[0_0_4px_rgba(255,255,255,0.27)]" style={{ animation: 'glow 2.4s ease-in-out infinite 1.2s' }} />
        <div className="absolute left-[14%] top-[21%] bottom-[21%] w-px bg-gradient-to-b from-transparent via-white/20 to-transparent shadow-[0_0_3px_rgba(255,255,255,0.25)]" style={{ animation: 'glow 2.6s ease-in-out infinite 1.4s' }} />
        <div className="absolute left-[16%] top-[24%] bottom-[24%] w-px bg-gradient-to-b from-transparent via-white/18 to-transparent shadow-[0_0_3px_rgba(255,255,255,0.22)]" style={{ animation: 'glow 2.9s ease-in-out infinite 1.6s' }} />
        <div className="absolute left-[18%] top-[27%] bottom-[27%] w-px bg-gradient-to-b from-transparent via-white/15 to-transparent shadow-[0_0_2px_rgba(255,255,255,0.2)]" style={{ animation: 'glow 3.1s ease-in-out infinite 1.8s' }} />
        <div className="absolute left-[20%] top-[30%] bottom-[30%] w-px bg-gradient-to-b from-transparent via-white/12 to-transparent shadow-[0_0_2px_rgba(255,255,255,0.15)]" style={{ animation: 'glow 2.7s ease-in-out infinite 2s' }} />
        <div className="absolute left-[22%] top-[33%] bottom-[33%] w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" style={{ animation: 'glow 3.3s ease-in-out infinite 2.2s' }} />
        <div className="absolute left-[24%] top-[36%] bottom-[36%] w-px bg-gradient-to-b from-transparent via-white/8 to-transparent" style={{ animation: 'glow 2.5s ease-in-out infinite 2.4s' }} />
        <div className="absolute left-[26%] top-[39%] bottom-[39%] w-px bg-gradient-to-b from-transparent via-white/6 to-transparent" style={{ animation: 'glow 2.8s ease-in-out infinite 2.6s' }} />
        <div className="absolute left-[28%] top-[42%] bottom-[42%] w-px bg-gradient-to-b from-transparent via-white/5 to-transparent" style={{ animation: 'glow 3s ease-in-out infinite 2.8s' }} />
        <div className="absolute left-[30%] top-[44%] bottom-[44%] w-px bg-gradient-to-b from-transparent via-white/4 to-transparent" style={{ animation: 'glow 2.6s ease-in-out infinite 3s' }} />
        <div className="absolute left-[32%] top-[46%] bottom-[46%] w-px bg-gradient-to-b from-transparent via-white/3 to-transparent" style={{ animation: 'glow 3.2s ease-in-out infinite 3.2s' }} />
        <div className="absolute left-[34%] top-[47%] bottom-[47%] w-px bg-gradient-to-b from-transparent via-white/2 to-transparent" style={{ animation: 'glow 2.9s ease-in-out infinite 3.4s' }} />
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-[50%] pointer-events-none overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/50 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.6)]" style={{ animation: 'glow 2.3s ease-in-out infinite 0.1s' }} />
        <div className="absolute right-[2%] top-[3%] bottom-[3%] w-px bg-gradient-to-b from-transparent via-white/45 to-transparent shadow-[0_0_8px_rgba(255,255,255,0.5)]" style={{ animation: 'glow 2.7s ease-in-out infinite 0.3s' }} />
        <div className="absolute right-[4%] top-[6%] bottom-[6%] w-px bg-gradient-to-b from-transparent via-white/40 to-transparent shadow-[0_0_7px_rgba(255,255,255,0.45)]" style={{ animation: 'glow 2.1s ease-in-out infinite 0.5s' }} />
        <div className="absolute right-[6%] top-[9%] bottom-[9%] w-px bg-gradient-to-b from-transparent via-white/35 to-transparent shadow-[0_0_6px_rgba(255,255,255,0.4)]" style={{ animation: 'glow 2.9s ease-in-out infinite 0.7s' }} />
        <div className="absolute right-[8%] top-[12%] bottom-[12%] w-px bg-gradient-to-b from-transparent via-white/30 to-transparent shadow-[0_0_5px_rgba(255,255,255,0.35)]" style={{ animation: 'glow 2.4s ease-in-out infinite 0.9s' }} />
        <div className="absolute right-[10%] top-[15%] bottom-[15%] w-px bg-gradient-to-b from-transparent via-white/25 to-transparent shadow-[0_0_4px_rgba(255,255,255,0.3)]" style={{ animation: 'glow 3.1s ease-in-out infinite 1.1s' }} />
        <div className="absolute right-[12%] top-[18%] bottom-[18%] w-px bg-gradient-to-b from-transparent via-white/22 to-transparent shadow-[0_0_4px_rgba(255,255,255,0.27)]" style={{ animation: 'glow 2.3s ease-in-out infinite 1.3s' }} />
        <div className="absolute right-[14%] top-[21%] bottom-[21%] w-px bg-gradient-to-b from-transparent via-white/20 to-transparent shadow-[0_0_3px_rgba(255,255,255,0.25)]" style={{ animation: 'glow 2.5s ease-in-out infinite 1.5s' }} />
        <div className="absolute right-[16%] top-[24%] bottom-[24%] w-px bg-gradient-to-b from-transparent via-white/18 to-transparent shadow-[0_0_3px_rgba(255,255,255,0.22)]" style={{ animation: 'glow 3s ease-in-out infinite 1.7s' }} />
        <div className="absolute right-[18%] top-[27%] bottom-[27%] w-px bg-gradient-to-b from-transparent via-white/15 to-transparent shadow-[0_0_2px_rgba(255,255,255,0.2)]" style={{ animation: 'glow 2.8s ease-in-out infinite 1.9s' }} />
        <div className="absolute right-[20%] top-[30%] bottom-[30%] w-px bg-gradient-to-b from-transparent via-white/12 to-transparent shadow-[0_0_2px_rgba(255,255,255,0.15)]" style={{ animation: 'glow 3.2s ease-in-out infinite 2.1s' }} />
        <div className="absolute right-[22%] top-[33%] bottom-[33%] w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" style={{ animation: 'glow 2.6s ease-in-out infinite 2.3s' }} />
        <div className="absolute right-[24%] top-[36%] bottom-[36%] w-px bg-gradient-to-b from-transparent via-white/8 to-transparent" style={{ animation: 'glow 2.9s ease-in-out infinite 2.5s' }} />
        <div className="absolute right-[26%] top-[39%] bottom-[39%] w-px bg-gradient-to-b from-transparent via-white/6 to-transparent" style={{ animation: 'glow 3.1s ease-in-out infinite 2.7s' }} />
        <div className="absolute right-[28%] top-[42%] bottom-[42%] w-px bg-gradient-to-b from-transparent via-white/5 to-transparent" style={{ animation: 'glow 2.7s ease-in-out infinite 2.9s' }} />
        <div className="absolute right-[30%] top-[44%] bottom-[44%] w-px bg-gradient-to-b from-transparent via-white/4 to-transparent" style={{ animation: 'glow 3.3s ease-in-out infinite 3.1s' }} />
        <div className="absolute right-[32%] top-[46%] bottom-[46%] w-px bg-gradient-to-b from-transparent via-white/3 to-transparent" style={{ animation: 'glow 2.5s ease-in-out infinite 3.3s' }} />
        <div className="absolute right-[34%] top-[47%] bottom-[47%] w-px bg-gradient-to-b from-transparent via-white/2 to-transparent" style={{ animation: 'glow 3s ease-in-out infinite 3.5s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center min-h-screen px-4 pt-32">
        {/* Main heading */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-light text-center mb-4 tracking-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
            Where Prediction Markets
          </span>
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">
            Meet True Parlays
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-gray-400 text-center max-w-xl mb-6 text-sm">
          The Future Of Prediction Markets With ParlayMarket Today.
        </p>

      </div>

      {/* Lottie Animation - behind everything except background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-80 z-0">
        <div className="w-full max-w-3xl transform rotate-90">
          <DotLottieReact
            src="https://lottie.host/bba9c817-7818-4830-b7b1-343c068425b2/mtplIxOJfh.lottie"
            autoplay
          />
        </div>
      </div>
    </div>
  );
}
