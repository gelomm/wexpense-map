import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('invite');
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    const acceptInvite = async () => {
      if (!session) {
        // Not logged in – redirect to login with the token so they come back here after
        navigate(`/login?redirect=/accept-invite?invite=${token}`);
        return;
      }

      // Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('member_invitations')
        .update({ status: 'accepted' })
        .eq('token', token)
        .eq('status', 'pending');

      if (updateError) {
        toast.error('Invitation could not be accepted');
        navigate('/');
        return;
      }

      // Link the member record for this invitation's email to the new user
      const { data: invitation } = await supabase
        .from('member_invitations')
        .select('email, inviter_id')
        .eq('token', token)
        .single();

      if (invitation) {
        // Find the member record that matches this email under the inviter's account
        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('user_id', invitation.inviter_id)
          .eq('email', invitation.email)
          .single();

        if (member) {
          await supabase
            .from('members')
            .update({ linked_user_id: session.user.id })
            .eq('id', member.id);
        }
      }

      toast.success('You have joined the group!');
      navigate('/');
    };

    acceptInvite();
  }, [token, session, navigate]);

  return (
    <div className="h-screen flex items-center justify-center">
      <p className="text-amber-800">Accepting invitation…</p>
    </div>
  );
}