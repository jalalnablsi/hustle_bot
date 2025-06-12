

import type { Timestamp } from 'firebase/firestore';

export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'very_hard' | 'very_very_hard';

export interface UserPaymentSettings {
  walletAddress?: string;
  network?: 'polygon' | 'trc20';
}
export interface User {
  id?: string; 
  telegram_id: string;
  username: string | null;
  first_name: string;
  last_name: string | null;
  gold_points: number;
  diamond_points: number;
  purple_gem_points: number;
  blue_gem_points?: number;
  referral_link: string;
  referrals_made: number;
  initial_free_spin_used: boolean;
  ad_spins_used_today_count: number;
  bonus_spins_available: number;
  last_login: string; 
  created_at: string; 

  daily_reward_streak?: number;
  last_daily_reward_claim_at?: string | null; 
  payment_settings?: UserPaymentSettings;
  payment_wallet_address?: string | null; 
  payment_network?: string | null; 
  daily_ad_views_limit?: number; 

  game_hearts?: { [key in GameKey]?: number }; // Store current hearts for each game
  last_heart_replenished?: { [key in GameKey]?: string }; // Store last replenish time for each game (ISO string)


  // Firestore specific fields if directly mapping from Firestore user docs
  telegramId?: string; 
  telegramUsername?: string;
  firstName?: string;
  lastName?: string | undefined;
  points?: number; 
  goldPoints?: number;
  diamondPoints?: number;
  purpleGemPoints?: number;
  blueGemPoints?: number;
  lastLoginDate?: string;
  lastLoginAt?: string | Timestamp; 
  createdAt?: string | Timestamp; 
}
export type AppUser = User; 


export type Task = {
  id: string;
  title: string;
  description: string;
  task_type: string; 
  platform: string; 
  reward_type: string; 
  reward_amount: number;
  link?: string | null; 
  requires_user_input: boolean;
  input_placeholder?: string | null;
  ad_duration?: number | null; 
  is_active: boolean;
  created_at: string; 
  // Fields for local state / older compatibility
  awardedCurrency?: 'gold' | 'diamonds' | 'gem_purple' | 'gem_blue' | 'spin' | 'points';
  awardedAmount?: number;
  isCompleted?: boolean;
  dataAiHint?: string;
  requiresUserInputForVerification?: 'twitter_username' | 'telegram_username' | 'none';
  userInputPlaceholder?: string;
};

export interface TrafficTask {
  id: string;
  url: string;
  title?: string;
  visitDuration: 10 | 15 | 20 | 30 | 60;
  rewardAmount: number;
  rewardCurrency: 'gold';
  costInPurpleGems: number;
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  avatarUrl?: string;
  dataAiHint?: string;
  telegram_id: string;
}

export interface WheelPrize {
  id: string;
  name: string;
  type: 'gold' | 'diamonds';
  value?: number;
  minDiamondValue?: number;
  maxDiamondValue?: number;
  description: string;
  probabilityWeight: number;
  dataAiHint?: string;
  color?: string;
  isSpecial?: boolean;
}

export interface PollOption {
  id: string;
  text: string;
  vote_count: number; 
  voteCount?: number; 
}

export interface Poll {
  id: string;
  title: string;
  options: PollOption[];
  created_at: string | Timestamp; 
  ends_at: string | Timestamp; 
  status: 'active' | 'closed';
  created_by: string; 
  total_votes: number; 
  winner_option_id?: string | null;
  selected_winner_user_id?: string | null;
  announcement_text?: string | null; 
  // Fields for local state / older compatibility
  createdAt?: string | Timestamp;
  endsAt?: string | Timestamp;
  createdBy?: string;
  totalVotes?: number;
  winnerOptionId?: string | null;
  selectedWinnerUserId?: string | null;
  announcementText?: string | null;
}


export interface UserPollVote {
  poll_id: string;
  user_id: string;
  selected_option_id: string;
  voted_at: string; 
}

export interface DailyRewardItem {
  day: number;
  type: 'gold' | 'diamonds';
  amount: number;
  icon?: React.ElementType;
  isSpecial?: boolean;
}

export interface DailyRewardClaimLog {
    id?: string; 
    user_id: string; 
    telegram_id: string;
    day_claimed: number;
    reward_type: 'gold' | 'diamonds';
    amount_claimed: number;
    claimed_at?: string; 
}

export interface PurpleGemPackage {
  id: string;
  usdtAmount: number;
  gemAmount: number;
  bonusPercentage?: number;
  dataAiHint: string;
}

export interface ExternalGame {
  id?: string; 
  title: string;
  iframe_url: string;
  thumbnail_url: string;
  category: string;
  tags?: string[];
  description?: string;
  instructions?: string;
  data_ai_hint?: string;
  is_active: boolean;
  created_by?: string; 
  created_at?: string | Timestamp;
}

export type GameKey = 'towerBuilder' | 'quickTap' | 'ballJump' | 'game2048';

export interface GameHeartState {
  count: number;
  lastReplenished?: string; // ISO string
  nextReplenishTime?: string; // ISO string for countdown display
}

// This can be used if we move game-specific data into a nested object within AppUser
export interface UserGameData {
  hearts: Partial<Record<GameKey, GameHeartState>>;
  // other game-specific user data for each game, e.g., high scores, progression
  towerBuilderHighScore?: number;
  quickTapHighScore?: Partial<Record<GameDifficulty, number>>;
  // etc.
}
