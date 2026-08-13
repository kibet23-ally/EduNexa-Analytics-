import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Menu, X, ArrowRight, BookOpen, ClipboardList, Shield,
  Smartphone, BarChart3, CheckCircle, Users, Sparkles, Star, Zap,
  TrendingUp, Globe, Award, ChevronDown, Brain, Lock,
  Mail, Phone, MapPin, Twitter, Linkedin, Facebook
} from 'lucide-react';

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [billing, setBilling] = useState<'termly' | 'yearly'>('termly');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ---------- Premium Dashboard Mock ---------- */
  const DashboardMock = () => (
    <div className="relative w-full">
      {/* Glow */}
      <div className="absolute -inset-6 bg-gradient-to-tr from-blue-500/30 via-indigo-500/20 to-cyan-400/30 blur-3xl rounded-[40px]" />
      {/* Floating cards */}
      <div className="absolute -left-6 top-12 z-20 hidden sm:block animate-[float_6s_ease-in-out_infinite]">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl p-4 w-56">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <TrendingUp className="text-white" size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Attendance</p>
              <p className="text-lg font-bold text-slate-900">96.4%</p>
            </div>
            <span className="ml-auto text-xs text-emerald-600 font-semibold">+2.1%</span>
          </div>
        </div>
      </div>

      <div className="absolute -right-4 bottom-8 z-20 hidden sm:block animate-[float_7s_ease-in-out_infinite_1s]">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl p-4 w-60">
          <p className="text-xs text-slate-500 mb-2">New enrollments</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-slate-900">1,284</p>
            <span className="text-xs text-blue-600 font-semibold mb-1">this term</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full w-3/4 bg-gradient-to-r from-blue-500 to-indigo-500" />
          </div>
        </div>
      </div>

      {/* Main dashboard */}
      <div className="relative z-10 bg-white/80 backdrop-blur-2xl border border-white/60 shadow-2xl rounded-3xl overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-white/70">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="text-[11px] text-slate-400 font-medium">edunexa.app/dashboard</div>
          <div className="w-12" />
        </div>

        <div className="grid grid-cols-12 gap-4 p-5">
          {/* Sidebar */}
          <div className="col-span-3 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <GraduationCap className="text-white" size={14} />
              </div>
              <span className="text-xs font-bold text-slate-800">EduNexa</span>
            </div>
            {['Overview', 'Students', 'Teachers', 'Exams', 'Reports'].map((label, i) => (
              <div
                key={label}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] ${
                  i === 0 ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-500'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-blue-600' : 'bg-slate-300'}`} />
                {label}
              </div>
            ))}
          </div>

          {/* Main panel */}
          <div className="col-span-9 space-y-3">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: 'Students', v: '2,847', c: 'from-blue-500 to-indigo-500' },
                { l: 'Teachers', v: '184', c: 'from-cyan-500 to-blue-500' },
                { l: 'Avg Score', v: '78%', c: 'from-emerald-500 to-teal-500' },
              ].map((k) => (
                <div key={k.l} className="rounded-xl border border-slate-100 p-3 bg-white">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">{k.l}</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{k.v}</p>
                  <div className={`mt-2 h-1 w-full rounded-full bg-gradient-to-r ${k.c} opacity-80`} />
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="rounded-xl border border-slate-100 p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-700">Performance Trend</p>
                <span className="text-[10px] text-slate-400">Last 6 months</span>
              </div>
              <div className="relative h-28">
                <svg viewBox="0 0 300 100" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,70 C40,55 60,80 90,60 C120,40 150,55 180,35 C210,20 240,40 270,25 L300,20 L300,100 L0,100 Z"
                    fill="url(#lg)"
                  />
                  <path
                    d="M0,70 C40,55 60,80 90,60 C120,40 150,55 180,35 C210,20 240,40 270,25 L300,20"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="flex items-end gap-1.5 h-16 mt-2">
                {[40, 65, 50, 75, 55, 85, 70, 90, 60, 95, 80, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-400 to-blue-500 opacity-80"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );

  /* ---------- Data ---------- */
  const features = [
    { icon: Users, title: 'Student Management', desc: 'Complete profiles, enrollment, attendance, and academic history in one unified hub.', color: 'from-blue-500 to-indigo-600' },
    { icon: BookOpen, title: 'Teacher Portal', desc: 'Assign classes, track workload, and empower staff with intuitive tools.', color: 'from-cyan-500 to-blue-600' },
    { icon: ClipboardList, title: 'Exams & Grading', desc: 'CBC-compliant rubrics, auto-grading, and beautiful report cards.', color: 'from-emerald-500 to-teal-600' },
    { icon: BarChart3, title: 'Smart Analytics', desc: 'Real-time dashboards with predictive insights into performance and trends.', color: 'from-violet-500 to-purple-600' },
    { icon: Shield, title: 'Enterprise Security', desc: 'Row-level security, role-based access, and end-to-end encryption.', color: 'from-rose-500 to-pink-600' },
    { icon: Smartphone, title: 'Mobile First', desc: 'Pixel-perfect experience across phone, tablet, and desktop.', color: 'from-amber-500 to-orange-600' },
  ];

  const stats = [
    { v: '20+', l: 'Schools' },
    { v: '10K+', l: 'Students' },
    { v: '99.9%', l: 'Uptime' },
    { v: '4.9/5', l: 'Rating' },
  ];

  const testimonials = [
    { name: 'Dr. Janet Mwangi', role: 'Principal, Brookside Academy', quote: 'EduNexa transformed how we manage operations. Reports that took days now take minutes.', initials: 'JM' },
    { name: 'Samuel Otieno', role: 'Director, Riverbank School', quote: 'The analytics dashboard alone is worth it. We finally see the full picture of our school.', initials: 'SO' },
    { name: 'Faith Wanjiru', role: 'Head Teacher, Hillview', quote: 'Parents love the transparency. Teachers love the simplicity. It just works.', initials: 'FW' },
  ];

  const plans = [
    { name: 'Starter', termly: 2500, yearly: 6750, desc: 'For small schools getting started', features: ['Up to 200 students', 'Student & teacher profiles', 'Basic reports', 'Email support'] },
    { name: 'Professional', termly: 5000, yearly: 13500, desc: 'For growing institutions', features: ['Up to 1,000 students', 'Exams & CBC grading', 'Advanced analytics', 'Parent portal', 'Priority support'], highlight: true },
    { name: 'Enterprise', termly: 9000, yearly: 24300, desc: 'For large school networks', features: ['Unlimited students', 'Multi-campus management', 'Custom integrations', 'Dedicated manager', '24/7 phone support'] },
  ];

  const faqs = [
    { q: 'How long does setup take?', a: 'Most schools are fully onboarded within 48 hours. Our team handles data migration end-to-end.' },
    { q: 'Is EduNexa CBC compliant?', a: 'Yes — we fully support the Kenyan CBC curriculum with rubrics, strands, and learner profiles.' },
    { q: 'Can parents access the system?', a: 'Absolutely. Parents get a dedicated portal to view attendance, grades, and announcements.' },
    { q: 'What about data security?', a: 'We use bank-grade encryption, row-level security, and daily backups. Your data is yours alone.' },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* Background aurora */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 -left-40 w-[600px] h-[600px] rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute top-40 -right-40 w-[600px] h-[600px] rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute top-[60%] left-[30%] w-[500px] h-[500px] rounded-full bg-cyan-100/40 blur-3xl" />
      </div>

      {/* NAVBAR */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/80 backdrop-blur-xl shadow-sm border-b border-slate-200/60' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <GraduationCap className="text-white" size={20} />
            </div>
            <span className="text-lg bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">EduNexa</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition">Features</a>
            <a href="#pricing" className="hover:text-slate-900 transition">Pricing</a>
            <a href="#testimonials" className="hover:text-slate-900 transition">Customers</a>
            <a href="#faq" className="hover:text-slate-900 transition">FAQ</a>
            <Link to="/login" className="hover:text-slate-900 transition">Login</Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-800 transition shadow-lg shadow-slate-900/20"
            >
              Get Started <ArrowRight size={14} />
            </Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 px-6 py-4 space-y-3 text-sm font-medium">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block">Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block">Pricing</a>
            <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="block">Customers</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block">FAQ</a>
            <Link to="/login" className="block">Login</Link>
            <Link to="/register" className="block text-blue-600 font-semibold">Get Started →</Link>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="pt-36 pb-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm mb-6">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
              </span>
              <span className="text-xs font-semibold text-slate-700">EduNexa 2.0 — now with AI insights</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              School management,{' '}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                reimagined
              </span>
            </h1>

            <p className="text-lg text-slate-600 mt-6 max-w-xl leading-relaxed">
              The all-in-one platform built for modern schools. Manage students, teachers,
              exams, and analytics beautifully unified in one premium experience.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3.5 rounded-full font-semibold shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:shadow-blue-600/40 hover:-translate-y-0.5 transition-all"
              >
                Start free trial
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-6 text-sm text-slate-500">
              <div className="flex -space-x-2">
                {['from-blue-400 to-blue-600', 'from-indigo-400 to-indigo-600', 'from-cyan-400 to-cyan-600', 'from-emerald-400 to-emerald-600'].map((c, i) => (
                  <div key={i} className={`w-9 h-9 rounded-full bg-gradient-to-br ${c} border-2 border-white shadow`} />
                ))}
              </div>
              <div>
                <div className="flex gap-0.5 text-amber-400">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                </div>
                <p className="text-xs mt-0.5">Trusted by 20+ schools</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 rounded-3xl p-10 grid grid-cols-2 md:grid-cols-4 gap-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-cyan-500/20 rounded-full blur-3xl" />
          {stats.map((s) => (
            <div key={s.l} className="relative text-center md:text-left">
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                {s.v}
              </div>
              <div className="text-sm text-blue-200/80 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Features</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 tracking-tight">
              Everything your school needs
            </h2>
            <p className="text-slate-600 mt-4 text-lg">
              Powerful tools designed to simplify operations and elevate learning outcomes.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative bg-white border border-slate-200 rounded-3xl p-7 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-lg mb-5`}>
                  <f.icon className="text-white" size={22} />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="py-24 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Loved by educators</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 tracking-tight">
              Hear from our customers
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm hover:shadow-xl transition">
                <div className="flex gap-0.5 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                </div>
                <p className="text-slate-700 leading-relaxed">"{t.quote}"</p>
                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Pricing</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-slate-600 mt-4 text-lg">Choose the plan that fits your school. No hidden fees.</p>

            <div className="inline-flex items-center bg-slate-100 rounded-full p-1 mt-8">
              <button
                onClick={() => setBilling('termly')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
                  billing === 'termly' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
                }`}
              >Per Term</button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
                  billing === 'yearly' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
                }`}
              >Yearly <span className="text-emerald-600 text-xs ml-1">−10%</span></button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-3xl p-8 transition ${
                  p.highlight
                    ? 'bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white shadow-2xl scale-105 border border-blue-400/30'
                    : 'bg-white border border-slate-200 hover:shadow-xl'
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className={`text-sm mt-1 ${p.highlight ? 'text-blue-200' : 'text-slate-500'}`}>{p.desc}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-sm">KES</span>
                  <span className="text-5xl font-bold">
                    {(billing === 'termly' ? p.termly : p.yearly).toLocaleString()}
                  </span>
                  <span className={`text-sm ${p.highlight ? 'text-blue-200' : 'text-slate-500'}`}>
                    /{billing === 'termly' ? 'term' : 'yr'}
                  </span>
                </div>
                {billing === 'yearly' && (
                  <p className={`text-xs mt-1 ${p.highlight ? 'text-blue-200' : 'text-slate-400'}`}>
                    Billed once per year, covers all 3 terms
                  </p>
                )}

                <Link
                  to="/register"
                  className={`mt-6 block text-center px-5 py-3 rounded-full font-semibold transition ${
                    p.highlight
                      ? 'bg-white text-slate-900 hover:bg-blue-50'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  Get started
                </Link>

                <ul className="mt-8 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle size={16} className={p.highlight ? 'text-emerald-300 mt-0.5 shrink-0' : 'text-emerald-500 mt-0.5 shrink-0'} />
                      <span className={p.highlight ? 'text-blue-50' : 'text-slate-700'}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
       <section id="faq" className="py-24 px-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">FAQ</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 tracking-tight">Questions, answered</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex justify-between items-center text-left px-6 py-5 hover:bg-slate-50 transition"
                >
                  <span className="font-semibold">{f.q}</span>
                  <ChevronDown
                    size={20}
                    className={`transition-transform shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
       <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-12 md:p-16 text-center text-white shadow-2xl">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-0 w-80 h-80 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-cyan-300/30 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <Sparkles className="mx-auto mb-4" size={32} />
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Ready to modernize your school?</h2>
            <p className="text-blue-100 mt-4 text-lg max-w-xl mx-auto">
              Join 500+ schools already using EduNexa to deliver a better experience for students, teachers, and parents.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link
                to="/register"
                className="bg-white text-slate-900 px-7 py-3.5 rounded-full font-semibold hover:bg-blue-50 transition shadow-xl"
              >
                Start free trial
              </Link>
              <Link
                to="/contact"
                className="bg-white/10 backdrop-blur border border-white/30 text-white px-7 py-3.5 rounded-full font-semibold hover:bg-white/20 transition"
              >
                Talk to sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
       <footer className="bg-slate-950 text-slate-300 px-6 pt-16 pb-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-5 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-bold text-white">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <GraduationCap size={20} />
              </div>
              EduNexa
            </div>
            <p className="text-sm text-slate-400 mt-4 max-w-sm leading-relaxed">
              The modern school management platform built for African schools — premium, secure, and beautifully simple.
            </p>
            <div className="flex gap-3 mt-5">
              {[Twitter, Linkedin, Facebook].map((Icon, i) => (
                <a key={i} href="#" className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <p>© {new Date().getFullYear()} EduNexa. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            All systems operational
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
                