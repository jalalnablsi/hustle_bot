
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

  // Fields for specific games, e.g., Stake Builder (Sky High Stacker)
  // These would typically be part of a more flexible structure like a JSONB field `game_stats` in your DB
  // For simplicity here, adding them directly if only one main game.
  stake_builder_hearts?: number; // Current hearts for this game
  stake_builder_last_heart_regen?: string; // ISO string for last regen time for this game
  stake_builder_high_score?: number;


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
  points: number; // Generic points, can be adapted to game score
  avatarUrl?: string;
  dataAiHint?: string;
  telegram_id: string; // Ensure this is present if leaderboard is user-specific
}

export interface WheelPrize {
  id: string;
  name: string;
  type: 'gold' | 'diamonds'; // Keep simple for now
  value?: number; // For gold
  minDiamondValue?: number; // For diamond ranges
  maxDiamondValue?: number; // For diamond ranges
  description: string;
  probabilityWeight: number; // For weighted random selection on backend
  dataAiHint?: string;
  color?: string; // For wheel segment color
  isSpecial?: boolean; // For highlighting special prizes
}

// Polls related types
export interface PollOption {
  id: string;
  text: string;
  vote_count: number; // Stored in DB
  voteCount?: number; // Might be used for local state updates
}

export interface Poll {
  id: string;
  title: string;
  options: PollOption[];
  created_at: string | Timestamp; // ISO string or Timestamp
  ends_at: string | Timestamp;   // ISO string or Timestamp
  status: 'active' | 'closed';
  created_by: string; // User ID of creator
  total_votes: number; // Stored in DB
  winner_option_id?: string | null;
  selected_winner_user_id?: string | null; // If a user is selected from voters
  announcement_text?: string | null; // For winner announcement

  // Local state compatibility, can be removed if backend fully drives state
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
  voted_at: string; // ISO string
}

// Daily Rewards
export interface DailyRewardItem {
  day: number;
  type: 'gold' | 'diamonds';
  amount: number;
  icon?: React.ElementType; // Lucide icon for display
  isSpecial?: boolean; // For highlighting milestone days
}

export interface DailyRewardClaimLog {
    id?: string; // Optional: If you need to identify the log entry itself
    user_id: string; // UUID of the user
    telegram_id: string; // Telegram ID for reference
    day_claimed: number; // Which day in the streak was claimed (e.g., 1 for Day 1, 7 for Day 7)
    reward_type: 'gold' | 'diamonds';
    amount_claimed: number;
    claimed_at?: string; // ISO timestamp of when it was claimed
}

export interface PurpleGemPackage {
  id: string;
  usdtAmount: number;
  gemAmount: number;
  bonusPercentage?: number;
  dataAiHint: string;
}

export interface ExternalGame {
  id?: string; // Optional: UUID from DB
  title: string;
  iframe_url: string;
  thumbnail_url: string;
  category: string;
  tags?: string[];
  description?: string;
  instructions?: string;
  data_ai_hint?: string;
  is_active: boolean;
  created_by?: string; // Admin User ID
  created_at?: string | Timestamp; // ISO string or Timestamp
}

// Example structure for a game's heart state if managed per game type
// This would align with a backend structure where user.game_hearts is a JSONB like:
// { "stake-builder": { "count": 3, "nextRegen": "iso_timestamp" }, "another-game": { ... } }
export interface GameSpecificHeartState {
  count: number;
  nextRegen: string | null; // ISO timestamp for the next regeneration time for this specific game
}

export type GameHearts = Record<string, GameSpecificHeartState>; // e.g. { 'stake-builder': { count: 3, nextRegen: '...' } }

