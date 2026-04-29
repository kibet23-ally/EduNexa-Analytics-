import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../useAuth';

const SubscriptionBanner: React.FC = () => {
  const { user } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    status: string;
    expiry: Date | null;
    daysLeft: number | null;
    isExpired: boolean;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || !user.school_id) return;

    const fetchSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('schools')
          .select('subscription_status, subscription_expiry')
          .eq('id', user.school_id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const expiryDate = data.subscription_expiry ? new Date(data.subscription_expiry) : null;
          const now = new Date();
          let daysLeft = null;
          let isExpired = false;

          if (expiryDate) {
            const diffTime = expiryDate.getTime() - now.getTime();
            daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            isExpired = diffTime <= 0;
          }

          if (data.subscription_status?.toLowerCase() === 'expired') {
            isExpired = true;
          }

          setSubscriptionInfo({
            status: data.subscription_status,
            expiry: expiryDate,
            daysLeft,
            isExpired
          });
        }
      } catch (err) {
        console.error('Failed to fetch subscription info:', err);
      }
    };

    fetchSubscription();
    
    // Refresh every hour or so if left open
    const interval = setInterval(fetchSubscription, 3600000);
    return () => clearInterval(interval);
  }, [user]);

  if (!subscriptionInfo || dismissed) return null;

  const { isExpired, daysLeft } = subscriptionInfo;

  // Only show banner if expired or expiring within 3 days
  if (!isExpired && (daysLeft === null || daysLeft > 3)) return null;

  return (
    <div 
      id="subscription-banner"
      className={`relative w-full px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium z-50 animate-in fade-in slide-in-from-top duration-500 ${
        isExpired 
          ? 'bg-red-600 text-white' 
          : 'bg-amber-500 text-white'
      }`}
    >
      <div className="flex items-center gap-2">
        {isExpired ? (
          <AlertCircle size={18} className="shrink-0" />
        ) : (
          <Clock size={18} className="shrink-0" />
        )}
        
        <p>
          {isExpired ? (
            <span className="font-bold">Subscription Expired!</span>
          ) : (
            <span>Subscription expiring in <span className="font-bold underline">{daysLeft} days</span>.</span>
          )}
          {' '}
          <span className="opacity-90">
            {isExpired 
              ? "EduNexa Analytics is now in read-only mode. Please renew to resume operations."
              : "Renew now to avoid service interruption and read-only mode."
            }
          </span>
        </p>
      </div>

      {!isExpired && (
        <button 
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-white/20 rounded-lg transition-colors absolute right-2 top-1/2 -translate-y-1/2"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default SubscriptionBanner;
