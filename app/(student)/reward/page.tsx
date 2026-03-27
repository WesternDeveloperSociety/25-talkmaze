"use client"
import React from 'react';

// --- Icon Components (Replaces lucide-react) ---

const CompassIcon = ({ size = 24, color = "currentColor", fill = "none", strokeWidth = 2, style = {} }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

const SearchIcon = ({ size = 24, color = "currentColor", fill = "none", strokeWidth = 2, style = {} }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const StarIcon = ({ size = 24, color = "currentColor", fill = "none", strokeWidth = 2, style = {} }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ArrowIcon = ({ size = 24, color = "currentColor", fill = "none", strokeWidth = 2, style = {} }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
);

const MapIcon = ({ size = 24, color = "currentColor", fill = "none", strokeWidth = 2, style = {} }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

const ShellIcon = ({ size = 24, color = "currentColor", fill = "none", strokeWidth = 2, style = {} }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M19 12.77c0-5-5.33-9-9.5-2.27A10 10 0 0 0 2 20h20a10 10 0 0 0-3-7.23z" />
    <path d="M12 10.5V20" />
    <path d="M16 11.5V20" />
    <path d="M8 11.5V20" />
  </svg>
);

// Custom Pineapple Icon
const PineappleIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C13 5 15 7 15 7" stroke="#2BA52E" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 2C11 5 9 7 9 7" stroke="#2BA52E" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 2V7" stroke="#2BA52E" strokeWidth="2" strokeLinecap="round"/>
    <rect x="7" y="7" width="10" height="13" rx="4" fill="#FFD469" stroke="#E2A610" strokeWidth="1.5"/>
    <path d="M7 10L17 16" stroke="#E2A610" strokeWidth="1" opacity="0.5"/>
    <path d="M17 10L7 16" stroke="#E2A610" strokeWidth="1" opacity="0.5"/>
  </svg>
);

// Custom Coconut Icon
const CoconutIcon = () => (
  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" fill="#8B5E3C" stroke="#603913" strokeWidth="2"/>
    <circle cx="10" cy="10" r="3" fill="#F5F8FA"/>
  </svg>
);

// --- Helper Components ---

const TokenItem = ({ icon: Icon, color, secondaryColor, label, opacity = 1 }: { icon: any, color: string, secondaryColor?: string, label: string, opacity?: number }) => (
  <div className="flex flex-col items-center justify-center gap-2 group cursor-pointer transition-transform hover:scale-110">
    <div className="relative w-14 h-14 flex items-center justify-center bg-transparent">
      {/* Visual background effect */}
      <div 
        className="absolute inset-0 rounded-full opacity-20 transform scale-75" 
        style={{ backgroundColor: secondaryColor || color }}
      ></div>
      <Icon 
        size={40} 
        color={color} 
        fill={secondaryColor ? secondaryColor : 'none'} 
        style={{ opacity: opacity }}
        strokeWidth={1.5}
      />
    </div>
  </div>
);

const BadgeCard = ({ imageSrc }: { imageSrc: string }) => (
  <div className="relative group">
    <div className="rounded-xl overflow-hidden bg-white/20 p-2 shadow-sm transition-all duration-300 hover:shadow-lg hover:bg-white/40 hover:-translate-y-1">
      <img 
        src={imageSrc} 
        alt="Explorer Badge" 
        className="w-full h-auto object-contain rounded-lg aspect-square"
      />
    </div>
  </div>
);

// --- Main Page Component ---

export default function RewardPage() {
  const colors = {
    greenLight: '#B1E7D6',    // Main background for cards
    turquoise: '#2B4257',     // Text
    darkNavy: '#1F2E3B',      // Buttons
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">

        {/* --- TOKENS BAR --- */}
        <section 
          className="w-full relative rounded-2xl p-6 shadow-md border-4"
          style={{ 
            backgroundColor: colors.greenLight,
            borderColor: colors.greenLight
          }}
        >
          <h2 
            className="absolute top-4 left-6 text-lg font-bold z-10"
            style={{ color: colors.turquoise }}
          >
            Tokens
          </h2>

          <div className="flex flex-wrap items-center justify-between gap-4 mt-8 px-4 md:px-12">
            <TokenItem 
              icon={CompassIcon} 
              color="#E2A610" 
              secondaryColor="#FFCA28" 
              label="Compass" 
            />
            <TokenItem 
              icon={SearchIcon} 
              color="#604C3D" 
              label="Spyglass" 
            />
            <TokenItem 
              icon={StarIcon} 
              color="#D55B40" 
              secondaryColor="#D55B40" 
              label="Sand Dollar" 
            />
            
            {/* Arrow - rotated manually if needed, or using the icon's own orientation */}
            <div className="rotate-45">
               <TokenItem icon={ArrowIcon} color="#5A50CD" label="Arrow" />
            </div>
            
            <div className="hover:scale-110 transition-transform cursor-pointer">
              <PineappleIcon />
            </div>

            <TokenItem 
              icon={MapIcon} 
              color="#185476" 
              label="Map" 
            />
            <TokenItem 
              icon={ShellIcon} 
              color="#819A97" 
              secondaryColor="#ACBBBA" 
              label="Seashell" 
            />
            
            <div className="hover:scale-110 transition-transform cursor-pointer">
              <CoconutIcon />
            </div>

            {/* Empty slots */}
            <TokenItem icon={StarIcon} color="#7B7B7B" secondaryColor="#7B7B7B" opacity={0.5} label="Empty" />
            <TokenItem icon={StarIcon} color="#7B7B7B" secondaryColor="#7B7B7B" opacity={0.5} label="Empty" />
            <TokenItem icon={StarIcon} color="#7B7B7B" secondaryColor="#7B7B7B" opacity={0.5} label="Empty" />
          </div>
        </section>

        {/* --- BADGES BAR --- */}
        <section 
          className="w-full flex-1 min-h-[500px] rounded-2xl p-6 shadow-md relative flex flex-col"
          style={{ backgroundColor: colors.greenLight }}
        >
          <h2 
            className="text-lg font-bold mb-6"
            style={{ color: colors.turquoise }}
          >
            Badges
          </h2>

          {/* Grid of badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 pb-24">
            {Array.from({ length: 10 }).map((_, i) => (
              <BadgeCard 
                key={i} 
                imageSrc={`https://placehold.co/175x175/${
                  ['5A50CD', '2BA52E', '185476', 'D55B40', '604C3D'][i % 5]
                }/FFFFFF?text=EXPLORER`}
              />
            ))}
          </div>

          {/* Redeem Floating Button */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
            <button 
              className="pointer-events-auto px-16 py-4 rounded-2xl shadow-xl transform transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: colors.darkNavy }}
            >
              <span 
                className="text-xl font-bold"
                style={{ color: colors.greenLight }}
              >
                Redeem
              </span>
            </button>
          </div>

        </section>

      </div>
    </div>
  );
}