
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Coins, Gem } from 'lucide-react'; // Assuming these icons are used for prizes

interface SegmentConfig {
  name: string;
  type: 'gold' | 'diamonds';
  value?: number;
}

interface ReactWheelProps {
  fixedWheelSize: number;
  segmentsConfig: SegmentConfig[];
  targetPrizeIndex: number | null;
  isWheelSpinningVisually: boolean;
  onSpinAnimationEnd: (wonPrizeData: { label: string; type: 'gold' | 'diamonds'; value?: number; icon: React.ElementType }) => void;
  onWheelClick: () => void;
}

const getIconForType = (type: 'gold' | 'diamonds') => {
  return type === 'gold' ? Coins : Gem;
};

const ReactWheel: React.FC<ReactWheelProps> = ({
  fixedWheelSize,
  segmentsConfig,
  targetPrizeIndex,
  isWheelSpinningVisually,
  onSpinAnimationEnd,
  onWheelClick,
}) => {
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const segmentCount = segmentsConfig.length;
  const segmentAngle = 360 / segmentCount;

  useEffect(() => {
    if (isWheelSpinningVisually && targetPrizeIndex !== null) {
      // Calculate target rotation
      // Add multiple full spins (e.g., 5) for visual effect
      // The final position should align the pointer with the middle of the target segment
      const fullSpins = 5 * 360;
      // Adjust so the pointer (assumed at the top, 0 degrees or 12 o'clock) lands on the target segment
      // Each segment's center is at `segmentAngle * index + segmentAngle / 2`.
      // We want to rotate so that this center aligns with the top pointer.
      // So, the rotation should be negative of that angle.
      const targetSegmentCenterAngle = segmentAngle * targetPrizeIndex + segmentAngle / 2;
      let finalRotation = -(targetSegmentCenterAngle); // Rotate segment to top
      finalRotation += fullSpins; // Add full spins

      // Ensure the rotation increases from the current rotation for a smooth spin effect
      // This logic might need refinement based on how `rotation` state is managed.
      // For simplicity, we directly set the target rotation.
      const currentRotation = rotation % 360;
      let additionalRotation = finalRotation - currentRotation;
      if (additionalRotation < 0) {
        additionalRotation += 360 * (Math.floor(Math.abs(additionalRotation)/360) + 1);
      }
      setRotation(rotation + additionalRotation);


      // Simulate spin duration and call onSpinAnimationEnd
      const spinDuration = 4000; // ms
      setTimeout(() => {
        const wonSegment = segmentsConfig[targetPrizeIndex];
        onSpinAnimationEnd({
          label: wonSegment.name,
          type: wonSegment.type,
          value: wonSegment.value,
          icon: getIconForType(wonSegment.type),
        });
      }, spinDuration);
    }
  }, [isWheelSpinningVisually, targetPrizeIndex, segmentAngle, segmentsConfig, onSpinAnimationEnd, rotation]);


  const wheelStyle: React.CSSProperties = {
    width: `${fixedWheelSize}px`,
    height: `${fixedWheelSize}px`,
    borderRadius: '50%',
    border: '10px solid hsl(var(--primary))', // Using theme color
    position: 'relative',
    overflow: 'hidden',
    transition: isWheelSpinningVisually ? 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none',
    transform: `rotate(${rotation}deg)`,
    cursor: isWheelSpinningVisually ? 'default' : 'pointer',
    boxShadow: '0 0 20px hsl(var(--primary) / 0.5)',
  };

  const pointerStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${fixedWheelSize / 2 - 25}px`, // Adjust based on pointer size
    left: `${fixedWheelSize / 2 - 10}px`, // Adjust based on pointer size
    width: '0',
    height: '0',
    borderLeft: '10px solid transparent',
    borderRight: '10px solid transparent',
    borderTop: `25px solid hsl(var(--accent))`, // Theme accent for pointer
    zIndex: 2,
    transform: 'translateY(-100%) translateX(calc(-50% + 10px)) rotate(180deg)', // Move outside the top center and point down
    filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.5))',
  };
   const centerPinStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: `${fixedWheelSize * 0.1}px`,
    height: `${fixedWheelSize * 0.1}px`,
    borderRadius: '50%',
    background: 'hsl(var(--secondary))',
    border: '3px solid hsl(var(--primary-foreground))',
    transform: 'translate(-50%, -50%)',
    zIndex: 3,
    boxShadow: 'inset 0 0 5px rgba(0,0,0,0.3)',
  };


  return (
    <div style={{ position: 'relative', width: fixedWheelSize, height: fixedWheelSize }} className="mx-auto">
       {/* Pointer element fixed at the top */}
      <div style={{
        position: 'absolute',
        top: '0px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '0',
        height: '0',
        borderLeft: '15px solid transparent',
        borderRight: '15px solid transparent',
        borderTop: '25px solid hsl(var(--accent))',
        zIndex: 10,
      }}></div>
      <div
        ref={wheelRef}
        style={wheelStyle}
        onClick={!isWheelSpinningVisually ? onWheelClick : undefined}
      >
        {segmentsConfig.map((segment, index) => {
          const segmentRotation = segmentAngle * index;
          const isGold = segment.type === 'gold';
          const backgroundColor = index % 2 === 0 ? 'hsl(var(--card) / 0.8)' : 'hsl(var(--muted) / 0.8)';
          
          const Icon = getIconForType(segment.type);

          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                width: '50%',
                height: '50%',
                backgroundColor: backgroundColor,
                transformOrigin: '100% 100%', // Bottom-right corner of the segment
                transform: `rotate(${segmentRotation}deg) skewY(${segmentAngle - 90}deg)`,
                clipPath: 'polygon(0 0, 100% 0, 100% 100%)', // Creates a triangle
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingRight: '20%', // Push content away from the narrow point
                boxSizing: 'border-box',
              }}
            >
              <div style={{ 
                  transform: `skewY(${-(segmentAngle - 90)}deg) rotate(${-segmentAngle/2}deg) translateX(-15%) translateY(-10%)`, // Counter-rotate and adjust position
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  color: 'hsl(var(--card-foreground))',
                }}>
                 <Icon size={fixedWheelSize * 0.05} className={isGold ? 'text-yellow-400' : 'text-sky-400'} />
                <span style={{ fontSize: `${fixedWheelSize * 0.03}px`, fontWeight: 'bold', display: 'block', marginTop: '5px' }}>
                  {segment.value !== 0 ? segment.value : ''}
                </span>
                 <span style={{ fontSize: `${fixedWheelSize * 0.025}px`, display: 'block' }}>
                  {segment.name.replace(segment.value?.toString() || '', '').trim()}
                </span>
              </div>
            </div>
          );
        })}
         <div style={centerPinStyle}></div>
      </div>
    </div>
  );
};

export default ReactWheel;
