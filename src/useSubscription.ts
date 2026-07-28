import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { fetchWithProxy } from './lib/fetchProxy';
import { supabase } from './lib/supabase';

export const useSubscription = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);

  const checkStatus = useCallback(async () => {
    if (!user?.school_id) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetchWithProxy('schools', {
        select: `
          subscription_status,
          subscription_expiry,
          subscription_plan,
          subscription_activation_date
        `,
        filters: {
          id: user.school_id
        },
        single: true
      });

      const school = res.data;

      if (!school) {
        setLoading(false);
        return;
      }

      const expiry = school.subscription_expiry
        ? new Date(school.subscription_expiry)
        : null;

      const expired =
        expiry
          ? expiry.getTime() < Date.now()
          : school.subscription_status?.toLowerCase() === 'expired';

      setSubscriptionStatus(school.subscription_status);
      setExpiryDate(expiry);
      setIsReadOnly(expired);
    } catch (err) {
      console.error('Subscription check failed', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkStatus();

    if (!user?.school_id) return;

    const channel = supabase
      .channel(`subscription-${user.school_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'schools',
          filter: `id=eq.${user.school_id}`
        },
        () => {
          checkStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkStatus, user]);

  return {
    loading,
    isReadOnly,
    subscriptionStatus,
    expiryDate,
    refresh: checkStatus
  };
};