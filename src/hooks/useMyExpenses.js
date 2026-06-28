import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUI } from '../contexts/UIContext';

export function useMyExpenses() {
  const [expenses, setExpenses] = useState([]);
  const { refreshKey } = useUI();           // ← listen to refresh

  const fetchMyExpenses = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setExpenses(data || []);
  }, [refreshKey]);   // ← refetch when key changes

  useEffect(() => {
    fetchMyExpenses();
  }, [fetchMyExpenses]);

  return expenses;
}