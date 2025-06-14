
import type { Timestamp } from 'firebase/firestore';

export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'very_hard' | 'very_very_hard';

export interface UserPaymentSettings {
  walletAddress?: string;
  network?: 'polygon' | 'trc20';
}

// Defines the structure for a specific game's heart state, e.g., within a user's `game_hearts` JSONB field
export interface GameSpecificHeartState {
  count: number;
  nextRegen: string | null; // ISO timestamp for the next regeneration time for this specific game
}
// Defines the overall structure for game hearts if stored as a map in the user object
export type GameHearts = Record<string, GameSpecificHeartState>; // e.g. { 'stake-builder': { count: 3, nextRegen: '...' } }


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
  initial_free_spin_used: boolean; // For wheel
  ad_spins_used_today_count: number; // For wheel ads
  bonus_spins_available: number; // For wheel
  last_login: string; 
  created_at: string; 

  daily_reward_streak?: number;
  last_daily_reward_claim_at?: string | null; 
  payment_settings?: UserPaymentSettings;
  payment_wallet_address?: string | null; 
  payment_network?: string | null; 
  daily_ad_views_limit?: number; // General ad view limit, might be per feature

  // Game-specific stats examples (can be in a JSONB field 'game_stats' or similar)
  // For Stake Builder:
  stake_builder_high_score?: number;
  // Hearts for games like Stake Builder could be managed via a 'game_hearts' field of type GameHearts
  // e.g., user.game_hearts = { 'stake-builder': { count: 3, nextRegen: 'ISO_STRING' } }
  // Or, if your Supabase schema has specific columns (less flexible but simpler for one game):
  // stake_builder_hearts?: number; 
  // stake_builder_last_heart_regen?: string; // ISO string

  game_hearts?: GameHearts; // More flexible for multiple games
  last_heart_replenished?: string; // Could be a global last replenish check time or game-specific if in GameHearts


  // Firestore specific fields if directly mapping from Firestore user docs (can be removed if not using Firestore)
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


    