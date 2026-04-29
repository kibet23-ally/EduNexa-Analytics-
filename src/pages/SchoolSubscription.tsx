import React, { useState, useEffect } from 'react';
import { fetchWithProxy } from '../lib/fetchProxy';
import { School, Plan } from '../types';
import { 
  Check, 
  AlertCircle, 
  Calendar, 
  ShieldCheck, 
  Loader2,
  Users,
  UserCheck,
  Zap,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SchoolWithUsage extends School {
  usage: {
    students: number;
    teachers: number;
  },
  plan?: {
    student_limit: number;
    teacher_limit: number;
    name?: string;
  },
  subscription_expiry_date?: string;
  subscription_end_date?: string;
  expiry_date?: string;
}

const SchoolSubscription = () => {
  const [school, setSchool] = useState<SchoolWithUsage | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradingPlan, setUpgradingPlan] = useState<Plan | null>(null);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [paying, setPaying] = useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch plans
      const plansRes = await fetchWithProxy('subscription_plans', { 
        orderBy: { column: 'price_kes', ascending: true } 
      });
      const plansData = plansRes.data || [];
      setPlans(plansData);

      // 2. Fetch my school info
      const schoolsRes = await fetchWithProxy('schools');
      const schoolData = Array.isArray(schoolsRes.data) ? schoolsRes.data[0] : schoolsRes.data;
      
      if (!schoolData) throw new Error("School information not found.");

      // 3. Fetch usage counts
      const [studentsRes, teachersRes] = await Promise.all([
        fetchWithProxy('students', { countOnly: true }),
        fetchWithProxy('teachers', { countOnly: true })
      ]);

      // 4. Fetch current plan limits
      const planName = schoolData.subscription_plan || schoolData.subscription_tier || 'Basic';
      const currentPlanRes = await fetchWithProxy('subscription_plans', {
        filters: { name: planName },
        single: true
      });
      const currentPlanData = currentPlanRes.data;

      setSchool({
        ...schoolData,
        usage: {
          students: studentsRes.count || 0,
          teachers: teachersRes.count || 0
        },
        plan: currentPlanData || undefined
      });

    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load subscription details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => { await fetchData(); };
    load();
  }, [fetchData]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mpesaPhone.match(/^(254|0)(7|1)\d{8}$/)) {
      alert('Please enter a valid Kenyan phone number');
      return;
    }
    setPaying(true);
    // Simulate STK Push
    setTimeout(() => {
      setPaying(false);
      alert('STK Push sent! Please check your phone to complete the transaction.');
      setUpgradingPlan(null);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p className="text-slate-500 font-medium animate-pulse">Loading your subscription details...</p>
      </div>
    );
  }

  if (error && plans.length === 0) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-2xl flex flex-col items-center gap-4 text-center">
        <AlertCircle className="text-red-500" size={48} />
        <div>
          <h3 className="text-lg font-bold text-red-900">Subscription Error</h3>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
        <button 
          onClick={() => fetchData()}
          className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const currentPlan = (school && Array.isArray(plans)) ? plans.find(p => p.name === (school.subscription_plan || school.subscription_tier || 'Basic')) : null;
  const isTrial = school?.subscription_status === 'Trial';

  if (!loading && plans.length === 0 && !error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center bg-white rounded-3xl border border-slate-100">
        <div className="bg-slate-50 p-6 rounded-full">
          <ShieldCheck className="text-slate-300" size={64} />
        </div>
        <div className="max-w-md">
          <h3 className="text-xl font-black text-slate-900">No Plans Available</h3>
          <p className="text-slate-500 mt-2 font-medium">We couldn't find any subscription plans at the moment. Please contact support or try again later.</p>
        </div>
        <button 
          onClick={() => fetchData()}
          className="mt-4 bg-slate-900 text-white px-8 py-3 rounded-2xl font-black hover:bg-primary transition-all active:scale-95"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            {school?.name || 'School'} Subscription
            {isTrial && (
              <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1 rounded-full font-black border border-amber-200 flex items-center gap-1">
                <Zap size={12} fill="currentColor" /> FREE TRIAL
              </span>
            )}
          </h1>
          <p className="text-slate-500 font-medium mt-1">Manage your plan, limits and payments</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Plan Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-600/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <ShieldCheck size={120} strokeWidth={1} />
            </div>
            
            <div className="relative z-10">
              <span className="bg-white/20 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-white/20">
                Current Active Plan
              </span>
              <h2 className="text-4xl font-black mt-4">{school?.subscription_plan || school?.subscription_tier || 'Basic'}</h2>
              
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Plan Status</p>
                    <p className="font-bold">{school?.subscription_status || 'Active'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Activation Date</p>
                    <p className="font-bold">
                      {school?.subscription_activation_date || school?.created_at
                        ? new Date(school.subscription_activation_date || school.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) 
                        : 'Not Activated'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Expiry Date</p>
                    <div className="flex flex-col">
                      <p className="font-bold">
                        {(() => {
                          const expiryDate = school?.expiry_date || school?.subscription_end_date || school?.subscription_expiry_date;
                          if (expiryDate) {
                            return new Date(expiryDate).toLocaleDateString('en-KE', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            });
                          }
                          return 'No expiry set - contact admin';
                        })()}
                      </p>
                      {(() => {
                        const expiryDate = school?.expiry_date || school?.subscription_end_date || school?.subscription_expiry_date;
                        if (!expiryDate) return null;
                        
                        const now = new Date();
                        const expiry = new Date(expiryDate);
                        const diffTime = expiry.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays < 0) {
                          return <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded mt-1 font-black uppercase">Subscription Expired - Please Renew</span>;
                        } else if (diffDays <= 30) {
                          return <span className="bg-orange-500 text-white text-[9px] px-2 py-0.5 rounded mt-1 font-black uppercase">Expires Soon</span>;
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Metrics */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 space-y-6 shadow-sm">
            <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Resource Usage</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-500 flex items-center gap-2">
                  <Users size={16} /> Students
                </span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {school?.usage?.students || 0} / {(school?.subscription_plan || school?.subscription_tier) === 'Premium' ? 'Unlimited' : (school?.plan?.student_limit || currentPlan?.student_limit || 100)}
                </span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ 
                    width: (school?.subscription_plan || school?.subscription_tier) === 'Premium' 
                      ? '100%' 
                      : `${Math.min(100, ((school?.usage?.students || 0) / (school?.plan?.student_limit || currentPlan?.student_limit || 100)) * 100)}%` 
                  }}
                  className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-500 flex items-center gap-2">
                  <UserCheck size={16} /> Teachers
                </span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {school?.usage?.teachers || 0} / {(school?.subscription_plan || school?.subscription_tier) === 'Premium' ? 'Unlimited' : (school?.plan?.teacher_limit || currentPlan?.teacher_limit || 10)}
                </span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ 
                    width: (school?.subscription_plan || school?.subscription_tier) === 'Premium' 
                      ? '100%' 
                      : `${Math.min(100, ((school?.usage?.teachers || 0) / (school?.plan?.teacher_limit || currentPlan?.teacher_limit || 10)) * 100)}%` 
                  }}
                  className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Upgrade Plans Grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.isArray(plans) && plans.length > 0 ? plans.map((plan) => (
              <div 
                key={plan.id}
                className={`bg-white dark:bg-slate-900 border ${school && plan.name === (school.subscription_plan || school.subscription_tier || 'Basic') ? 'border-primary ring-4 ring-primary/10' : 'border-slate-100 dark:border-slate-800 shadow-sm'} rounded-3xl p-8 flex flex-col transition-all hover:shadow-xl hover:shadow-slate-200/50 group`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white capitalize">{plan.name}</h3>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Plan Details</p>
                  </div>
                  {school && plan.name === (school.subscription_plan || school.subscription_tier || 'Basic') && (
                    <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-emerald-100">
                      Active
                    </div>
                  )}
                </div>

                <div className="mb-8 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900 dark:text-white leading-none">
                    KES {(plan.price_kes || 0).toLocaleString()}
                  </span>
                  <span className="text-slate-400 font-bold text-sm">/ term</span>
                </div>

                <div className="flex-1 space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-1.5 rounded-full">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-tight">
                       Up to {(plan.student_limit || 0).toLocaleString()} Students
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-1.5 rounded-full">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-tight">
                       {(plan.teacher_limit || 0).toLocaleString()} Teachers
                    </span>
                  </div>
                  {Array.isArray(plan.features) && plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-1.5 rounded-full">
                        <Check size={14} strokeWidth={3} />
                      </div>
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-tight">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  disabled={school ? (plan.name === (school.subscription_plan || school.subscription_tier || 'Basic')) : false}
                  onClick={() => setUpgradingPlan(plan)}
                  className={`w-full py-4 rounded-2xl font-black text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
                    school && (plan.name === (school.subscription_plan || school.subscription_tier || 'Basic')) 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-900 text-white hover:bg-primary hover:shadow-lg hover:shadow-primary/20 active:scale-95'
                  }`}
                >
                  {school && (plan.name === (school.subscription_plan || school.subscription_tier || 'Basic')) ? 'Current Plan' : 'Select Plan'}
                </button>
              </div>
            )) : (
              <div className="col-span-2 py-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-3xl">
                Fetching available plans...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* M-Pesa Payment Modal */}
      <AnimatePresence>
        {upgradingPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !paying && setUpgradingPlan(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-emerald-600 p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Phone size={120} strokeWidth={1} />
                </div>
                <h3 className="text-2xl font-black relative z-10 flex items-center gap-3">
                   M-Pesa Payment
                </h3>
                <p className="text-emerald-100 font-bold text-sm relative z-10">Safe & Instant Activation</p>
              </div>

              <form onSubmit={handlePayment} className="p-8 space-y-6">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Plan Selection</p>
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                      {upgradingPlan.name}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-black text-slate-900">KES {upgradingPlan.price_kes.toLocaleString()}</p>
                    <p className="text-slate-400 font-bold text-sm">/ term</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                    Enter M-Pesa Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Phone size={18} />
                    </div>
                    <input
                      required
                      type="tel"
                      placeholder="e.g. 0712 345 678"
                      value={mpesaPhone}
                      onChange={(e) => setMpesaPhone(e.target.value)}
                      disabled={paying}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 italic ml-1">* STK Push will be sent to this number</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={paying}
                    onClick={() => setUpgradingPlan(null)}
                    className="flex-1 py-4 rounded-2xl font-black text-slate-400 uppercase tracking-widest text-xs hover:bg-slate-50 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={paying}
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {paying ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Processing...
                      </>
                    ) : (
                      <>
                        Pay KES {upgradingPlan.price_kes.toLocaleString()}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SchoolSubscription;
