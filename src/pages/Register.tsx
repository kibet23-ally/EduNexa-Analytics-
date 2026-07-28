import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  School, MapPin, Phone, Mail, ChevronRight, ChevronLeft,
  CheckCircle, BookOpen, Users, Building2, Loader2,
  GraduationCap, Star, AlertCircle,
} from 'lucide-react';

/* ─── School levels config (extensible — add SSS here in future) ─────── */
const SCHOOL_LEVELS = [
  {
    code: 'PRIMARY',
    name: 'Primary School',
    description: 'Grades 1 – 6',
    grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
    subjects: [
      'English', 'Kiswahili', 'Mathematics', 'Science & Technology',
      'Agriculture', 'Social Studies', 'Creative Arts',
      'Physical & Health Education', 'Religious Education',
    ],
    icon: BookOpen,
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    code: 'JSS',
    name: 'Junior Secondary School',
    description: 'Grades 7 – 9',
    grades: ['Grade 7', 'Grade 8', 'Grade 9'],
    subjects: [
      'English', 'Kiswahili', 'Mathematics', 'Integrated Science',
      'Social Studies', 'Pre-Technical Studies', 'Agriculture & Nutrition',
      'Creative Arts & Sports', 'Religious Education',
      'Life Skills Education', 'Health Education',
    ],
    icon: GraduationCap,
    color: '#1e3a5f',
    bg: '#f0f4fb',
    border: '#96aed3',
  },
  // Future: uncomment when Senior Secondary is released
  // {
  //   code: 'SSS',
  //   name: 'Senior Secondary School',
  //   description: 'Grades 10 – 12',
  //   grades: ['Grade 10', 'Grade 11', 'Grade 12'],
  //   subjects: [],
  //   icon: Star,
  //   color: '#b45309',
  //   bg: '#fffbeb',
  //   border: '#fcd34d',
  // },
];

const COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu',
  'Garissa','Homa Bay','Isiolo','Kajiado','Kakamega','Kericho',
  'Kiambu','Kilifi','Kirinyaga','Kisii','Kisumu','Kitui',
  'Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera',
  'Marsabit','Meru','Migori','Mombasa','Murang\'a','Nairobi',
  'Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri',
  'Samburu','Siaya','Taita-Taveta','Tana River','Tharaka-Nithi',
  'Trans Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
];

const SCHOOL_TYPES = ['Public', 'Private', 'Mission', 'Harambee'];
const SCHOOL_CATEGORIES = [
  'Day School', 'Boarding School', 'Day & Boarding',
];

/* ─── Types ──────────────────────────────────────────────────────────── */
interface Step1Form {
  school_name:  string;
  school_type:  string;
  school_category: string;
  school_code:  string;
  county:       string;
  sub_county:   string;
  ward:         string;
  postal:       string;
  phone:        string;
  email:        string;
  admin_name:   string;
  password:     string;
  confirm_password: string;
}

const EMPTY_STEP1: Step1Form = {
  school_name: '', school_type: 'Public', school_category: 'Day School',
  school_code: '', county: '', sub_county: '', ward: '',
  postal: '', phone: '', email: '', admin_name: '',
  password: '', confirm_password: '',
};

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function Register() {
  const navigate = useNavigate();

  const [step,          setStep]         = useState<1 | 2>(1);
  const [form,          setForm]         = useState<Step1Form>(EMPTY_STEP1);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [errors,        setErrors]       = useState<Partial<Step1Form & { levels: string }>>({});
  const [submitting,    setSubmitting]   = useState(false);
  const [submitError,   setSubmitError]  = useState('');
  const [success,       setSuccess]      = useState(false);

  /* ── Field update ─────────────────────────────────────────────── */
  const set = (k: keyof Step1Form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setErrors(er => ({ ...er, [k]: '' }));
  };

  /* ── Toggle level ─────────────────────────────────────────────── */
  const toggleLevel = (code: string) => {
    setSelectedLevels(prev =>
      prev.includes(code) ? prev.filter(l => l !== code) : [...prev, code]
    );
    setErrors(er => ({ ...er, levels: '' }));
  };

  /* ── Step 1 validation ────────────────────────────────────────── */
  const validateStep1 = (): boolean => {
    const e: Partial<Step1Form> = {};
    if (!form.school_name.trim()) e.school_name = 'School name is required';
    if (!form.county)             e.county       = 'County is required';
    if (!form.phone.trim())       e.phone        = 'Phone number is required';
    if (!form.email.trim())       e.email        = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.admin_name.trim())  e.admin_name   = 'Admin name is required';
    if (!form.password)           e.password     = 'Password is required';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Step 1 → Step 2 ──────────────────────────────────────────── */
  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  /* ── Final submit ─────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (selectedLevels.length === 0) {
      setErrors(e => ({ ...e, levels: 'Please select at least one school level' }));
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      // 1. Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            full_name: form.admin_name.trim(),
            role: 'school_admin',
          },
        },
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('Registration failed — no user created');

      const authId = authData.user.id;

      // 2. Call RPC to create school, grades, subjects, levels
      const { data: schoolId, error: rpcError } = await supabase.rpc(
        'register_new_school',
        {
          p_auth_id:     authId,
          p_school_name: form.school_name.trim(),
          p_email:       form.email.trim().toLowerCase(),
          p_phone:       form.phone.trim(),
          p_admin_name:  form.admin_name.trim(),
          p_county:      form.county,
          p_sub_county:  form.sub_county.trim() || null,
          p_ward:        form.ward.trim() || null,
          p_postal:      form.postal.trim() || null,
          p_school_type: form.school_type || null,
          p_school_code: form.school_code.trim() || null,
          p_levels:      selectedLevels,
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      console.log('[Register] School created ID:', schoolId, 'Levels:', selectedLevels);
      setSuccess(true);

      // 3. Redirect to awaiting approval
      setTimeout(() => navigate('/awaiting-approval'), 2500);

    } catch (err: any) {
      console.error('[Register] Error:', err);
      setSubmitError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Summary of what will be created ──────────────────────────── */
  const selectedLevelDetails = SCHOOL_LEVELS.filter(l => selectedLevels.includes(l.code));
  const totalGrades   = selectedLevelDetails.flatMap(l => l.grades).length;
  const totalSubjects = selectedLevelDetails.reduce((a, l) => a + l.subjects.length, 0);

  /* ══════════════════════════════════════════════════════════════
     SUCCESS SCREEN
  ══════════════════════════════════════════════════════════════ */
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-[#123465] p-4">
        <div className="bg-white rounded-3xl p-10 text-center max-w-md w-full shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Registration Successful!</h2>
          <p className="text-slate-500 text-sm mb-4">
            Your school has been registered with{' '}
            <strong>{selectedLevels.length} level{selectedLevels.length > 1 ? 's' : ''}</strong>,{' '}
            <strong>{totalGrades} grades</strong> and{' '}
            <strong>{totalSubjects} subjects</strong> pre-configured.
          </p>
          <p className="text-xs text-slate-400">Redirecting to approval page…</p>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     MAIN FORM
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] via-[#123465] to-[#0d2347] flex flex-col">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <span className="text-white font-black text-sm">E</span>
          </div>
          <span className="text-white font-black text-lg">EduNexa</span>
        </Link>
        <Link to="/login" className="text-white/70 text-sm hover:text-white transition-colors">
          Already registered? <span className="font-semibold text-white">Sign In</span>
        </Link>
      </div>

      {/* ── Progress bar ── */}
      <div className="px-6 pb-2">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= s ? 'bg-white text-[#1e3a5f]' : 'bg-white/20 text-white/50'
                }`}>
                  {step > s ? <CheckCircle size={14} /> : s}
                </div>
                <span className={`text-xs font-medium ${step >= s ? 'text-white' : 'text-white/40'}`}>
                  {s === 1 ? 'School Information' : 'School Levels'}
                </span>
                {s < 2 && <div className={`flex-1 h-0.5 rounded-full ${step > s ? 'bg-white' : 'bg-white/20'}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Card ── */}
      <div className="flex-1 flex items-start justify-center px-4 py-4 pb-8">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">

          {/* ════ STEP 1: SCHOOL INFORMATION ════ */}
          {step === 1 && (
            <div className="p-6 md:p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-black text-slate-900">Register Your School</h1>
                <p className="text-slate-500 text-sm mt-1">Step 1 of 2 — School Information</p>
              </div>

              <div className="space-y-4">
                {/* School Name */}
                <Field label="School Name *" error={errors.school_name}>
                  <input value={form.school_name} onChange={set('school_name')}
                    placeholder="e.g. Marumbasi Comprehensive School"
                    className={inputCls(!!errors.school_name)} />
                </Field>

                {/* Type + Category */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="School Type" error={errors.school_type}>
                    <select value={form.school_type} onChange={set('school_type')} className={inputCls(false)}>
                      {SCHOOL_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Category" error={errors.school_category}>
                    <select value={form.school_category} onChange={set('school_category')} className={inputCls(false)}>
                      {SCHOOL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>

                {/* School Code */}
                <Field label="School Code (optional)">
                  <input value={form.school_code} onChange={set('school_code')}
                    placeholder="e.g. 12345678"
                    className={inputCls(false)} />
                </Field>

                {/* County + Sub-County */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="County *" error={errors.county}>
                    <select value={form.county} onChange={set('county')} className={inputCls(!!errors.county)}>
                      <option value="">Select county</option>
                      {COUNTIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Sub-County">
                    <input value={form.sub_county} onChange={set('sub_county')}
                      placeholder="Sub-county" className={inputCls(false)} />
                  </Field>
                </div>

                {/* Ward + Postal */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ward">
                    <input value={form.ward} onChange={set('ward')}
                      placeholder="Ward" className={inputCls(false)} />
                  </Field>
                  <Field label="Postal Address">
                    <input value={form.postal} onChange={set('postal')}
                      placeholder="P.O. Box 123-00100" className={inputCls(false)} />
                  </Field>
                </div>

                {/* Phone + Email */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone Number *" error={errors.phone}>
                    <input value={form.phone} onChange={set('phone')}
                      placeholder="0712 345 678" className={inputCls(!!errors.phone)} />
                  </Field>
                  <Field label="Email Address *" error={errors.email}>
                    <input type="email" value={form.email} onChange={set('email')}
                      placeholder="admin@school.ac.ke" className={inputCls(!!errors.email)} />
                  </Field>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Admin Account
                  </p>
                </div>

                {/* Admin Name */}
                <Field label="Admin Full Name *" error={errors.admin_name}>
                  <input value={form.admin_name} onChange={set('admin_name')}
                    placeholder="Full name of the school administrator"
                    className={inputCls(!!errors.admin_name)} />
                </Field>

                {/* Password */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Password *" error={errors.password}>
                    <input type="password" value={form.password} onChange={set('password')}
                      placeholder="Min 8 characters" className={inputCls(!!errors.password)} />
                  </Field>
                  <Field label="Confirm Password *" error={errors.confirm_password}>
                    <input type="password" value={form.confirm_password} onChange={set('confirm_password')}
                      placeholder="Repeat password" className={inputCls(!!errors.confirm_password)} />
                  </Field>
                </div>
              </div>

              <button onClick={handleNext}
                className="mt-6 w-full py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all"
                style={{ background: '#1e3a5f' }}>
                Continue to School Levels <ChevronRight size={16} />
              </button>

              <p className="text-center text-xs text-slate-400 mt-4">
                By registering you agree to our{' '}
                <Link to="/terms" className="underline hover:text-slate-600">Terms of Service</Link>{' '}
                and{' '}
                <Link to="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>
              </p>
            </div>
          )}

          {/* ════ STEP 2: SCHOOL LEVELS ════ */}
          {step === 2 && (
            <div className="p-6 md:p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-black text-slate-900">School Levels</h1>
                <p className="text-slate-500 text-sm mt-1">
                  Step 2 of 2 — Which levels does your school offer?
                </p>
              </div>

              {/* Level cards */}
              <div className="space-y-4 mb-6">
                {SCHOOL_LEVELS.map(level => {
                  const Icon      = level.icon;
                  const isSelected = selectedLevels.includes(level.code);
                  return (
                    <button
                      key={level.code}
                      onClick={() => toggleLevel(level.code)}
                      className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                        isSelected
                          ? 'shadow-md'
                          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white'
                      }`}
                      style={isSelected ? {
                        borderColor: level.color,
                        background: level.bg,
                      } : {}}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                          isSelected
                            ? 'border-transparent'
                            : 'border-slate-300 bg-white'
                        }`}
                          style={isSelected ? { background: level.color } : {}}>
                          {isSelected && <CheckCircle size={14} className="text-white" />}
                        </div>

                        {/* Icon */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: isSelected ? level.color + '20' : '#f1f5f9', border: `1.5px solid ${level.border}` }}>
                          <Icon size={18} style={{ color: level.color }} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-slate-900">{level.name}</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: level.color + '15', color: level.color }}>
                              {level.description}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Building2 size={11} /> {level.grades.length} grades
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <BookOpen size={11} /> {level.subjects.length} subjects
                            </span>
                          </div>
                          {/* Show subjects when selected */}
                          {isSelected && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {level.subjects.map(s => (
                                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                  style={{ background: level.color + '15', color: level.color }}>
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Error */}
              {errors.levels && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
                  <AlertCircle size={14} /> {errors.levels}
                </div>
              )}

              {/* Summary */}
              {selectedLevels.length > 0 && (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 mb-5">
                  <p className="text-xs font-bold text-green-800 uppercase tracking-wider mb-2">
                    ✅ Will be automatically created
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white rounded-xl p-2">
                      <div className="text-lg font-black text-[#1e3a5f]">{selectedLevels.length}</div>
                      <div className="text-[10px] text-slate-500">Level{selectedLevels.length > 1 ? 's' : ''}</div>
                    </div>
                    <div className="bg-white rounded-xl p-2">
                      <div className="text-lg font-black text-[#1e3a5f]">{totalGrades}</div>
                      <div className="text-[10px] text-slate-500">Grades</div>
                    </div>
                    <div className="bg-white rounded-xl p-2">
                      <div className="text-lg font-black text-[#1e3a5f]">{totalSubjects}</div>
                      <div className="text-[10px] text-slate-500">Subjects</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-green-700">
                    {selectedLevelDetails.flatMap(l => l.grades).join('  •  ')}
                  </div>
                </div>
              )}

              {/* Submit error */}
              {submitError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  {submitError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all">
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || selectedLevels.length === 0}
                  className="flex-2 flex-1 py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  style={{ background: '#1e3a5f' }}>
                  {submitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Setting up school…</>
                  ) : (
                    <><CheckCircle size={16} /> Complete Registration</>
                  )}
                </button>
              </div>

              <p className="text-center text-xs text-slate-400 mt-3">
                You can add more levels later from Settings → School Levels
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Helper components ──────────────────────────────────────────── */
const inputCls = (hasError: boolean) =>
  `w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-1 transition-colors
   bg-slate-50 text-slate-800 placeholder-slate-400
   ${hasError
    ? 'border-red-300 focus:border-red-400 focus:ring-red-400'
    : 'border-slate-200 focus:border-[#1e3a5f] focus:ring-[#1e3a5f]'}`;

const Field: React.FC<{
  label: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, error, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
    {children}
    {error && (
      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
        <AlertCircle size={10} /> {error}
      </p>
    )}
  </div>
);