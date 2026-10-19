import React from 'react';

interface MascotProps {
  mood?: 'happy' | 'encouraging' | 'reading' | 'celebrating' | 'thinking';
  speech?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBook?: boolean;
}

export const MascotBird: React.FC<MascotProps> = ({
  mood = 'happy',
  speech,
  size = 'md',
  className = '',
  showBook = true
}) => {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-36 h-36',
    xl: 'w-48 h-48'
  };

  return (
    <div className={`relative inline-flex flex-col sm:flex-row items-center gap-3 ${className}`}>
      {/* Speech Bubble */}
      {speech && (
        <div className="relative bg-white border-2 border-sky-300 rounded-2xl px-4 py-2.5 shadow-md text-xs sm:text-sm md:text-base font-extrabold text-sky-950 animate-gentle-bounce max-w-xs z-10 text-center sm:text-left">
          <p>{speech}</p>
          {/* Arrow */}
          <div className="hidden sm:block absolute -bottom-2 left-6 w-3 h-3 bg-white border-b-2 border-r-2 border-sky-300 transform rotate-45"></div>
          <div className="sm:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b-2 border-r-2 border-sky-300 transform rotate-45"></div>
        </div>
      )}

      {/* Bird Vector Illustration */}
      <div className={`relative ${sizeClasses[size]} shrink-0 transition-transform hover:scale-105 select-none`}>
        <svg
          viewBox="0 0 160 160"
          className="w-full h-full drop-shadow-md"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="birdBlue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="birdBelly" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FEF9C3" />
              <stop offset="100%" stopColor="#FEF08A" />
            </linearGradient>
            <linearGradient id="bookCover" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>

          {/* Tail feathers */}
          <path d="M30 92 C14 85 10 102 16 112 C24 122 42 108 40 100 Z" fill="#0284C7" />
          <path d="M22 100 C8 100 6 116 14 124 C22 130 38 118 34 110 Z" fill="#0369A1" />

          {/* Body */}
          <circle cx="85" cy="85" r="46" fill="url(#birdBlue)" />

          {/* Soft Cream Belly */}
          <ellipse cx="96" cy="95" rx="28" ry="30" fill="url(#birdBelly)" />

          {/* Wings */}
          {mood === 'celebrating' ? (
            <g className="animate-wiggle">
              <path d="M48 70 C35 50 50 35 65 52 C72 60 66 82 56 80 Z" fill="#0EA5E9" />
              <path d="M122 70 C135 50 120 35 105 52 C98 60 104 82 114 80 Z" fill="#0EA5E9" />
            </g>
          ) : (
            <>
              <path d="M50 86 C40 72 56 58 68 70 C74 76 70 96 60 94 Z" fill="#0EA5E9" />
              <path d="M120 86 C130 72 114 58 102 70 C96 76 100 96 110 94 Z" fill="#0EA5E9" />
            </>
          )}

          {/* Leaf Crest on Head (Growth & Vietnamese curriculum symbol) */}
          <path d="M78 38 C72 24 85 16 92 24 C97 30 89 38 84 38 Z" fill="#22C55E" />
          <path d="M85 35 C91 22 103 18 105 28 C105 33 96 36 90 36 Z" fill="#16A34A" />

          {/* Eyes */}
          {mood === 'happy' || mood === 'celebrating' ? (
            // Cheerful smiling curved eyes
            <>
              <path d="M92 68 C96 63 103 63 107 68" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M115 68 C119 63 126 63 130 68" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : (
            // Big friendly round open eyes
            <>
              <ellipse cx="98" cy="68" rx="8" ry="10" fill="#FFFFFF" />
              <ellipse cx="122" cy="68" rx="8" ry="10" fill="#FFFFFF" />
              <circle cx="100" cy="68" r="4.5" fill="#0F172A" />
              <circle cx="124" cy="68" r="4.5" fill="#0F172A" />
              <circle cx="102" cy="66" r="1.5" fill="#FFFFFF" />
              <circle cx="126" cy="66" r="1.5" fill="#FFFFFF" />
            </>
          )}

          {/* Blushing cheeks */}
          <ellipse cx="90" cy="79" rx="5" ry="3" fill="#F43F5E" opacity="0.4" />
          <ellipse cx="130" cy="79" rx="5" ry="3" fill="#F43F5E" opacity="0.4" />

          {/* Golden beak */}
          <path d="M106 74 L120 81 L106 88 Z" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round" />

          {/* Reading glasses if mood is reading */}
          {mood === 'reading' && (
            <g>
              <circle cx="98" cy="68" r="10" stroke="#78350F" strokeWidth="2" fill="none" />
              <circle cx="122" cy="68" r="10" stroke="#78350F" strokeWidth="2" fill="none" />
              <line x1="108" y1="68" x2="112" y2="68" stroke="#78350F" strokeWidth="2" />
            </g>
          )}

          {/* Open Book in hand */}
          {showBook && (
            <g transform="translate(60, 102)">
              <path d="M4 18 Q25 22 46 18 Q46 26 25 30 Q4 26 4 18 Z" fill="#B45309" />
              <path d="M4 16 Q25 10 25 20 Q25 20 4 25 Z" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1.2" />
              <path d="M46 16 Q25 10 25 20 Q25 20 46 25 Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.2" />
              <path d="M2 17 Q25 11 25 21 L24 23 Q25 13 2 19 Z" fill="url(#bookCover)" />
              <path d="M48 17 Q25 11 25 21 L26 23 Q25 13 48 19 Z" fill="url(#bookCover)" />
              <line x1="8" y1="19" x2="20" y2="17" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />
              <line x1="8" y1="22" x2="18" y2="20" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />
              <line x1="30" y1="17" x2="42" y2="19" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />
              <line x1="32" y1="20" x2="42" y2="22" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />
            </g>
          )}

          {/* Little feet */}
          <path d="M74 130 L74 139 M70 139 L78 139" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          <path d="M96 130 L96 139 M92 139 L100 139" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};
