
import type { Timestamp } from 'firebase/firestore';

export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'very_hard' | 'very_very_hard';

export interface UserPaymentSettings {
  walletAddress?: string;
  network?: 'polygon' | 'trc20';
}

export interface GameSpecificHeartState {
  count: number;
  nextRegen: string | null;
}
export type GameHearts = Record<string, number | GameSpecificHeartState>;


export interface User {
  id?: string;
  telegram_id: string;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url?: string | null; // Added user's photo URL
  gold_points: number;
  diamond_points: number;
  purple_gem_points: number;
  blue_gem_points?: number;
  referral_link: string;
  referrals_made: number;
  referral_gold_earned?: number;
  referral_diamond_earned?: number;
  initial_free_spin_used: boolean;
  ad_spins_used_today_count: number;
  ad_views_today_count?: number;
  bonus_spins_available: number;
  last_login: string;
  created_at: string;

  daily_reward_streak?: number;
  last_daily_reward_claim_at?: string | null;
  payment_settings?: UserPaymentSettings;
  payment_wallet_address?: string | null;
  payment_network?: string | null;
  daily_ad_views_limit?: number;

  stake_builder_high_score?: number; // This is on user_high_scores table, not users table directly for specific user scores
  game_hearts?: GameHearts;
  last_heart_replenished?: string | null;


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
  id:string;
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
  icon?: string; // Retained for TaskItem usage, but platform is preferred
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
  telegram_id?: string;
  score?: number;
  count?: number;
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
