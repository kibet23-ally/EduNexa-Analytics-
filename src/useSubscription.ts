import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { fetchWithProxy } from './lib/fetchProxy';

export const useSubscription = () => {
  const { user } = useAuth();
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    if (!user || !user.school_id) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetchWithProxy('schools', {
        select: 'subscription_status, subscription_expiry',
        single: true
      });
      const data = res.data;

      if (data) {
        setSubscriptionStatus(data.subscription_status);
        const expiryDate = data.subscription_expiry ? new Date(data.subscription_expiry) : null;
        const now = new Date();
        
        const isExpired = (expiryDate && now > expiryDate) || 
                          data.subscription_status?.toLowerCase() === 'expired' ||
                          data.subscription_status?.toLowerCase() === 'suspended';
        
        setIsReadOnly(isExpired);
      }
    } catch (err) {
      console.error('useSubscription: Failed to check status', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (mounted) await checkStatus();
    })();
    
    // Refresh status if user re-focuses or regularly
    const interval = setInterval(() => {
      if (mounted) checkStatus();
    }, 300000); // 5 mins
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [checkStatus]);

  return { isReadOnly, subscriptionStatus, loading, refresh: checkStatus };
};
