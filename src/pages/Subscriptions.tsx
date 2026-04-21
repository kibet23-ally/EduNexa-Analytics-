import React from 'react';
import { Check, Shield, Zap, Crown } from 'lucide-react';

const Subscriptions = () => {
  const tiers = [
    {
      name: 'Basic',
      price: '$49',
      icon: Shield,
      color: 'bg-slate-100 text-slate-600',
      features: [
        'Up to 200 Students',
        'Teacher Management',
        'Mark Entry System',
        'Basic PDF Reports',
        'Email Support'
      ],
      description: 'Ideal for small schools starting their digital journey.'
    },
    {
      name: 'Standard',
      price: '$99',
      icon: Zap,
      color: 'bg-blue-100 text-blue-600',
      popular: true,
      features: [
        'Up to 1000 Students',
        'Advanced Analytics',
        'Automated Transcripts',
        'Parent Login Portal',
        'Priority Chat Support'
      ],
      description: 'Perfect for growing growing institutions.'
    },
    {
      name: 'Premium',
      price: '$199',
      icon: Crown,
      color: 'bg-amber-100 text-amber-600',
      features: [
        'Unlimited Students',
        'Custom Domain Support',
        'API Access',
        'White-label Branding',
        '24/7 Dedicated Manager'
      ],
      description: 'Built for large chains and enterprise institutions.'
    }
  ];

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto">
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Platform Subscriptions</h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto italic">
          Scalable pricing models designed to empower every educator in the EduNexa network.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiers.map((tier) => (
          <div key={tier.name} className={`bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col ${
            tier.popular ? 'border-blue-500 ring-4 ring-blue-500/5' : ''
          }`}>
            {tier.popular && (
              <div className="absolute top-8 -right-12 bg-blue-600 text-white py-1 px-12 rotate-45 text-[10px] font-black uppercase tracking-widest">
                Most Popular
              </div>
            )}
            
            <div className={`w-14 h-14 rounded-2xl ${tier.color} flex items-center justify-center mb-6`}>
              <tier.icon size={28} />
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{tier.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-black text-slate-900">{tier.price}</span>
                <span className="text-slate-400 font-bold">/ month</span>
              </div>
              <p className="text-slate-500 text-sm mt-4 leading-relaxed">
                {tier.description}
              </p>
            </div>

            <div className="space-y-4 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">What is included:</p>
              {tier.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="bg-emerald-50 text-emerald-600 p-1 rounded-full">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-medium text-slate-600 tracking-tight">{feature}</span>
                </div>
              ))}
            </div>

            <button className={`w-full py-4 rounded-2xl font-bold mt-12 transition-all active:scale-[0.98] ${
              tier.popular ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}>
              Configure Plan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Subscriptions;
