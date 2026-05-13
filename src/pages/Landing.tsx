import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  GraduationCap, Menu, X, ArrowRight, BookOpen, ClipboardList, Shield, Smartphone, Award, TrendingUp, BarChart3, Dot,
  Zap, Users, LineChart, CheckCircle, ArrowUpRight, Sparkles, Globe
} from 'lucide-react';

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Abstract Dashboard Illustration Component
  const DashboardIllustration = () => (
    <div className="relative w-full h-full min-h-96 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-white/40 backdrop-blur-xl shadow-2xl">
      {/* Blurred background elements */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-4 right-4 w-32 h-32 bg-blue-400 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute bottom-4 left-4 w-40 h-40 bg-purple-400 rounded-full blur-3xl opacity-20"></div>
      </div>

      {/* Abstract chart/widget placeholders */}
      <div className="relative p-6 space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="w-24 h-3 bg-gradient-to-r from-blue-300 to-blue-200 rounded-full opacity-60"></div>
          <div className="flex gap-2">
            <div className="w-2 h-2 bg-blue-300 rounded-full opacity-60"></div>
            <div className="w-2 h-2 bg-blue-300 rounded-full opacity-60"></div>
          </div>
        </div>

        {/* Chart area */}
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-1 h-20">
            {[0.4, 0.6, 0.3, 0.8, 0.5, 0.7, 0.9].map((height, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-blue-400 to-blue-300 rounded-t opacity-40 blur-sm"
                style={{ height: `${height * 100}%` }}
              ></div>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/30 backdrop-blur-md p-3 rounded-lg border border-white/20">
              <div className="w-8 h-2 bg-gradient-to-r from-indigo-300 to-indigo-200 rounded-full opacity-50 mb-2"></div>
              <div className="w-12 h-3 bg-gradient-to-r from-blue-300 to-blue-200 rounded-full opacity-40"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Feature Card Component
  const FeatureCard = ({ icon: Icon, title, description, gradient }: {
    icon: React.ElementType; title: string; description: string; gradient: string;
  }) => (
    <div className="group relative h-full">
      {/* Gradient background on hover */}
      <div className={`absolute inset-0 ${gradient} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300 blur-xl`}></div>
      
      <div className="relative bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-8 h-full transition-all duration-300 hover:border-white/80 hover:shadow-xl hover:shadow-blue-500/10">
        <div className={`w-12 h-12 rounded-xl ${gradient} bg-gradient-to-br p-0.5 mb-6 transform transition-transform group-hover:scale-110`}>
          <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
            <Icon size={24} className="text-blue-600" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">{title}</h3>
        <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );

  // Pricing Card Component
  const PricingCard = ({ name, price, description, features, highlighted, currency = 'KES', period = '/term' }: {
    name: string; price: string; description: string; features: string[]; highlighted?: boolean; currency?: string; period?: string;
  }) => (
    <div className={`relative group transition-all duration-300 ${highlighted ? 'lg:scale-105' : ''}`}>
      {highlighted && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
      )}
      <div className={`relative bg-white/50 backdrop-blur-xl border rounded-2xl p-8 h-full transition-all duration-300 ${
        highlighted 
          ? 'border-blue-500/50 shadow-2xl shadow-blue-500/20' 
          : 'border-white/60 hover:border-white/80 hover:shadow-xl'
      }`}>
        {highlighted && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1 rounded-full text-xs font-semibold">
              Most Popular
            </span>
          </div>
        )}
        <h3 className="text-xl font-semibold text-slate-900 mb-2">{name}</h3>
        <p className="text-slate-600 text-sm mb-6">{description}</p>
        <div className="mb-6">
          <span className="text-4xl font-bold text-slate-900">{currency} {price}</span>
          <span className="text-slate-600 text-sm">{period}</span>
        </div>
        <button className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 mb-8 ${
          highlighted
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/30'
            : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
        }`}>
          Get Started
        </button>
        <div className="space-y-4">
          {features.map((feature, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle size={18} className="text-emerald-500 mt-0.5 shrink-0" />
              <span className="text-slate-700 text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Sticky Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-lg shadow-slate-900/5' 
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 text-blue-600 font-bold text-xl">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <GraduationCap size={20} className="text-white" />
              </div>
              <span className="font-poppins">EduNexa</span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-600 hover:text-slate-900 font-medium transition text-sm">Features</a>
              <a href="#how-it-works" className="text-slate-600 hover:text-slate-900 font-medium transition text-sm">How It Works</a>
              <a href="#pricing" className="text-slate-600 hover:text-slate-900 font-medium transition text-sm">Pricing</a>
              <a href="#faq" className="text-slate-600 hover:text-slate-900 font-medium transition text-sm">FAQ</a>
            </div>

            {/* Desktop Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                to="/login"
                className="text-slate-600 hover:text-slate-900 font-medium transition text-sm px-4 py-2"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all text-sm"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-slate-900"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-4 border-t border-white/20">
              <a href="#features" className="block text-slate-600 font-medium py-2">Features</a>
              <a href="#how-it-works" className="block text-slate-600 font-medium py-2">How It Works</a>
              <a href="#pricing" className="block text-slate-600 font-medium py-2">Pricing</a>
              <a href="#faq" className="block text-slate-600 font-medium py-2">FAQ</a>
              <div className="flex flex-col gap-2 pt-4 border-t border-white/20">
                <Link to="/login" className="text-center text-slate-600 font-medium py-2">Log In</Link>
                <Link to="/register" className="text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-lg font-semibold">Get Started</Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-br from-blue-200 to-indigo-200 rounded-full blur-3xl opacity-20 -z-10"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-emerald-200 to-blue-200 rounded-full blur-3xl opacity-10 -z-10"></div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-white/50 backdrop-blur-xl border border-white/60 rounded-full px-4 py-2 w-fit">
                <Sparkles size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-slate-700">Introducing EduNexa 2.0</span>
              </div>

              {/* Heading */}
              <div className="space-y-4">
                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight font-poppins">
                  School Management
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> Reimagined</span>
                </h1>
                <p className="text-lg text-slate-600 leading-relaxed max-w-xl">
                  Streamline student records, teacher management, exams, and analytics with enterprise-grade security and intuitive design. Built for modern schools.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95"
                >
                  Get Started Free <ArrowRight size={20} />
                </Link>
                <button className="inline-flex items-center justify-center gap-2 bg-white/50 backdrop-blur-xl border border-white/60 text-slate-900 px-8 py-4 rounded-xl font-semibold hover:bg-white/70 transition-all">
                  Watch Demo
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                    >
                      {i}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">500+</span> schools trust EduNexa
                </div>
              </div>
            </div>

            {/* Right Content - Dashboard Illustration */}
            <div className="hidden lg:block">
              <DashboardIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 font-poppins">
              Powerful Features for Modern Schools
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Everything you need to manage your school efficiently and effectively
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={Users}
              title="Student Management"
              description="Centralized student records with enrollment tracking, academic progress monitoring, and comprehensive profile management."
              gradient="bg-gradient-to-br from-blue-400 to-blue-600"
            />
            <FeatureCard
              icon={BookOpen}
              title="Teacher Management"
              description="Streamline teacher assignments, schedule management, performance tracking, and professional development records."
              gradient="bg-gradient-to-br from-indigo-400 to-indigo-600"
            />
            <FeatureCard
              icon={ClipboardList}
              title="Exams & Results"
              description="Create and manage exams, record marks, generate result reports, and track academic performance trends."
              gradient="bg-gradient-to-br from-purple-400 to-purple-600"
            />
            <FeatureCard
              icon={BarChart3}
              title="Advanced Analytics"
              description="Real-time dashboards with actionable insights, performance metrics, and data-driven decision-making tools."
              gradient="bg-gradient-to-br from-emerald-400 to-emerald-600"
            />
            <FeatureCard
              icon={Shield}
              title="Enterprise Security"
              description="Bank-level encryption, role-based access control, audit logs, and compliance with international data protection standards."
              gradient="bg-gradient-to-br from-red-400 to-red-600"
            />
            <FeatureCard
              icon={Smartphone}
              title="Mobile First"
              description="Fully responsive design works seamlessly on phones, tablets, and desktops. Access your data anywhere, anytime."
              gradient="bg-gradient-to-br from-orange-400 to-orange-600"
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-white/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 font-poppins">
              Get Started in Minutes
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A simple, straightforward process to get your school up and running
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { number: '01', title: 'Register', description: 'Create your school account with basic information' },
              { number: '02', title: 'Get Approved', description: 'Our team verifies and approves your registration' },
              { number: '03', title: 'Add Data', description: 'Import teachers, students, and academic information' },
              { number: '04', title: 'Start Using', description: 'Begin managing your school operations seamlessly' },
            ].map((step, i) => (
              <div key={i} className="relative group">
                {/* Connector line */}
                {i < 3 && (
                  <div className="hidden md:block absolute top-12 -right-4 w-8 h-0.5 bg-gradient-to-r from-blue-400 to-transparent opacity-50"></div>
                )}
                
                <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-8 h-full hover:border-white/80 transition-all">
                  <div className="text-4xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4 font-poppins">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-slate-600 text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { number: '500+', label: 'Schools Trust Us' },
              { number: '2M+', label: 'Students Managed' },
              { number: '99.9%', label: 'System Uptime' },
              { number: '24/7', label: 'Support Available' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl p-8 text-center hover:border-white/80 transition-all">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2 font-poppins">
                  {stat.number}
                </div>
                <p className="text-slate-600 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-white/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 font-poppins">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Choose the plan that fits your school's needs
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <PricingCard
              name="Basic Plan"
              price="2,500"
              description="Perfect for small schools"
              currency="KES"
              period="/term"
              features={[
                'Up to 150 Students',
                'Up to 10 Teachers',
                'Student Management',
                'Marks Entry',
                'Basic Reports & PDF Export',
                'Attendance Tracking',
                'Email Support',
                '7-Day Grace Period',
              ]}
            />
            <PricingCard
              name="Standard Plan"
              price="5,000"
              description="For growing schools"
              currency="KES"
              period="/term"
              features={[
                'Up to 400 Students',
                'Up to 30 Teachers',
                'All Basic Features',
                'Exam Management',
                'Analytics & Charts',
                'Attendance Reports',
                'Excel & PDF Exports',
                'Teacher Assignments',
                'Priority Email Support',
                '7-Day Grace Period',
              ]}
              highlighted={true}
            />
            <PricingCard
              name="Premium Plan"
              price="9,000"
              description="For large institutions"
              currency="KES"
              period="/term"
              features={[
                'Unlimited Students',
                'Unlimited Teachers',
                'All Standard Features',
                'Advanced Analytics',
                'Custom Report Cards',
                'Multi-Grade Reporting',
                'Performance Trends',
                'Most Improved Student Tracking',
                'Dedicated Support',
                'Annual Discount 10%',
                '7-Day Grace Period',
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
       <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-10 blur-3xl -z-10"></div>

        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 font-poppins">
            Ready to Transform Your School?
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Join 500+ schools already using EduNexa. Start your free 30-day trial today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95"
            >
              Get Started Free <ArrowRight size={20} />
            </Link>
            <button className="inline-flex items-center justify-center gap-2 bg-white/50 backdrop-blur-xl border border-white/60 text-slate-900 px-8 py-4 rounded-xl font-semibold hover:bg-white/70 transition-all">
              Schedule Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-12">
            {/* Brand */}
             <div className="md:col-span-1 space-y-4">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-lg flex items-center justify-center">
                  <GraduationCap size={20} />
                </div>
                <span className="font-poppins">EduNexa</span>
              </div>
              <p className="text-slate-400 text-sm">
                Modern school management for the digital age.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-4 text-white">Product</h4>
              <ul className="space-y-3 text-slate-400 text-sm">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition">Security</a></li>
                <li><a href="#" className="hover:text-white transition">Roadmap</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-3 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>

            {/* Resources */}
             <div>
              <h4 className="font-semibold mb-4 text-white">Resources</h4>
              <ul className="space-y-3 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-white transition">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition">API Reference</a></li>
                <li><a href="#" className="hover:text-white transition">Support</a></li>
                <li><a href="#" className="hover:text-white transition">Status</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold mb-4 text-white">Legal</h4>
              <ul className="space-y-3 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-white transition">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms</a></li>
                <li><a href="#" className="hover:text-white transition">Cookies</a></li>
                <li><a href="#" className="hover:text-white transition">Compliance</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
           <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              &copy; 2024 EduNexa. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-slate-400 text-sm">
              <a href="#" className="hover:text-white transition">Twitter</a>
              <a href="#" className="hover:text-white transition">LinkedIn</a>
              <a href="#" className="hover:text-white transition">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;