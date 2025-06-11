'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Zap, Gift, RefreshCw } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

const prizes = [
  { text: "10 SOUL", value: 10, color: "hsl(var(--primary))" },
  { text: "50 SOUL", value: 50, color: "hsl(var(--accent))" },
  { text: "Try Again", value: 0, color: "hsl(var(--muted))" },
  { text: "100 SOUL", value: 100, color: "hsl(var(--primary))" },
  { text: "25 SOUL", value: 25, color: "hsl(var(--accent))" },
  { text: "Jackpot! 500 SOUL", value: 500, color: "hsl(var(--destructive))" },
  { text: "5 SOUL", value: 5, color: "hsl(var(--primary))" },
  { text: "Bonus Spin", value: -1, color: "hsl(var(--secondary))" }, // -1 for bonus spin
];

export function FortuneWheelClient() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<typeof prizes[number] | null>(null);
  const [spinsLeft, setSpinsLeft] = useState(3); // Mock daily spins
  const { toast } = useToast();

  const spinWheel = () => {
    if (isSpinning || spinsLeft <= 0) return;

    setIsSpinning(true);
    setResult(null);
    setSpinsLeft(prev => prev - 1);

    const randomIndex = Math.floor(Math.random() * prizes.length);
    const selectedPrize = prizes[randomIndex];
    
    // Calculate rotation: 360 * fullSpins + segmentAngle
    const fullSpins = 5; // Number of full rotations
    const segmentAngle = 360 / prizes.length;
    const targetRotation = (360 * fullSpins) + (randomIndex * segmentAngle) + (segmentAngle / 2) + rotation;
    
    setRotation(targetRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setResult(selectedPrize);
      toast({
        title: "Spin Result!",
        description: selectedPrize.value === 0 
          ? "Better luck next time!" 
          : selectedPrize.value === -1 
          ? "You won a Bonus Spin!"
          : `You won ${selectedPrize.text}!`,
      });
      if (selectedPrize.value === -1) {
        setSpinsLeft(prev => prev + 1);
      }
      // TODO: Add logic to update user's SOUL balance
    }, 4000); // Corresponds to animation duration
  };

  // Reset spins daily (mock)
  useEffect(() => {
    const lastSpinDay = localStorage.getItem('hustleWheelLastSpinDay');
    const today = new Date().toDateString();
    if (lastSpinDay !== today) {
      setSpinsLeft(3);
      localStorage.setItem('hustleWheelLastSpinDay', today);
    }
  }, []);


  return (
    <div className="flex flex-col items-center space-y-8">
      <div className="relative w-72 h-72 md:w-96 md:h-96">
        <div 
          className="relative w-full h-full rounded-full border-8 border-primary shadow-2xl overflow-hidden transition-transform duration-[4000ms] ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Placeholder for wheel segments - a real implementation would draw these */}
          <Image 
            src="https://placehold.co/400x400.png?text=Wheel" 
            alt="Fortune Wheel" 
            layout="fill" 
            objectFit="cover" 
            data-ai-hint="fortune wheel colorful"
            className="opacity-70"
          />
           {prizes.map((prize, index) => (
            <div
              key={index}
              className="absolute w-1/2 h-1/2 origin-bottom-right flex items-center justify-end pr-4"
              style={{
                transform: `rotate(${index * (360 / prizes.length)}deg) skewY(-${90 - (360 / prizes.length)}deg)`,
                backgroundColor: `${prize.color}80`, // Add some transparency
              }}
            >
              <span 
                className="transform -rotate-45 text-xs font-semibold text-primary-foreground"
                style={{ transform: `skewY(${90 - (360 / prizes.length)}deg) rotate(${(360 / prizes.length / 2)}deg) translateX(-50%)` }}
              >
                {prize.text.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-card rounded-full flex items-center justify-center shadow-inner">
          <div className="w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-12 border-b-accent transform -rotate-90 -translate-y-1/3" style={{borderBottomWidth: '12px'}}></div>
        </div>
         <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 -mt-2 w-0 h-0 
            border-l-[10px] border-l-transparent
            border-r-[10px] border-r-transparent
            border-t-[15px] border-t-accent z-10"
          />
      </div>

      <Button
        onClick={spinWheel}
        disabled={isSpinning || spinsLeft <= 0}
        size="lg"
        className="font-headline text-xl px-10 py-6 bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-all duration-300 shadow-lg active:scale-95 disabled:opacity-50"
      >
        {isSpinning ? (
          <RefreshCw className="mr-2 h-6 w-6 animate-spin" />
        ) : (
          <Zap className="mr-2 h-6 w-6" />
        )}
        {isSpinning ? "Spinning..." : "Spin the Wheel!"}
      </Button>

      <p className="text-muted-foreground">Spins left today: {spinsLeft}</p>

      {result && !isSpinning && (
        <div className="mt-6 p-6 bg-card rounded-lg shadow-xl text-center animate-in fade-in zoom-in-90">
          <Gift className="mx-auto h-12 w-12 text-primary mb-3" />
          <h3 className="font-headline text-2xl font-semibold text-foreground">Congratulations!</h3>
          <p className="text-lg text-accent">You won: {result.text}</p>
        </div>
      )}
    </div>
  );
}
