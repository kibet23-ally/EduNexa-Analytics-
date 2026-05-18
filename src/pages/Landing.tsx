import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Menu, X, ArrowRight, BookOpen, ClipboardList, Shield,
  Smartphone, BarChart3, CheckCircle, Users, Sparkles
} from 'lucide-react';

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Dashboard Illustration
  const DashboardIllustration = () => (
    <div className="relative w-full min-h-96 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 border shadow-2xl">
      <div className="p-6 space-y-4">
        <div className="flex justify-between mb-6">
          <div className="w-24 h-3 bg-blue-300 rounded-full opacity-60"></div>
          <div className="flex gap-2">
            <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
            <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
          </div>
        </div>

        <div className="flex items-end gap-2 h-24">
          {[40, 60, 30, 80, 50, 70].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-blue-400 rounded-t"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // Feature Card
  const FeatureCard = ({ icon: Icon, title, description }: any) => (
    <div className="bg-white/70 backdrop-blur-xl border rounded-2xl p-6 shadow hover:shadow-lg transition">
      <Icon className="text-blue-600 mb-4" size={28} />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );

  // Pricing Card
  const PricingCard = ({ name, price, features, highlight }: any) => (
    <div className={`border rounded-2xl p-6 ${highlight ? 'bg-blue-50 border-blue-500' : ''}`}>
      <h3 className="text-xl font-bold mb-2">{name}</h3>
      <p className="text-3xl font-bold mb-4">{price}</p>
      <ul className="space-y-2 text-sm text-gray-600">
        {features.map((f: string, i: number) => (
          <li key={i} className="flex gap-2">
            <CheckCircle size={16} className="text-green-500" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">

      {/* NAVBAR */}
      <nav className={`fixed w-full z-50 transition ${scrolled ? 'bg-white shadow' : ''}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center p-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-blue-600">
            <GraduationCap />
            EduNexa
          </Link>

          <div className="hidden md:flex gap-6 text-sm">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <Link to="/login">Login</Link>
            <Link to="/register" className="text-blue-600 font-semibold">Get Started</Link>
          </div>

          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden p-4 space-y-2 border-t">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <Link to="/login">Login</Link>
            <Link to="/register">Get Started</Link>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="pt-28 px-6 max-w-7xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        <div>
          <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full w-fit mb-4">
            <Sparkles size={16} />
            <span className="text-sm">EduNexa 2.0</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold">
            School Management <span className="text-blue-600">Reimagined</span>
          </h1>

          <p className="text-gray-600 mt-4">
            Manage students, teachers, exams, and analytics in one powerful system.
          </p>

          <div className="mt-6 flex gap-4">
            <Link to="/register" className="bg-blue-600 text-white px-6 py-3 rounded-xl">
              Get Started
            </Link>
            <button className="border px-6 py-3 rounded-xl">
              Demo
            </button>
          </div>
        </div>

        <DashboardIllustration />
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold mb-10">Features</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard icon={Users} title="Students" description="Manage student data easily" />
          <FeatureCard icon={BookOpen} title="Teachers" description="Assign and track teachers" />
          <FeatureCard icon={ClipboardList} title="Exams" description="Create exams and results" />
          <FeatureCard icon={BarChart3} title="Analytics" description="Smart reporting dashboard" />
          <FeatureCard icon={Shield} title="Security" description="Secure role-based access" />
          <FeatureCard icon={Smartphone} title="Mobile" description="Works on all devices" />
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 bg-gray-50 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-10">Pricing</h2>

          <div className="grid md:grid-cols-3 gap-6">
            <PricingCard
              name="Basic"
              price="KES 2,500"
              features={["Students", "Teachers", "Reports"]}
            />
            <PricingCard
              name="Standard"
              price="KES 5,000"
              highlight
              features={["Everything in Basic", "Exams", "Analytics"]}
            />
            <PricingCard
              name="Premium"
              price="KES 9,000"
              features={["Unlimited", "Advanced Analytics", "Priority Support"]}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <h2 className="text-3xl font-bold">Ready to start?</h2>
        <p className="text-gray-600 mt-2">Join hundreds of schools using EduNexa</p>

        <Link
          to="/register"
          className="inline-block mt-6 bg-blue-600 text-white px-6 py-3 rounded-xl"
        >
          Get Started Free
        </Link>
      </section>

      {/* FOOTER (CLEANED) */}
      <footer className="bg-gray-900 text-white px-6 py-12">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">

          <div>
            <h3 className="font-bold text-lg">EduNexa</h3>
            <p className="text-sm text-gray-400 mt-2">
              Modern school management system.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="/features">Features</a></li>
              <li><a href="/pricing">Pricing</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="/about">About</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="/privacy">Privacy</a></li>
              <li><a href="/terms">Terms</a></li>
            </ul>
          </div>

        </div>

        <div className="text-center text-gray-500 text-sm mt-10">
          © {new Date().getFullYear()} EduNexa. All rights reserved.
        </div>
      </footer>

    </div>
  );
};

export default Landing;