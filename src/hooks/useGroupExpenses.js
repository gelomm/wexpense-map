import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUI } from '../contexts/UIContext';

export function useGroupExpenses() {
  const [expenses, setExpenses] = useState([]);
  const { refreshKey } = useUI();           // ← listen to refresh

  const fetchGroupExpenses = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. People you added
    const { data: yourMembers } = await supabase
      .from('members')
      .select('linked_user_id')
      .eq('user_id', user.id);

    // 2. People who added you
    const { data: membersYouBelongTo } = await supabase
      .from('members')
      .select('user_id')
      .eq('linked_user_id', user.id);

    const userIds = new Set([user.id]);

    yourMembers?.forEach(m => { if (m.linked_user_id) userIds.add(m.linked_user_id); });
    membersYouBelongTo?.forEach(m => { if (m.user_id) userIds.add(m.user_id); });

    const { data } = await supabase
      .from('expenses')
      .select('*')
      .in('user_id', Array.from(userIds))
      .order('created_at', { ascending: false });

    setExpenses(data || []);
  }, [refreshKey]);   // ← refetch when key changes

  useEffect(() => {
    fetchGroupExpenses();
  }, [fetchGroupExpenses]);

  return expenses;
}