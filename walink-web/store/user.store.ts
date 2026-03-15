import { create } from 'zustand';
import { createClient } from '../lib/supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  plan_id: string;
  credits_balance: number;
  api_key: string;
  plan_expires_at?: string;
}

interface UserState {
  user: UserProfile | null;
  isLoading: boolean;
  fetchUser: () => Promise<void>;
  updateCredits: (balance: number) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: true,
  
  fetchUser: async () => {
    set({ isLoading: true });
    try {
      const supabase = createClient();
      const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();

      if (authErr || !authUser) {
        set({ user: null, isLoading: false });
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileErr || !profile) {
        set({ user: null, isLoading: false });
        return;
      }

      set({
        user: {
          id: profile.id,
          email: profile.email || authUser.email || '',
          full_name: profile.full_name || '',
          plan_id: profile.plan_id || 'free',
          credits_balance: profile.credits_balance || 0,
          api_key: profile.api_key || '',
          plan_expires_at: profile.plan_expires_at,
        },
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      set({ user: null, isLoading: false });
    }
  },

  updateCredits: (balance: number) => {
    set((state) => ({
      user: state.user ? { ...state.user, credits_balance: balance } : null,
    }));
  },

  clearUser: () => {
    set({ user: null, isLoading: false });
  },
}));
