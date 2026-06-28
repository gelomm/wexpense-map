import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useMyExpenses() {
  const [expenses, setExpenses] = useState([]);

  const fetchMyExpenses = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setExpenses(data || []);
  }, []);

  useEffect(() => {
    fetchMyExpenses();
  }, [fetchMyExpenses]);

  return expenses;
}