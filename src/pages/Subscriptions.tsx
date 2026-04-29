import React, { useState, useEffect } from 'react';
import { Check, Shield, Zap, Crown, Settings, X, Save, AlertCircle } from 'lucide-react';
import { useAuth } from '../useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface Plan {
  id: number;
  name: string;
  price_kes: number;
  student_limit: number;
  teacher_limit: number;
  features: string[];
  is_active: boolean;
  description: string;
  active_schools?: number;
}

const Subscriptions = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPlans = React.useCallback(async () => {
    try {
      const { data: plans, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_kes', { ascending: true })

      if (error) {
        console.error('Plans error:', error.message)
        throw error
      }
      setPlans(plans || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchPlans());
  }, [fetchPlans]);

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('subscription_plans')
        .update({
          name: editingPlan.name,
          price_kes: editingPlan.price_kes,
          student_limit: editingPlan.student_limit,
          teacher_limit: editingPlan.teacher_limit,
          features: editingPlan.features,
          is_active: editingPlan.is_active,
          description: editingPlan.description
        })
        .eq('id', editingPlan.id);
        
      if (updateError) throw updateError;
      
      setEditingPlan(null);
      fetchPlans();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update plan';
      setError(msg);
      console.error('Update plan error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <Navigate to="/login" />;
  const normalizedRole = user.role.toLowerCase();
  const isSuperAdmin = normalizedRole === 'superadmin' || normalizedRole === 'super_admin' || normalizedRole.includes('super');
  const isAdmin = normalizedRole === 'admin' || normalizedRole === 'principal';

  if (!isSuperAdmin && !isAdmin) return <Navigate to="/" />;

  const getIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'basic': return Shield;
      case 'standard': return Zap;
      case 'premium': return Crown;
      default: return Shield;
    }
  };

  const getColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'basic': return 'bg-slate-100 text-slate-600';
      case 'standard': return 'bg-blue-100 text-blue-600';
      case 'premium': return 'bg-amber-100 text-amber-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto">
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Platform Subscriptions</h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto italic">
          Scalable pricing models designed to empower every educator in the EduNexa network.
        </p>
      </header>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2 border border-red-100">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const Icon = getIcon(plan.name);
          const colorClass = getColor(plan.name);
          const isPopular = plan.name === 'Standard';

          return (
            <div key={plan.id} className={`bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col ${
              isPopular ? 'border-blue-500 ring-4 ring-blue-500/5' : ''
            } ${!plan.is_active ? 'opacity-60 grayscale' : ''}`}>
              {!plan.is_active && (
                <div className="absolute top-4 right-4 bg-slate-900 text-white text-[8px] px-2 py-1 rounded font-bold uppercase tracking-widest">
                  Inactive
                </div>
              )}
              
              {isPopular && (
                <div className="absolute top-8 -right-12 bg-blue-600 text-white py-1 px-12 rotate-45 text-[10px] font-black uppercase tracking-widest">
                  Most Popular
                </div>
              )}
              
              <div className={`w-14 h-14 rounded-2xl ${colorClass} flex items-center justify-center mb-6`}>
                <Icon size={28} />
              </div>

              <div className="mb-8">
                <div className="flex justify-between items-start">
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{plan.name}</h3>
                  {(user.role.toLowerCase().includes('super')) && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                      {plan.active_schools || 0} Schools
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">KES {(plan.price_kes || 0).toLocaleString()}</span>
                  <span className="text-slate-400 font-bold">/ term</span>
                </div>
                <p className="text-slate-500 text-sm mt-4 leading-relaxed line-clamp-2">
                  {plan.description}
                </p>
              </div>

              <div className="space-y-4 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Limits & Features:</p>
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 text-blue-600 p-1 rounded-full">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-medium text-slate-600 tracking-tight">
                    Up to {(plan.student_limit || 0).toLocaleString()} Students
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 text-blue-600 p-1 rounded-full">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-medium text-slate-600 tracking-tight">
                    {(plan.teacher_limit || 0).toLocaleString()} Teachers
                  </span>
                </div>
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="bg-emerald-50 text-emerald-600 p-1 rounded-full">
                      <Check size={12} strokeWidth={3} />
                    </div>
                    <span className="text-sm font-medium text-slate-600 tracking-tight">{feature}</span>
                  </div>
                ))}
              </div>

              {user.role.toLowerCase().includes('super') && (
                <button 
                  onClick={() => setEditingPlan(plan)}
                  className={`w-full py-4 rounded-2xl font-bold mt-12 transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                    isPopular ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Settings size={18} />
                  Configure Plan
                </button>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {editingPlan && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">Configure {editingPlan.name} Plan</h3>
                  <p className="text-slate-400 text-sm mt-1">Manage pricing and platform constraints.</p>
                </div>
                <button onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdatePlan} className="p-8 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Plan Name</label>
                    <input 
                      required
                      value={editingPlan.name}
                      onChange={(e) => setEditingPlan({...editingPlan, name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Price (KES)</label>
                    <input 
                      required
                      type="number"
                      value={editingPlan.price_kes}
                      onChange={(e) => setEditingPlan({...editingPlan, price_kes: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Student Limit</label>
                    <input 
                      required
                      type="number"
                      value={editingPlan.student_limit}
                      onChange={(e) => setEditingPlan({...editingPlan, student_limit: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Teacher Limit</label>
                    <input 
                      required
                      type="number"
                      value={editingPlan.teacher_limit}
                      onChange={(e) => setEditingPlan({...editingPlan, teacher_limit: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Description</label>
                  <textarea 
                    value={editingPlan.description}
                    onChange={(e) => setEditingPlan({...editingPlan, description: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Features (One per line)</label>
                  <textarea 
                    value={editingPlan.features.join('\n')}
                    onChange={(e) => setEditingPlan({...editingPlan, features: e.target.value.split('\n').filter(f => f.trim())})}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none"
                    placeholder="Feature 1&#10;Feature 2"
                  />
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <input 
                    type="checkbox"
                    id="plan-active"
                    checked={editingPlan.is_active}
                    onChange={(e) => setEditingPlan({...editingPlan, is_active: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="plan-active" className="text-sm font-bold text-slate-700 cursor-pointer">
                    Plan is currently active and visible to schools
                  </label>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl"
                  >
                    {saving ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><Save size={20} /> Save Platform Changes</>}
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

export default Subscriptions;
