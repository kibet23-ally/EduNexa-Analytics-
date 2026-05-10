import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { 
  GraduationCap, Lock, Mail, BarChart3, Building, Zap, Dot, Building2, Users, CreditCard, 
  AlertTriangle, CheckCircle2, Clock, TrendingUp, Menu, X, ArrowRight, BookOpen, 
  ClipboardList, LineChart, Shield, Smartphone, Award
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { School } from '../types';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // System details state
  const [systemStats, setSystemStats] = useState<{
    totalSchools: number;
    totalStudents: number;
    activeSubscriptions: number;
    expiredSchools: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Handle scroll for sticky navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch system statistics for the landing page
  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        const { data: schoolsData, error: schoolsError } = await supabase
          .from('schools')
          .select('id, subscription_status, created_at');

        if (schoolsError) throw schoolsError;

        const { count: studentsCount, error: studentsError } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true });

        if (studentsError) throw studentsError;

        const schools = schoolsData as School[] || [];
        setSystemStats({
          totalSchools: schools.length,
          totalStudents: studentsCount || 0,
          activeSubscriptions: schools.filter(s => s.subscription_status?.toLowerCase() === 'active').length,
          expiredSchools: schools.filter(s => s.subscription_status?.toLowerCase() === 'expired').length,
        });
      } catch (err) {
        console.error('Error fetching system stats:', err);
        setSystemStats({
          totalSchools: 0,
          totalStudents: 0,
          activeSubscriptions: 0,
          expiredSchools: 0,
        });
      } finally {
        setStatsLoading(false);
      }
    };

    fetchSystemStats();
  }, []);

  const redirectBasedOnRole = (rawRole: string) => {
    const role = (rawRole || '').toLowerCase().replace(/_/g, '');
    if (role === 'superadmin') {
      navigate('/super-admin');
    } else if (role === 'admin' || role === 'schooladmin') {
      navigate('/school-admin');
    } else if (role === 'teacher') {
      navigate('/teacher');
    } else {
      navigate('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.toLowerCase().trim();

    try {
      const authPromise = supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login timed out. Please check your connection and try again.')), 10000)
      );

      const { data, error: authError } = await Promise.race([
        authPromise,
        timeoutPromise
      ]) as Awaited<typeof authPromise>;

      if (authError || !data.session || !data.user) {
        throw new Error(authError?.message || 'Invalid email or password');
      }

      const session = data.session;
      const authUser = data.user;

      let profile = null;
      const { data: userData } = await supabase
        .from('users')
        .select('id, role, name, school_id, email')
        .eq('id', authUser.id)
        .maybeSingle();

      profile = userData;

      if (!profile) {
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('id, role, name, school_id, email')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (teacherData) {
          const role = teacherData.role === 'Admin' ? 'school_admin'
            : teacherData.role === 'SuperAdmin' ? 'super_admin'
            : 'teacher';

          const { data: newProfile } = await supabase
            .from('users')
            .upsert({
              id: authUser.id,
              email: cleanEmail,
              name: teacherData.name,
              role,
              school_id: teacherData.school_id,
            })
            .select()
            .maybeSingle();

          profile = newProfile || {
            id: authUser.id,
            email: cleanEmail,
            name: teacherData.name,
            role,
            school_id: teacherData.school_id,
          };
        }
      }

      if (!profile) {
        profile = {
          id: authUser.id,
          email: cleanEmail,
          name: authUser.user_metadata?.name || cleanEmail.split('@')[0],
          role: authUser.user_metadata?.role || 'school_admin',
          school_id: authUser.user_metadata?.school_id || null,
        };
      }

      if (profile.school_id) {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('status, subscription_status')
          .eq('id', profile.school_id)
          .maybeSingle();

        if (schoolData?.status === 'pending') {
          await supabase.auth.signOut();
          navigate('/awaiting-approval');
          return;
        }

        const subStatus = (schoolData?.subscription_status || '').toLowerCase();
        if (schoolData?.status === 'suspended' || subStatus === 'suspended') {
          await supabase.auth.signOut();
          throw new Error('Your school account is currently suspended. Please contact your administrator.');
        }
      }

      const fullUser = {
        ...authUser,
        ...profile,
        role: profile.role,
        name: profile.name,
        school_id: profile.school_id,
      };

      login(session.access_token, fullUser);
      redirectBasedOnRole(profile.role);

    } catch (err: unknown) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ label, value, icon: Icon, color, trend }: {
    label: string; value: number; icon: React.ElementType; color: string; trend: string;
  }) => (
    <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/50 relative overflow-hidden group hover:shadow-xl transition-all">
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 ${color} opacity-[0.08] rounded-full group-hover:scale-125 transition-transform duration-500`} />
      <div className="flex items-center gap-4 relative z-10">
        <div className={`${color} text-white p-3 rounded-xl shadow-lg`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <h4 className="text-2xl font-display font-bold text-slate-900 mt-1">{value}</h4>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-bold text-accent">
        <div className="bg-accent/10 p-1 rounded-lg"><TrendingUp size={12} /></div>
        {trend}
      </div>
    </div>
  );

  const FeatureCard = ({ icon: Icon, title, description }: {
    icon: React.ElementType; title: string; description: string;
  }) => (
    <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all">
      <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
        <Icon size={24} className="text-primary" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );

  const HowItWorksStep = ({ number, title, description }: {
    number: number; title: string; description: string;
  }) => (
    <div className="flex flex-col items-center text-center">
      <div className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-4 shadow-lg">
        {number}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );

  const BenefitItem = ({ icon: Icon, title, description }: {
    icon: React.ElementType; title: string; description: string;
  }) => (
    <div className="flex gap-4">
      <div className="bg-accent/10 w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
        <Icon size={20} className="text-accent" />
      </div>
      <div>
        <h4 className="font-bold text-slate-900 mb-1">{title}</h4>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-lg' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 text-primary font-display font-bold text-xl">
              <GraduationCap size={28} />
              <span>EduNexa</span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-600 hover:text-primary font-medium transition">Features</a>
              <a href="#how-it-works" className="text-slate-600 hover:text-primary font-medium transition">How It Works</a>
              <a href="#about" className="text-slate-600 hover:text-primary font-medium transition">About</a>
            </div>

            {/* Desktop Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                to="/login"
                className="text-primary font-bold hover:text-primary-dark transition"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-primary-dark transition"
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
            <div className="md:hidden pb-4 space-y-4">
              <a href="#features" className="block text-slate-600 font-medium">Features</a>
              <a href="#how-it-works" className="block text-slate-600 font-medium">How It Works</a>
              <a href="#about" className="block text-slate-600 font-medium">About</a>
              <div className="flex flex-col gap-2 pt-4 border-t">
                <Link to="/login" className="text-center text-primary font-bold py-2">Log In</Link>
                <Link to="/register" className="text-center bg-primary text-white px-6 py-2 rounded-lg font-bold">Get Started</Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-display font-black text-slate-900 mb-6 leading-tight">
            EduNexa
          </h1>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-700 mb-6">
            Simplify School Management with Ease
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Transform your school operations with our comprehensive management system. Streamline student records, teacher assignments, exams, and analytics—all in one intuitive platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-primary text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-primary-dark transition flex items-center justify-center gap-2 shadow-lg"
            >
              Get Started <ArrowRight size={20} />
            </Link>
            <Link
              to="/login"
              className="border-2 border-primary text-primary px-8 py-4 rounded-lg font-bold text-lg hover:bg-primary/5 transition"
            >
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* System Stats Section */}
      {!statsLoading && systemStats && (
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">Platform Overview</h2>
              <p className="text-slate-600">Trusted by schools across Kenya</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                label="Active Schools" 
                value={systemStats.totalSchools} 
                icon={Building2} 
                color="bg-primary" 
                trend="Growing network" 
              />
              <StatCard 
                label="Total Students" 
                value={systemStats.totalStudents} 
                icon={Users} 
                color="bg-accent" 
                trend="Across platform" 
              />
              <StatCard 
                label="Active Subscriptions" 
                value={systemStats.activeSubscriptions} 
                icon={CreditCard} 
                color="bg-primary" 
                trend="Premium tier" 
              />
              <StatCard 
                label="System Health" 
                value={99} 
                icon={CheckCircle2} 
                color="bg-green-600" 
                trend="Uptime %" 
              />
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-slate-900 mb-4">Powerful Features</h2>
            <p className="text-lg text-slate-600">Everything you need to manage your school effectively</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={Users}
              title="Student Management"
              description="Easily manage student records, enrollment, and academic progress in one centralized system."
            />
            <FeatureCard
              icon={BookOpen}
              title="Teacher Management"
              description="Assign teachers, manage schedules, and track performance with our intuitive interface."
            />
            <FeatureCard
              icon={ClipboardList}
              title="Exams & Results"
              description="Create exams, record marks, and generate comprehensive result reports automatically."
            />
            <FeatureCard
              icon={BarChart3}
              title="Analytics"
              description="Get actionable insights with real-time dashboards and detailed analytics reports."
            />
            <FeatureCard
              icon={Shield}
              title="Secure System"
              description="Enterprise-grade security with role-based access control and data encryption."
            />
            <FeatureCard
              icon={Smartphone}
              title="Mobile Friendly"
              description="Access your school data anytime, anywhere with our responsive mobile interface."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-lg text-slate-600">Get started in just a few simple steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <HowItWorksStep
              number={1}
              title="Register"
              description="Create your school account and provide basic information."
            />
            <div className="hidden md:flex items-center justify-center">
              <ArrowRight size={32} className="text-primary" />
            </div>
            <HowItWorksStep
              number={2}
              title="Get Approval"
              description="Wait for admin approval of your school registration."
            />
            <div className="hidden md:flex items-center justify-center">
              <ArrowRight size={32} className="text-primary" />
            </div>
            <HowItWorksStep
              number={3}
              title="Add Data"
              description="Add teachers, students, and academic information."
            />
            <div className="hidden md:flex items-center justify-center">
              <ArrowRight size={32} className="text-primary" />
            </div>
            <HowItWorksStep
              number={4}
              title="Start Using"
              description="Begin managing your school operations seamlessly."
            />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-display font-bold text-slate-900 mb-8">Why Choose EduNexa?</h2>
              <div className="space-y-6">
                <BenefitItem
                  icon={TrendingUp}
                  title="Increase Efficiency"
                  description="Automate repetitive tasks and save hours of administrative work every week."
                />
                <BenefitItem
                  icon={BarChart3}
                  title="Data-Driven Decisions"
                  description="Make informed decisions with comprehensive analytics and real-time reports."
                />
                <BenefitItem
                  icon={Shield}
                  title="Secure & Reliable"
                  description="Enterprise-grade security ensures your school data is always protected."
                />
                <BenefitItem
                  icon={Award}
                  title="Trusted by Schools"
                  description="Join hundreds of schools across Kenya already using EduNexa."
                />
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary to-primary-dark p-12 rounded-2xl text-white shadow-xl">
              <h3 className="text-2xl font-bold mb-6">Quick Stats</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-4xl font-bold">{systemStats?.totalSchools || 0}+</p>
                  <p className="text-white/80">Schools Using EduNexa</p>
                </div>
                <div>
                  <p className="text-4xl font-bold">{systemStats?.totalStudents || 0}+</p>
                  <p className="text-white/80">Students Managed</p>
                </div>
                <div>
                  <p className="text-4xl font-bold">99.9%</p>
                  <p className="text-white/80">System Uptime</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-display font-bold text-slate-900 mb-6">About EduNexa</h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-8">
            EduNexa is a comprehensive school management and analytics platform designed to simplify educational administration. We empower schools with smart analytics, seamless management tools, and data-driven insights—all in one intuitive platform. Our mission is to help educators focus on what matters most: student success.
          </p>
          <p className="text-lg text-slate-600 leading-relaxed">
            Built with schools across Kenya in mind, EduNexa combines powerful features with ease of use, ensuring that both administrators and teachers can manage their responsibilities efficiently and effectively.
          </p>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary to-primary-dark text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-display font-bold mb-6">Ready to Transform Your School?</h2>
          <p className="text-lg text-white/90 mb-8">
            Join hundreds of schools already using EduNexa. Get started today with a 30-day free trial.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-white text-primary px-8 py-4 rounded-lg font-bold text-lg hover:bg-slate-100 transition shadow-lg"
          >
            Get Started Now <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap size={24} />
                <span className="font-display font-bold text-lg">EduNexa</span>
              </div>
              <p className="text-slate-400 text-sm">
                Simplifying school management with smart analytics and data-driven insights.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition">How It Works</a></li>
                <li><a href="/status" className="hover:text-white transition">System Status</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#about" className="hover:text-white transition">About Us</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
                <li><a href="#" className="hover:text-white transition">Support</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-slate-400 text-sm">
              &copy; 2024 EduNexa. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-slate-400 text-xs mt-4 md:mt-0">
              <span>v1.5.0</span>
              <Dot size={8} />
              <span>EduNexa Platform Services</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Login;
            