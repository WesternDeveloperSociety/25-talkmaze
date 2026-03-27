export default function(){
    return (
         <div className="flex flex-col items-center">
            <a
              href="/onboarding"
              className="flex flex-col items-center gap-[clamp(12px,1.3vw,20px)] cursor-pointer group"
            >
              <div className="w-[clamp(140px,14vw,200px)] aspect-square rounded-xl bg-[#b1e7d6] border-[0.5px] border-black shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center mix-blend-color-dodge">
                  <img
                    src="/lock-icon.svg"
                    alt=""
                    className="w-[75%] h-[75%] object-contain"
                  />
                </div>
                <div className="absolute inset-0 shadow-[inset_0px_4px_4px_0px_rgba(0,0,0,0.25)] rounded-xl pointer-events-none" />
              </div>
              <span className="text-[clamp(16px,1.5vw,22px)] font-bold text-white" >
                + add profile
              </span>
            </a>
            <div className="h-[clamp(40px,4vw,60px)]" />
          </div>
    )
}