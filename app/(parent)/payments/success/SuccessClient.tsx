"use client"
import React, { useEffect, useRef, useState } from 'react';
import localBgImage from './background.png';
import { useRouter } from "next/navigation"; 

const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12" /></svg>
);
const ChevronLeftIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m15 18-6-6 6-6" /></svg>
);

const useConfetti = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#F472B6', '#C084FC', '#2DD4BF', '#FACC15', '#34D399', '#818CF8'];
    let particles: any[] = [];
    let frame = 0;
    let animationFrameId: number;
    const createParticle = () => ({ x: window.innerWidth / 2, y: -20, vx: (Math.random() - 0.5) * 25, vy: Math.random() * 5 + 3, size: Math.random() * 6 + 4, color: colors[Math.floor(Math.random() * colors.length)], life: 250, gravity: 0.12, drag: 0.98, shape: Math.random() > 0.5 ? 'square' : 'circle', rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 10 });
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (frame < 120) { for (let k = 0; k < 6; k++) particles.push(createParticle()); frame++; }
      particles.forEach((p, index) => {
        p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.vx *= p.drag; p.rotation += p.rotationSpeed; p.life--;
        ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180);
        if (p.shape === 'square') ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        if (p.life <= 0 || p.y > canvas.height + 50) particles.splice(index, 1);
      });
      if (particles.length > 0 || frame < 120) animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    const handleResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); cancelAnimationFrame(animationFrameId); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-50" />;
};

export default function SuccessClient() {
    const ConfettiCanvas = useConfetti;
    const router = useRouter(); 
    const [isNavigating, setIsNavigating] = useState(false);

    const handleDashboardReturn = () => {
        setIsNavigating(true);
        setTimeout(() => router.push('/home'), 800);
    };

    return (
        <div 
            className="fixed inset-0 z-[100] w-full h-full flex justify-center items-center px-4 overflow-hidden bg-emerald-50 font-sans"
            style={{
                backgroundImage: `url(${localBgImage.src})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundColor: '#526e65ff',
            }}
        >
            <ConfettiCanvas />

            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>

            {/* Background Decorations */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 opacity-40 mix-blend-multiply bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-200 via-emerald-100 to-transparent"></div>
            </div>

            {/* MAIN CONTENT BOX */}
            <div 
              className="relative z-10 w-full max-w-[60%] min-w-[300px] text-white rounded-2xl p-6 flex flex-col shadow-2xl border border-white/20"
              style={{
                  background: 'rgba(64, 119, 102, 0.71)',
                  backdropFilter: 'blur(30px)',
                  boxShadow: "0 50px 100px -12px rgba(0, 0, 0, 0.25), inset 0 0 0 5px rgba(255, 255, 255, 0.2)",
                  maxHeight: '90vh',
              }}
            >
                <div className="overflow-y-auto custom-scrollbar flex-grow flex flex-col items-center text-center">
                    
                    {/* Icon */}
                    <div className="relative mb-6 flex-shrink-0 mt-4">
                        <div className="absolute -top-6 -left-8 w-2 h-2 bg-pink-400 rounded-full opacity-60"></div>
                        <div className="absolute -top-8 left-4 w-2 h-2 bg-yellow-300 rounded-full opacity-60"></div>
                        <div className="absolute top-0 -right-6 w-2 h-2 bg-purple-400 rounded-full opacity-60"></div>
                        <div className="absolute bottom-4 -left-6 w-2 h-2 bg-teal-200 rounded-full opacity-60"></div>
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300 z-10 relative">
                            <CheckIcon className="w-12 h-12 text-emerald-500" />
                        </div>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 drop-shadow-sm tracking-tight">
                        Thank you!
                    </h1>
                    <p className="text-white text-base md:text-lg font-semibold tracking-wide mb-8 opacity-95 px-4 uppercase text-emerald-50/90 text-xs md:text-sm">
                        You're now enrolled in our Progressive Package.
                    </p>

                    {/* Inner Text Box */}
                    <div className="w-full max-w-2xl bg-emerald-900/20 rounded-xl p-6 text-left space-y-5 border border-emerald-800/10 shadow-inner mb-8 text-emerald-50">
                        <div>
                            <strong className="text-white block mb-1 text-lg font-bold tracking-wide">Access Your Resources:</strong>
                            <p className="text-emerald-50 leading-snug text-sm font-medium">
                                Head to your account dashboard to explore our library of educational resources and materials.
                            </p>
                        </div>
                        <div>
                            <strong className="text-white block mb-1 text-lg font-bold tracking-wide">Schedule Sessions:</strong>
                            <p className="text-emerald-50 leading-snug text-sm font-medium">
                                Book your personalized one-on-one tutoring sessions with our experienced instructors.
                            </p>
                        </div>
                        <div>
                            <strong className="text-white block mb-1 text-lg font-bold tracking-wide">Need Help?</strong>
                            <p className="text-emerald-50 leading-snug text-sm font-medium">
                                Our support team is here for you. Contact us at <a href="mailto:hello@talkmaze.com" className="underline decoration-1 underline-offset-2 hover:text-white font-bold">hello@talkmaze.com</a>.
                            </p>
                        </div>
                        <div className="pt-4 border-t border-emerald-50/20 mt-2">
                            <p className="text-emerald-50 leading-relaxed text-xs md:text-sm font-medium">
                                Thank you for choosing TalkMaze! We're here to support you on your journey to becoming a confident and compelling public speaker!
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={handleDashboardReturn}
                        className="flex-shrink-0 group flex items-center gap-2 bg-emerald-300 hover:bg-emerald-200 text-emerald-900 font-bold py-3 px-8 rounded-full shadow-lg transform transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed mb-4"
                        disabled={isNavigating}
                    >
                        {isNavigating ? (
                            <span>Redirecting...</span>
                        ) : (
                            <>
                                <ChevronLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                <span>Return to Dashboard</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
