"use client";

import React from "react";

const SJDM_PATH = "M 259.10 725.48 L 246.52 727.31 L 239.50 723.76 L 235.64 730.38 L 228.71 729.58 L 200.98 741.48 L 187.44 733.37 L 185.83 721.86 L 168.54 711.68 L 153.74 710.50 L 152.13 718.72 L 145.02 720.10 L 140.27 714.04 L 136.23 721.13 L 122.43 725.17 L 117.32 718.05 L 112.29 724.92 L 115.58 731.27 L 111.75 735.13 L 99.95 729.58 L 84.19 713.11 L 73.60 712.44 L 70.93 693.19 L 59.67 691.22 L 58.12 668.01 L 50.76 668.84 L 50.84 655.42 L 56.69 654.11 L 53.96 634.66 L 58.80 630.74 L 49.64 622.25 L 42.04 625.04 L 33.87 621.86 L 30.78 610.61 L 24.75 607.70 L 11.06 607.74 L 3.80 603.77 L 0.00 581.81 L 6.47 565.23 L 20.89 565.18 L 20.97 556.04 L 33.69 557.37 L 35.88 551.80 L 31.95 545.03 L 37.64 518.62 L 40.26 513.75 L 49.40 509.56 L 56.56 510.73 L 64.35 502.89 L 69.33 503.84 L 78.86 498.35 L 77.28 493.76 L 82.50 477.17 L 85.59 472.77 L 86.30 450.80 L 89.64 435.21 L 95.96 418.19 L 98.32 402.69 L 94.46 392.99 L 99.66 378.88 L 99.34 368.01 L 106.85 354.37 L 112.68 351.22 L 122.48 339.03 L 118.09 326.77 L 123.56 318.06 L 126.02 308.55 L 114.68 303.20 L 112.21 294.72 L 115.11 287.98 L 122.45 283.54 L 153.60 273.74 L 168.07 262.51 L 171.12 256.96 L 182.24 258.39 L 177.89 270.00 L 194.02 262.67 L 207.40 264.70 L 211.03 261.02 L 225.48 242.06 L 230.58 237.36 L 237.20 229.62 L 243.58 226.27 L 246.58 212.80 L 251.69 209.68 L 256.75 200.31 L 286.93 200.42 L 296.27 198.02 L 305.63 199.82 L 325.04 186.55 L 326.46 182.60 L 340.56 173.68 L 343.46 184.12 L 341.56 191.20 L 347.96 195.31 L 369.45 196.07 L 374.24 206.89 L 385.09 214.89 L 385.26 218.84 L 384.12 230.74 L 391.39 231.86 L 397.83 242.21 L 406.36 247.44 L 402.68 254.61 L 404.21 268.11 L 429.51 284.12 L 443.79 291.77 L 457.29 296.40 L 467.76 310.01 L 495.32 318.52 L 509.28 310.98 L 521.03 308.93 L 531.65 295.39 L 535.76 287.63 L 544.10 283.66 L 550.96 269.85 L 552.90 261.21 L 550.76 251.89 L 641.93 274.00 L 645.22 279.23 L 648.49 295.16 L 664.37 295.37 L 672.36 299.01 L 689.40 318.87 L 696.00 323.60 L 705.69 317.25 L 730.05 317.15 L 743.83 326.30 L 754.11 371.53 L 750.52 378.78 L 755.30 381.76 L 765.59 379.31 L 769.70 382.21 L 764.47 390.01 L 771.66 396.35 L 771.30 402.01 L 783.22 415.72 L 788.66 412.47 L 789.81 425.10 L 804.84 432.83 L 808.44 444.05 L 818.21 450.87 L 833.92 453.90 L 832.63 471.28 L 841.71 469.40 L 861.02 459.88 L 863.07 433.58 L 872.00 428.13 L 873.51 422.41 L 863.03 413.42 L 870.98 406.95 L 870.54 393.55 L 878.01 388.15 L 879.97 381.38 L 890.08 378.09 L 892.26 374.35 L 901.95 375.91 L 903.76 363.26 L 910.09 362.35 L 958.90 392.18 L 974.27 398.51 L 1000.00 402.07 L 976.49 485.19 L 970.93 494.43 L 971.95 501.81 L 970.18 529.75 L 964.50 538.38 L 954.80 543.14 L 950.19 550.31 L 922.36 568.25 L 914.11 581.45 L 896.11 594.07 L 887.40 603.79 L 869.94 606.17 L 843.16 590.02 L 824.92 589.63 L 812.43 595.03 L 807.29 591.25 L 799.41 605.84 L 786.47 605.76 L 780.75 616.78 L 766.57 623.37 L 768.85 629.78 L 752.88 634.79 L 751.36 648.65 L 757.44 653.89 L 750.61 660.09 L 738.46 651.59 L 721.89 661.46 L 728.61 669.98 L 730.57 679.17 L 737.76 683.86 L 735.65 695.92 L 727.33 698.62 L 722.88 695.11 L 716.90 699.86 L 711.20 699.26 L 707.79 706.19 L 699.61 714.89 L 691.11 707.22 L 686.69 698.25 L 675.88 697.77 L 676.46 708.40 L 671.19 720.02 L 667.72 738.21 L 657.82 750.78 L 628.45 763.36 L 620.35 772.08 L 619.10 777.89 L 627.37 781.53 L 615.81 791.87 L 611.14 800.34 L 600.84 808.71 L 590.69 804.09 L 581.63 810.83 L 577.64 806.73 L 558.05 811.65 L 557.86 800.52 L 551.92 800.09 L 550.46 810.39 L 546.49 816.46 L 537.51 819.36 L 530.47 816.32 L 530.01 802.86 L 519.19 806.11 L 515.84 820.13 L 504.97 826.32 L 497.50 814.03 L 491.05 811.89 L 486.87 818.31 L 478.91 821.54 L 474.23 812.61 L 484.55 804.79 L 475.72 798.56 L 476.16 787.01 L 471.02 784.10 L 457.85 788.92 L 452.77 778.29 L 445.54 782.15 L 445.54 793.62 L 436.73 797.58 L 436.92 788.29 L 417.74 786.09 L 422.03 777.12 L 413.22 773.99 L 403.99 782.99 L 393.86 787.42 L 392.20 792.85 L 383.04 797.05 L 381.51 787.18 L 385.86 779.44 L 378.45 770.65 L 373.34 770.90 L 369.92 779.28 L 361.02 781.74 L 346.05 782.04 L 349.87 766.54 L 344.31 760.83 L 338.20 767.35 L 323.64 777.23 L 319.77 767.74 L 322.49 752.53 L 313.41 749.45 L 301.44 762.75 L 299.35 739.37 L 288.14 742.83 L 278.18 732.67 L 269.49 736.48 L 259.10 725.48 Z";

export default function SJDMLoader() {
  return (
    <div 
      className="relative flex flex-col items-center justify-center w-full h-full bg-background overflow-hidden"
      style={{
        backgroundImage: `
          linear-gradient(rgba(34, 197, 94, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(34, 197, 94, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        backgroundPosition: 'center center'
      }}
    >
      {/* HUD Corner Accents */}
      <div className="absolute top-8 left-8 text-[10px] font-mono text-primary/40 flex flex-col gap-1 select-none pointer-events-none">
        <div>SYS: ECOWATCH_MAP_INIT</div>
        <div>LAT: 14.8200° N</div>
        <div>LNG: 121.0500° E</div>
      </div>
      <div className="absolute top-8 right-8 text-[10px] font-mono text-primary/40 flex flex-col items-end gap-1 select-none pointer-events-none">
        <div>ZOOM: 12.0 / REGIONAL</div>
        <div>EPSG: 4326 (WGS84)</div>
      </div>
      <div className="absolute bottom-8 left-8 text-[10px] font-mono text-primary/40 select-none pointer-events-none">
        STATUS: SCANNING ENVIRONMENT...
      </div>
      <div className="absolute bottom-8 right-8 text-[10px] font-mono text-primary/40 select-none pointer-events-none">
        SECURE FEED // SJDM, BULACAN
      </div>

      {/* Main Loader Container */}
      <div className="relative flex flex-col items-center justify-center w-80 h-80">
        
        {/* Radiating Sonar Pings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute w-24 h-24 rounded-full border border-primary/20 bg-primary/2 animate-[sonar_4s_linear_infinite]" style={{ animationDelay: '0s' }} />
          <div className="absolute w-24 h-24 rounded-full border border-primary/20 bg-primary/2 animate-[sonar_4s_linear_infinite]" style={{ animationDelay: '1.33s' }} />
          <div className="absolute w-24 h-24 rounded-full border border-primary/20 bg-primary/2 animate-[sonar_4s_linear_infinite]" style={{ animationDelay: '2.66s' }} />
        </div>

        {/* Faint Radar Sweeper Overlay */}
        <div 
          className="absolute inset-4 rounded-full animate-spin opacity-30" 
          style={{ 
            background: 'conic-gradient(from 0deg, transparent 0 300deg, rgba(34,197,94,0.4) 360deg)',
            animationDuration: '3s' 
          }}
        />
        
        {/* SJDM SVG Trace */}
        <svg
          viewBox="0 0 1000 1000"
          className="w-full h-full relative z-10 drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Faint base outline */}
          <path
            d={SJDM_PATH}
            fill="rgba(34, 197, 94, 0.03)"
            stroke="rgba(34, 197, 94, 0.15)"
            strokeWidth="8"
          />
          {/* Glowing animated trace */}
          <path
            d={SJDM_PATH}
            fill="none"
            stroke="#22c55e"
            strokeWidth="12"
            className="animate-[sjdm-trace_5s_linear_infinite]"
            style={{
              strokeDasharray: '600 5400',
              strokeLinecap: 'round'
            }}
          />
        </svg>
        
        {/* Loading Text */}
        <div className="absolute -bottom-8 whitespace-nowrap text-primary font-mono text-xs tracking-[0.25em] animate-pulse">
          INITIALIZING MAP ENGINE
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes sjdm-trace {
          0% { stroke-dashoffset: 6000; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes sonar {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: scale(6.0);
            opacity: 0;
          }
        }
      `}} />
    </div>
  );
}
