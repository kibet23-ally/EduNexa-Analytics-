import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../useAuth';
import {
  CheckCircle, XCircle, Loader2, Phone, CreditCard,
  Zap, Star, Crown, RefreshCw, AlertTriangle, ChevronRight,
  Calendar, Users, BookOpen, Shield, TrendingUp,
} from 'lucide-react';

/* ─── Plan data ──────────────────────────────────────────────────────────── */
const PLANS = [
  {
    id: 1,
    name: 'Basic',
    icon: Zap,
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    price_term: 2500,    // KES 2,500 per term
    price_annual: 6750,  // KES 6,750 per year (10% off)
    student_limit: 150,
    teacher_limit: 10,
    features: [
      'Up to 150 Students',
      'Up to 10 Teachers',
      'Student Management',
      'Marks Entry',
      'Basic Reports & PDF Export',
      'Attendance Tracking',
      'Email Support',
      '7-Day Grace Period',
    ],
    popular: false,
  },
  {
    id: 2,
    name: 'Standard',
    icon: Star,
    color: '#1e3a5f',
    bg: '#f0f4fb',
    border: '#96aed3',
    price_term: 5000,
    price_annual: 13500,
    student_limit: 400,
    teacher_limit: 30,
    features: [
      'Up to 400 Students',
      'Up to 30 Teachers',
      'All Basic Features',
      'Exam Management',
      'Analytics & Charts',
      'Excel & PDF Exports',
      'Teacher Assignments',
      'Priority Email Support',
      '7-Day Grace Period',
    ],
    popular: true,
  },
  {
    id: 3,
    name: 'Premium',
    icon: Crown,
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fcd34d',
    price_term: 9000,
    price_annual: 24300,
    student_limit: 999999,
    teacher_limit: 999999,
    features: [
      'Unlimited Students',
      'Unlimited Teachers',
      'All Standard Features',
      'Advanced Analytics',
      'Custom Report Cards',
      'Multi-Grade Reporting',
      'Performance Trends',
      'Most Improved Tracking',
      'Dedicated Support',
      '7-Day Grace Period',
      'Annual Discount 10%',
    ],
    popular: false,
  },
];

/* ─── Payment status type ─────────────────────────────────────────────────── */
type PayStatus = 'idle' | 'sending' | 'polling' | 'success' | 'failed' | 'cancelled';

/* ─── Polling config ─────────────────────────────────────────────────────── */
const POLL_INTERVAL_MS = 4000;   // check every 4 seconds
const POLL_TIMEOUT_MS  = 90000;  // give up after 90 seconds

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function Subscription() {
  const { user } = useAuth();

  // ── State ──
  const [selectedPlan, setSelectedPlan]     = useState<typeof PLANS[0] | null>(null);
  const [billingCycle, setBillingCycle]     = useState<'term' | 'annual'>('term');
  const [phone, setPhone]                   = useState('');
  const [phoneError, setPhoneError]         = useState('');
  const [payStatus, setPayStatus]           = useState<PayStatus>('idle');
  const [paymentId, setPaymentId]           = useState<string | null>(null);
  const [errorMsg, setErrorMsg]             = useState('');
  const [receiptNumber, setReceiptNumber]   = useState('');
  const [currentSub, setCurrentSub]         = useState<any>(null);
  const [subLoading, setSubLoading]         = useState(true);

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  // ── Load current subscription ──
  useEffect(() => {
    const fetchSub = async () => {
      if (!user?.school_id) return;
      setSubLoading(true);
      const { data } = await supabase
        .from('v_school_subscription')
        .select('*')
        .eq('school_id', user.school_id)
        .maybeSingle();
      setCurrentSub(data);
      setSubLoading(false);
    };
    fetchSub();
  }, [user?.school_id, payStatus]);

  // ── Stop polling ──
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ── Poll payment status from payments table ──
  const startPolling = useCallback((pid: string) => {
    stopPolling();
    pollStartRef.current = Date.now();
    setPayStatus('polling');

    pollRef.current = setInterval(async () => {
      // Timeout check
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        stopPolling();
        setPayStatus('failed');
        setErrorMsg('Payment confirmation timed out. If you completed payment, please refresh in a few minutes.');
        return;
      }

      try {
        const { data: payment } = await supabase
          .from('payments')
          .select('status, mpesa_receipt_number, result_desc')
          .eq('id', pid)
          .maybeSingle();

        if (!payment) return;

        if (payment.status === 'completed') {
          stopPolling();
          setReceiptNumber(payment.mpesa_receipt_number || '');
          setPayStatus('success');
        } else if (payment.status === 'failed') {
          stopPolling();
          setPayStatus('failed');
          setErrorMsg(payment.result_desc || 'Payment was unsuccessful. Please try again.');
        } else if (payment.status === 'cancelled') {
          stopPolling();
          setPayStatus('cancelled');
          setErrorMsg('Payment was cancelled. You can try again.');
        }
        // if still 'pending', continue polling
      } catch (err) {
        console.error('[Subscription] Polling error:', err);
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Validate phone ──
  const validatePhone = (val: string): boolean => {
    const cleaned = val.replace(/[\s\-()]/g, '').replace(/^\+/, '');
    const normalized = cleaned.startsWith('0')
      ? '254' + cleaned.slice(1)
      : cleaned.startsWith('254') ? cleaned : '254' + cleaned;
    if (normalized.length !== 12) {
      setPhoneError('Enter a valid Kenyan phone number (e.g. 0712 345678)');
      return false;
    }
    setPhoneError('');
    return true;
  };

  // ── Initiate payment ──
  const handlePay = async () => {
    if (!selectedPlan) return;
    if (!validatePhone(phone)) return;

    setPayStatus('sending');
    setErrorMsg('');

    const amount = billingCycle === 'annual'
      ? selectedPlan.price_annual
      : selectedPlan.price_term;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setPayStatus('failed'); setErrorMsg('Session expired. Please log in again.'); return; }

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payhero-stk-push`;
      const res = await fetch(fnUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            phone,
            amount,
            plan_name:    selectedPlan.name,
            plan_id:      selectedPlan.id,
            billing_cycle: billingCycle,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || data.error) {
        setPayStatus('failed');
        setErrorMsg(data.error || 'Failed to initiate payment. Please try again.');
        return;
      }

      if (data.payment_id) {
        setPaymentId(data.payment_id);
        startPolling(data.payment_id);
      } else {
        // No payment_id — still show polling state and user manually refreshes
        setPayStatus('polling');
      }

    } catch (err) {
      console.error('[Subscription] handlePay error:', err);
      setPayStatus('failed');
      setErrorMsg('Network error. Please check your connection and try again.');
    }
  };

  const handleRetry = () => {
    setPayStatus('idle');
    setErrorMsg('');
    setPaymentId(null);
    setReceiptNumber('');
  };

  const price = selectedPlan
    ? billingCycle === 'annual' ? selectedPlan.price_annual : selectedPlan.price_term
    : 0;

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 md:p-6">

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-5 rounded-full" style={{ background: '#1e3a5f' }} />
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#1e3a5f]">Subscription</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Manage Your Plan</h1>
        <p className="text-slate-500 text-sm mt-0.5">Choose a plan that fits your school's needs</p>
      </div>

      {/* ── Current subscription banner ── */}
      {!subLoading && currentSub && (
        <div className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${
          currentSub.is_active
            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
            : currentSub.in_grace_period
            ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20'
            : 'bg-red-50 border-red-200 dark:bg-red-900/20'
        }`}>
          <div className="flex items-center gap-3">
            {currentSub.is_active ? (
              <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
            ) : (
              <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
            )}
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {currentSub.plan_name} Plan
                {currentSub.in_grace_period && ' (Grace Period)'}
                {!currentSub.is_active && !currentSub.in_grace_period && ' (Expired)'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentSub.is_active
                  ? `Active · Expires ${new Date(currentSub.expiry).toLocaleDateString('en-KE', { dateStyle: 'long' })} · ${currentSub.days_remaining} days remaining`
                  : currentSub.in_grace_period
                  ? `Grace period ends ${new Date(currentSub.grace_ends_at).toLocaleDateString('en-KE', { dateStyle: 'long' })}`
                  : 'Your subscription has expired. Renew to restore full access.'
                }
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 hidden sm:block">
            <div>{currentSub.students_used} / {currentSub.student_limit === 999999 ? '∞' : currentSub.student_limit} students</div>
            <div>{currentSub.teachers_used} / {currentSub.teacher_limit === 999999 ? '∞' : currentSub.teacher_limit} teachers</div>
          </div>
        </div>
      )}

      {/* ── Billing cycle toggle ── */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-semibold ${billingCycle === 'term' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
          Per Term
        </span>
        <button
          onClick={() => setBillingCycle(c => c === 'term' ? 'annual' : 'term')}
          className={`relative w-12 h-6 rounded-full transition-colors ${billingCycle === 'annual' ? 'bg-[#1e3a5f]' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${billingCycle === 'annual' ? 'translate-x-6' : ''}`} />
        </button>
        <span className={`text-sm font-semibold ${billingCycle === 'annual' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
          Annual
          <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Save 10%</span>
        </span>
      </div>

      {/* ── Plan cards ── */}
      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map(plan => {
          const Icon     = plan.icon;
          const isActive = selectedPlan?.id === plan.id;
          const planPrice = billingCycle === 'annual' ? plan.price_annual : plan.price_term;
          return (
            <motion.div
              key={plan.id}
              whileHover={{ y: -2 }}
              onClick={() => { setSelectedPlan(plan); setPayStatus('idle'); setErrorMsg(''); }}
              className={`relative rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                isActive
                  ? 'shadow-lg ring-2'
                  : 'hover:shadow-md'
              }`}
              style={{
                borderColor: isActive ? plan.color : plan.border,
                background:  isActive ? plan.bg : undefined,
                ringColor:   plan.color,
              }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-black px-3 py-1 rounded-full text-white whitespace-nowrap"
                    style={{ background: plan.color }}>
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: plan.bg, border: `1.5px solid ${plan.border}` }}>
                  <Icon size={18} style={{ color: plan.color }} />
                </div>
                {isActive && (
                  <CheckCircle size={18} style={{ color: plan.color }} />
                )}
              </div>

              <h3 className="font-black text-lg text-slate-900 dark:text-white mb-0.5">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-2xl font-black" style={{ color: plan.color }}>
                  KES {planPrice.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 ml-1">
                  / {billingCycle === 'annual' ? 'year' : 'term'}
                </span>
              </div>

              <div className="space-y-1.5 mb-4">
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <CheckCircle size={11} className="mt-0.5 flex-shrink-0" style={{ color: plan.color }} />
                    {f}
                  </div>
                ))}
              </div>

              <button
                onClick={e => { e.stopPropagation(); setSelectedPlan(plan); setPayStatus('idle'); setErrorMsg(''); }}
                className="w-full py-2 rounded-xl text-sm font-bold transition-all text-white"
                style={{ background: plan.color }}
              >
                {isActive ? 'Selected ✓' : 'Select Plan'}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* ── Payment panel ── */}
      <AnimatePresence mode="wait">
        {selectedPlan && payStatus !== 'success' && (
          <motion.div
            key="payment-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Complete Payment</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedPlan.name} Plan · {billingCycle === 'annual' ? 'Annual' : 'Per Term'} · KES {price.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-[#1e3a5f]">KES {price.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">M-Pesa Payment</div>
              </div>
            </div>

            {/* Phone input */}
            {(payStatus === 'idle' || payStatus === 'failed' || payStatus === 'cancelled') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    M-Pesa Phone Number
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => { setPhone(e.target.value); setPhoneError(''); }}
                      placeholder="0712 345 678"
                      className={`w-full pl-9 pr-4 py-3 text-sm rounded-xl border focus:outline-none focus:ring-1 transition-colors ${
                        phoneError
                          ? 'border-red-300 focus:border-red-400 focus:ring-red-400'
                          : 'border-slate-200 dark:border-slate-700 focus:border-[#1e3a5f] focus:ring-[#1e3a5f]'
                      } bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100`}
                    />
                  </div>
                  {phoneError && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <XCircle size={11} /> {phoneError}
                    </p>
                  )}
                </div>

                {(payStatus === 'failed' || payStatus === 'cancelled') && errorMsg && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                    <XCircle size={14} className="flex-shrink-0 mt-0.5" />
                    {errorMsg}
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                  <Shield size={14} className="flex-shrink-0" />
                  <span>Payments are processed securely via M-Pesa STK Push. You will receive a PIN prompt on your phone.</span>
                </div>

                <button
                  onClick={handlePay}
                  disabled={!phone.trim()}
                  className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  style={{ background: selectedPlan.color }}
                >
                  <CreditCard size={16} />
                  Pay KES {price.toLocaleString()} via M-Pesa
                </button>
              </div>
            )}

            {/* Sending state */}
            {payStatus === 'sending' && (
              <div className="text-center py-8 space-y-3">
                <Loader2 size={36} className="animate-spin mx-auto text-[#1e3a5f]" />
                <p className="font-semibold text-slate-800 dark:text-slate-100">Sending M-Pesa prompt…</p>
                <p className="text-xs text-slate-400">Please wait while we contact PayHero</p>
              </div>
            )}

            {/* Polling state */}
            {payStatus === 'polling' && (
              <div className="text-center py-8 space-y-4">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="w-16 h-16 rounded-full border-4 border-green-100 flex items-center justify-center">
                    <Phone size={24} className="text-green-600" />
                  </div>
                  <Loader2 size={16} className="animate-spin absolute -top-1 -right-1 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Check your phone!</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Enter your <strong>M-Pesa PIN</strong> to complete payment of <strong>KES {price.toLocaleString()}</strong>
                  </p>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <RefreshCw size={11} className="animate-spin" />
                  Waiting for confirmation…
                </div>
                <button
                  onClick={handleRetry}
                  className="text-xs text-slate-400 underline hover:text-slate-600 mt-2"
                >
                  Cancel and try again
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Success state ── */}
        {payStatus === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-green-200 dark:border-green-800 p-8 text-center shadow-sm"
          >
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">Payment Successful!</h2>
            <p className="text-slate-500 text-sm mb-4">
              Your <strong>{selectedPlan?.name}</strong> plan has been activated.
            </p>
            {receiptNumber && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold mb-4">
                <CheckCircle size={14} />
                M-Pesa Receipt: {receiptNumber}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-4 mb-6 text-left">
              {[
                { icon: Calendar, label: 'Duration', value: billingCycle === 'annual' ? '12 months' : '4 months' },
                { icon: Users,    label: 'Students',  value: selectedPlan?.student_limit === 999999 ? 'Unlimited' : String(selectedPlan?.student_limit) },
                { icon: BookOpen, label: 'Teachers',  value: selectedPlan?.teacher_limit === 999999 ? 'Unlimited' : String(selectedPlan?.teacher_limit) },
                { icon: TrendingUp, label: 'Plan',    value: selectedPlan?.name || '' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <Icon size={14} className="text-slate-400 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400">{label}</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{value}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2"
              style={{ background: '#1e3a5f' }}
            >
              Go to Dashboard <ChevronRight size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Payment history ── */}
      <PaymentHistory schoolId={user?.school_id} />
    </div>
  );
}

/* ─── Payment History component ──────────────────────────────────────────── */
function PaymentHistory({ schoolId }: { schoolId?: any }) {
  const [payments, setPayments]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('payments')
        .select('id,plan_name,amount,status,billing_cycle,mpesa_receipt_number,phone_number,created_at')
        .eq('school_id', Number(schoolId))
        .order('created_at', { ascending: false })
        .limit(10);
      setPayments(data || []);
      setLoading(false);
    };
    fetch();
  }, [schoolId]);

  if (loading) return null;
  if (!payments.length) return null;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      completed: 'bg-green-100 text-green-700',
      pending:   'bg-amber-100 text-amber-700',
      failed:    'bg-red-100 text-red-700',
      cancelled: 'bg-slate-100 text-slate-500',
    };
    return map[s] || 'bg-slate-100 text-slate-500';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4">Payment History</h3>
      <div className="space-y-2">
        {payments.map(p => (
          <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.plan_name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusBadge(p.status)}`}>
                  {p.status}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {new Date(p.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                {p.mpesa_receipt_number && ` · ${p.mpesa_receipt_number}`}
                {p.phone_number && ` · ${p.phone_number}`}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                KES {Number(p.amount).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 capitalize">{p.billing_cycle}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}