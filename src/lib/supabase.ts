import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Trade {
  id: string;
  mt_account_id: string;
  journal_id: string;
  symbol?: string | null;
  type: 'BUY' | 'SELL' | 'BALANCE';
  open_time: string;
  close_time?: string | null;
  price: number;
  volume: number;
  profit: number;
  commission: number;
  swap: number;
  metaapi_deal_id?: string | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  trade_id?: string | null;
  date: string;
  title: string;
  content: string;
  emotional_state?: 'excellent' | 'good' | 'neutral' | 'bad' | 'terrible' | null;
  discipline_score?: number | null;
  session_pnl: number;
  trades_count: number;
  tags?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface MTAccount {
  id: string;
  journal_id: string;
  metaapi_account_id: string;
  name: string;
  broker: string;
  platform: 'MT4' | 'MT5';
  region: string;
  account_type: 'demo' | 'live';
  status: 'pending_configuration' | 'deploying' | 'deployed' | 'undeploying' | 'undeployed' | 'connected' | 'disconnected' | 'error';
  deployment_state?: string | null;
  connection_status?: string | null;
  config_link?: string | null;
  config_expires_at?: string | null;
  balance?: number | null;
  equity?: number | null;
  last_sync_at?: string | null;
  consecutive_errors?: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}
