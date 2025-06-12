
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Coins, Gem, RefreshCcw } from 'lucide-react';
import styles from './react-wheel.module.css';
import type { WheelPrize as BackendPrizeConfig } from '@/types'; // Assuming this type is defined
import { cn } from '@/lib/utils';

// More vibrant and distinct colors
const NEW_WHEEL_COLORS = [
  'hsl(190 78% 48%)', // Teal
  'hsl(335 80% 58%)', // Deep Pink
  'hsl(45 95% 50%)',  // Gold/Yellow
  'hsl(260 65% 60%)', // Purple
  'hsl(130 55% 48%)', // Green
  'hsl(20 88% 58%)',  // Orange
  'hsl(220 70% 55%)', // Blue
  'hsl(0 0% 50%)',    // Grey for Try Again
];

const NEW_TEXT_COLORS = [ // Corresponding text colors for contrast
  'hsl(var(--primary-foreground))', // For Teal
  'hsl(var(--primary-foreground))', // For Deep Pink
  'hsl(var(--card-foreground))',    // Dark text for Gold/Yellow
  'hsl(var(--primary-foreground))', // For Purple
  'hsl(var(--primary-foreground))', // For Green
  'hsl(var(--primary-foreground))', // For Orange
  'hsl(var(--primary-foreground))', // For Blue
  'hsl(var(--primary-foreground))', // For Grey
];


// This configuration should match the 8 prizes from your backend
const DEFAULT_PRIZES_CONFIG_REACT_WHEEL: Omit<BackendPrizeConfig, 'id' | 'dataAiHint' | 'color' | 'isSpecial' | 'description' | 'probabilityWeight'>[] = [
  { name: '50 Gold', type: 'gold', value: 50 },
  { name: '0.005 Diamond', type: 'diamonds', value: 0.005 },
  { name: '100 Gold', type: 'gold', value: 100 },
  { name: 'Try Again', type: 'gold', value: 0 }, // For Try Again
  { name: '25 Gold', type: 'gold', value: 25 },
  { name: '0.001 Diamond', type: 'diamonds', value: 0.001 },
  { name: '75 Gold', type: 'gold', value: 75 },
  { name: '0.002 Diamond', type: 'diamonds', value: 0.002 },
];

interface SegmentData {
  label: string; // Full label for toast/debugging
  shortLabel: string; // Potentially shorter label for display if needed
  type: 'gold' | 'diamonds';
  value?: number;
  icon: React.ElementType;
  color: string;
  textColor: string;
  originalPrize: Omit<BackendPrizeConfig, 'id' | 'dataAiHint' | 'color' | 'isSpecial' | 'description' | 'probabilityWeight'>;
}

interface ReactWheelProps {
  fixedWheelSize?: number;
  segmentsConfig?: Omit<BackendPrizeConfig, 'id' | 'dataAiHint' | 'color' | 'isSpecial' | 'description' | 'probabilityWeight'>[];
  targetPrizeIndex: number | null;
  isWheelSpinningVisually: boolean;
  onSpinAnimationEnd: (prize: SegmentData) => void;
  onWheelClick: () => void; // For clicking the wheel itself
  wheelId?: string;
}

const ReactWheel: React.FC<ReactWheelProps> = ({
  fixedWheelSize = 460,
  segmentsConfig = DEFAULT_PRIZES_CONFIG_REACT_WHEEL,
  targetPrizeIndex,
  isWheelSpinningVisually,
  onSpinAnimationEnd,
  onWheelClick,
  wheelId = "react-wheel-svg-dynamic",
}) => {
  const wheelGroupRef = useRef<SVGGElement>(null);
  const [currentRotation, setCurrentRotation] = useState(0);
  const totalSpinsRef = useRef(0); // To ensure it spins multiple times

  const segments: SegmentData[] = useMemo(() => {
    return segmentsConfig.map((prize, index) => {
      let iconEl = Coins;
      let shortLabelDisplay = `${prize.value}`;
      if (prize.type === 'diamonds') {
        iconEl = Gem;
        shortLabelDisplay = `${prize.value?.toFixed(3)}`;
      } else if (prize.type === 'gold' && prize.value === 0) {
        iconEl = RefreshCcw;
        shortLabelDisplay = 'Retry';
      }

      return {
        label: prize.name,
        shortLabel: shortLabelDisplay,
        type: prize.type,
        value: prize.value,
        icon: iconEl,
        color: NEW_WHEEL_COLORS[index % NEW_WHEEL_COLORS.length],
        textColor: NEW_TEXT_COLORS[index % NEW_TEXT_COLORS.length],
        originalPrize: prize,
      };
    });
  }, [segmentsConfig]);

  const numSegments = segments.length;
  const anglePerSegment = 360 / numSegments;
  const radius = fixedWheelSize / 2;
  const innerRadiusRatio = 0.22; 
  const iconRadiusRatio = 0.68; 
  const iconSize = fixedWheelSize * 0.085;


  // Helper function to convert polar to Cartesian coordinates
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (r * Math.cos(angleInRadians)),
      y: centerY + (r * Math.sin(angleInRadians))
    };
  };

  const getSectorPath = (index: number): string => {
    const startAngleDeg = anglePerSegment * index;
    const endAngleDeg = anglePerSegment * (index + 1);

    const outerArcStart = polarToCartesian(radius, radius, radius, endAngleDeg);
    const outerArcEnd = polarToCartesian(radius, radius, radius, startAngleDeg);
    const innerArcStart = polarToCartesian(radius, radius, radius * innerRadiusRatio, endAngleDeg);
    const innerArcEnd = polarToCartesian(radius, radius, radius * innerRadiusRatio, startAngleDeg);
    
    const largeArcFlag = anglePerSegment > 180 ? "1" : "0";

    const d = [
      "M", outerArcStart.x, outerArcStart.y,
      "A", radius, radius, 0, largeArcFlag, 0, outerArcEnd.x, outerArcEnd.y,
      "L", innerArcEnd.x, innerArcEnd.y,
      "A", radius * innerRadiusRatio, radius * innerRadiusRatio, 0, largeArcFlag, 1, innerArcStart.x, innerArcStart.y,
      "Z"
    ].join(" ");
    return d;
  };

  const getContentCoordinates = (index: number) => {
    // Center angle of the segment
    const segmentCenterAngleDeg = (anglePerSegment * index) + (anglePerSegment / 2);
    const { x, y } = polarToCartesian(radius, radius, radius * iconRadiusRatio, segmentCenterAngleDeg);
    return { x, y };
  };


  useEffect(() => {
    if (targetPrizeIndex !== null && isWheelSpinningVisually) {
      // Add multiple full spins for visual effect + target the specific segment
      const baseSpins = 5 + Math.floor(Math.random() * 3); // 5 to 7 full spins
      // Calculate rotation to stop at the *middle* of the target segment
      // The pointer is at the top (visual 0 degrees or -90 SVG degrees if Y is downwards)
      // We want the middle of the target segment to align with the pointer.
      const targetSegmentMiddleAngle = (targetPrizeIndex * anglePerSegment) + (anglePerSegment / 2);
      // Rotation to align this middle with the top pointer (0 degrees for our calculation, so negative rotation)
      const rotationToTarget = -targetSegmentMiddleAngle;
      
      const finalRotation = (baseSpins * 360) + rotationToTarget;
      setCurrentRotation(finalRotation);
    }
  }, [targetPrizeIndex, isWheelSpinningVisually, anglePerSegment, numSegments]);

  const handleTransitionEnd = () => {
    if (isWheelSpinningVisually && targetPrizeIndex !== null) {
      const wonPrize = segments[targetPrizeIndex];
      onSpinAnimationEnd(wonPrize);
      
      // Normalize rotation to keep it within 0-360 for subsequent spins starting point
      const targetSegmentMiddleAngle = (targetPrizeIndex * anglePerSegment) + (anglePerSegment / 2);
      const finalVisualStopAngle = -targetSegmentMiddleAngle;
      setCurrentRotation(finalVisualStopAngle % 360);
    }
  };
  
  const svgViewBox = `0 0 ${fixedWheelSize} ${fixedWheelSize}`;

  return (
    <div className={styles.wheelContainer} style={{ width: `${fixedWheelSize}px`, height: `${fixedWheelSize}px` }}>
      <div 
        className={styles.pointerContainer} 
        style={{ 
            width: `${fixedWheelSize * 0.12}px`, 
            height: `${fixedWheelSize * 0.15}px`, 
            top: `-${fixedWheelSize * 0.01}px` // Slightly adjust pointer position
        }}
      >
        <svg viewBox="0 0 50 60" className={styles.pointerSvg}>
          <path d="M25 0 L50 30 L25 60 L0 30 Z" fill="hsl(var(--destructive))" stroke="hsl(var(--background))" strokeWidth="2.5"/>
          <circle cx="25" cy="32" r="5" fill="hsl(var(--background))" />
        </svg>
      </div>
      <svg 
        id={wheelId} 
        className={cn(styles.wheelSvg, !isWheelSpinningVisually && styles.clickableWheel)} 
        viewBox={svgViewBox} 
        preserveAspectRatio="xMidYMid meet"
        onClick={!isWheelSpinningVisually ? onWheelClick : undefined}
      >
        <defs>
          <filter id={`${wheelId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle cx={radius} cy={radius} r={radius * 0.995} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
        <g
          ref={wheelGroupRef}
          className={styles.wheelGroup}
          style={{ transform: `rotate(${currentRotation}deg)` }}
          onTransitionEnd={handleTransitionEnd}
        >
          {segments.map((segment, index) => {
            const pathD = getSectorPath(index);
            const { x: iconX, y: iconY } = getContentCoordinates(index);
            const Icon = segment.icon;

            // Calculate the rotation for the icon group to keep the icon upright
            // The icon's group is translated to (iconX, iconY) which is relative to the SVG center.
            // This translated group will rotate with the main `wheelGroupRef`.
            // To keep the icon upright, we apply a counter-rotation to this specific icon group.
            const iconGroupRotation = -currentRotation;

            return (
              <g key={`${wheelId}-segment-${index}`} className={styles.segmentGroup}>
                <path d={pathD} fill={segment.color} className={styles.sectorPath} stroke="hsl(var(--background)/0.7)" strokeWidth="1.5"/>
                <g transform={`translate(${iconX} ${iconY}) rotate(${iconGroupRotation})`}>
                    <Icon
                        x={-iconSize / 2} // Center the icon
                        y={-iconSize / 2} // Center the icon
                        width={iconSize}
                        height={iconSize}
                        color={segment.textColor}
                        className={styles.sectorIcon}
                        strokeWidth={segment.type === 'diamonds' || (segment.type === 'gold' && segment.value === 0) ? 1.8 : 2.2}
                    />
                </g>
              </g>
            );
          })}
        </g>
        {/* Central Hub Design - More prominent */}
        <circle cx={radius} cy={radius} r={radius * innerRadiusRatio * 1.1} fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="3" />
        <circle cx={radius} cy={radius} r={radius * innerRadiusRatio * 0.85} fill="hsl(var(--background))" stroke="hsl(var(--primary)/0.6)" strokeWidth="3" />
        <circle cx={radius} cy={radius} r={radius * innerRadiusRatio * 0.55} fill="hsl(var(--primary))" />
      </svg>
    </div>
  );
};

export default ReactWheel;
