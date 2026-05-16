import { useState, useEffect, useRef } from "react";
import {
  BookOpen, Users, Shield, AlertTriangle, CreditCard,
  RefreshCw, Lock, Database, Wifi, Scale, Ban, Globe,
  Edit, Gavel, Phone, CheckSquare, ChevronRight,
  Sun, Moon, ArrowUp, Info, Menu, X, Building2,
  FileText, Sparkles, Mail, MapPin, Calendar,
  ExternalLink, Check
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "introduction",       label: "Introduction",                icon: BookOpen },
  { id: "about",              label: "About EduNexa",               icon: Building2 },
  { id: "eligibility",        label: "Eligibility & Registration",  icon: Users },
  { id: "responsibilities",   label: "User Responsibilities",       icon: Shield },
  { id: "usage-rules",        label: "Platform Usage Rules",        icon: FileText },
  { id: "subscription",       label: "Subscription & Payments",     icon: CreditCard },
  { id: "refund",             label: "Refund Policy",               icon: RefreshCw },
  { id: "intellectual",       label: "Intellectual Property",       icon: Lock },
  { id: "privacy",            label: "Privacy & User Data",         icon: Database },
  { id: "availability",       label: "Service Availability",        icon: Wifi },
  { id: "liability",          label: "Limitation of Liability",     icon: Scale },
  { id: "termination",        label: "Suspension & Termination",    icon: Ban },
  { id: "third-party",        label: "Third-Party Services",        icon: Globe },
  { id: "modifications",      label: "Modifications to Terms",      icon: Edit },
  { id: "governing-law",      label: "Governing Law",               icon: Gavel },
  { id: "contact",            label: "Contact Information",         icon: Phone },
  { id: "acceptance",         label: "Acceptance of Terms",         icon: CheckSquare },
];

const CONTACT = {
  email:   "legal@edunexa.co.ke",
  phone:   "+254 700 000 000",
  address: "Nairobi Business Park, Upper Hill, Nairobi, Kenya",
  effectiveDate: "1 June 2025",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useActiveSection() {
  const [active, setActive] = useState("introduction");
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return active;
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoBox({ type = "info", children }) {
  const styles = {
    info:    { bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",    icon: <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />,    text: "text-blue-800 dark:text-blue-200" },
    warning: { bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800", icon: <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />, text: "text-amber-800 dark:text-amber-200" },
    success: { bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800", icon: <Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />, text: "text-emerald-800 dark:text-emerald-200" },
  };
  const s = styles[type];
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${s.bg} my-5`}>
      {s.icon}
      <p className={`text-sm leading-relaxed ${s.text}`}>{children}</p>
    </div>
  );
}

function SectionCard({ id, icon: Icon, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden transition-colors duration-300">
        {/* Header */}
        <div className="flex items-center gap-4 px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50/80 to-white dark:from-gray-800/50 dark:to-gray-900">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a56db] to-[#0ea5e9] flex items-center justify-center shadow-md flex-shrink-0">
            <Icon size={18} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h2>
        </div>
        {/* Body */}
        <div className="px-8 py-7 prose prose-sm dark:prose-invert max-w-none
          prose-headings:font-semibold prose-headings:text-gray-800 dark:prose-headings:text-gray-100
          prose-p:text-gray-600 dark:prose-p:text-gray-400 prose-p:leading-relaxed
          prose-li:text-gray-600 dark:prose-li:text-gray-400 prose-li:leading-relaxed
          prose-strong:text-gray-800 dark:prose-strong:text-gray-100
          prose-ul:space-y-1.5 prose-ol:space-y-1.5">
          {children}
        </div>
      </div>
    </section>
  );
}

// ─── TOC Sidebar ──────────────────────────────────────────────────────────────

function Sidebar({ active, dark, toggleDark }) {
  return (
    <aside className="hidden lg:flex flex-col w-72 flex-shrink-0">
      <div className="sticky top-6 flex flex-col gap-3 max-h-[calc(100vh-3rem)] overflow-hidden">
        {/* Branding */}
        <div className="bg-gradient-to-br from-[#1a56db] to-[#0ea5e9] rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm leading-none">EduNexa</p>
              <p className="text-xs text-blue-100 mt-0.5">Softwares</p>
            </div>
          </div>
          <p className="text-xs text-blue-100 leading-relaxed">
            Terms &amp; Conditions — last updated <strong className="text-white">{CONTACT.effectiveDate}</strong>
          </p>
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
          {dark ? "Light mode" : "Dark mode"}
        </button>

        {/* TOC */}
        <nav className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex-1 overflow-y-auto">
          <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Contents
          </p>
          <ul className="pb-3 space-y-0.5">
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const isActive = active === id;
              return (
                <li key={id}>
                  <button
                    onClick={() => scrollTo(id)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm rounded-lg mx-1 transition-all duration-200 text-left
                      ${isActive
                        ? "bg-blue-50 dark:bg-blue-950/50 text-[#1a56db] dark:text-blue-400 font-semibold"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    style={{ width: "calc(100% - 8px)" }}
                  >
                    <Icon size={13} className={isActive ? "text-[#1a56db] dark:text-blue-400" : "text-gray-400"} />
                    <span className="truncate text-xs">{label}</span>
                    {isActive && <ChevronRight size={12} className="ml-auto flex-shrink-0 text-[#1a56db] dark:text-blue-400" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

// ─── Mobile TOC ───────────────────────────────────────────────────────────────

function MobileNav({ active, open, setOpen }) {
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-[#1a56db] to-[#0ea5e9] shadow-lg flex items-center justify-center text-white"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <p className="font-bold text-gray-900 dark:text-white text-sm">Table of Contents</p>
              <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3">
              {SECTIONS.map(({ id, label, icon: Icon }) => {
                const isActive = active === id;
                return (
                  <button key={id} onClick={() => { scrollTo(id); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-5 py-3 text-sm text-left transition-colors
                      ${isActive ? "bg-blue-50 dark:bg-blue-950/50 text-[#1a56db] dark:text-blue-400 font-semibold" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                    <Icon size={14} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EduNexaTerms() {
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const active = useActiveSection();

  useEffect(() => {
    const root = document.documentElement;
    dark ? root.classList.add("dark") : root.classList.remove("dark");
  }, [dark]);

  useEffect(() => {
    const handler = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f8fc] dark:bg-gray-950 transition-colors duration-300 font-sans">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1a56db] to-[#0ea5e9] rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="leading-none">
              <p className="font-bold text-gray-900 dark:text-white text-sm">EduNexa Softwares</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Terms &amp; Conditions</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
              <Calendar size={12} />
              Effective: {CONTACT.effectiveDate}
            </span>
            <button
              onClick={() => setDark(d => !d)}
              className="hidden lg:flex w-9 h-9 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-[#1a56db] via-[#1e6dbf] to-[#0ea5e9] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px), radial-gradient(circle at 60% 80%, white 1px, transparent 1px)", backgroundSize: "60px 60px, 80px 80px, 40px 40px" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/15 text-white/90 text-xs font-medium px-3 py-1.5 rounded-full mb-5 border border-white/20">
              <FileText size={12} />
              Legal Document — Please read carefully
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4">
              Terms &amp; Conditions
            </h1>
            <p className="text-blue-100 text-base sm:text-lg leading-relaxed mb-6">
              These terms govern your use of <strong className="text-white">EduNexa Softwares</strong>, Kenya's leading school management platform. By using our services, you agree to be bound by these terms.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-blue-100">
              <span className="flex items-center gap-1.5"><Calendar size={14} /> Effective: <strong className="text-white">{CONTACT.effectiveDate}</strong></span>
              <span className="flex items-center gap-1.5"><MapPin size={14} /> Governed by Kenyan Law</span>
              <span className="flex items-center gap-1.5"><Globe size={14} /> Version 1.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex gap-8">

          <Sidebar active={active} dark={dark} toggleDark={() => setDark(d => !d)} />

          {/* Content */}
          <main className="flex-1 min-w-0 space-y-6">

            {/* ── 1. Introduction ── */}
            <SectionCard id="introduction" icon={BookOpen} title="1. Introduction">
              <p>Welcome to <strong>EduNexa Softwares</strong>. These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and EduNexa Softwares Limited ("EduNexa," "we," "us," or "our"), governing your access to and use of our school management platform, including all associated web applications, mobile applications, APIs, and services (collectively, the "Platform").</p>
              <p>By accessing or using the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree with any part of these Terms, you must discontinue use of the Platform immediately.</p>
              <InfoBox type="info">
                These Terms were last updated on <strong>{CONTACT.effectiveDate}</strong>. We encourage you to review this document periodically to stay informed of any changes.
              </InfoBox>
              <p>These Terms apply to all users of the Platform, including schools, teachers, administrators, parents, and any other individuals or entities accessing EduNexa's services. Additional terms may apply to specific features or services and will be presented to you where applicable.</p>
            </SectionCard>

            {/* ── 2. About ── */}
            <SectionCard id="about" icon={Building2} title="2. About EduNexa Softwares">
              <p><strong>EduNexa Softwares</strong> is a Kenyan-based Software-as-a-Service (SaaS) company specializing in comprehensive school management solutions. Our Platform is designed to streamline administrative processes, enhance communication between educators and parents, and improve educational outcomes across Kenyan schools and beyond.</p>
              <h3>Our Core Services</h3>
              <ul>
                <li>Student information and enrollment management</li>
                <li>Academic performance tracking and grading systems</li>
                <li>Teacher and staff administration portals</li>
                <li>Parent communication and engagement tools</li>
                <li>Fee collection and financial management</li>
                <li>Timetable scheduling and class management</li>
                <li>Examination management and result processing</li>
                <li>Attendance tracking and reporting</li>
              </ul>
              <InfoBox type="success">
                EduNexa Softwares is fully compliant with the Kenya Data Protection Act, 2019 and is committed to protecting the privacy and security of all users, especially minors.
              </InfoBox>
              <p>EduNexa is registered as a limited liability company under the laws of Kenya. Our registered office is located at {CONTACT.address}.</p>
            </SectionCard>

            {/* ── 3. Eligibility ── */}
            <SectionCard id="eligibility" icon={Users} title="3. Eligibility and Account Registration">
              <p>To access and use the EduNexa Platform, you must meet the following eligibility requirements:</p>
              <h3>Age and Legal Capacity</h3>
              <ul>
                <li>You must be at least 18 years of age or have the legal capacity to enter into binding contracts under applicable law</li>
                <li>If you are accessing the Platform on behalf of a minor, you must be their legal guardian or have appropriate authority</li>
                <li>Schools and institutions must be legally registered and authorized to operate in their respective jurisdictions</li>
              </ul>
              <h3>Account Registration Requirements</h3>
              <ul>
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and promptly update your account information to keep it accurate</li>
                <li>Keep your login credentials confidential and secure</li>
                <li>Immediately notify EduNexa of any unauthorized access or security breach</li>
                <li>Accept sole responsibility for all activities that occur under your account</li>
              </ul>
              <InfoBox type="warning">
                <strong>Important:</strong> You are strictly prohibited from creating accounts using false identities, impersonating any person or entity, or misrepresenting your affiliation with any school or organization. EduNexa reserves the right to suspend or terminate accounts found in violation.
              </InfoBox>
              <p>EduNexa reserves the right to refuse service, terminate accounts, or remove content at our sole discretion, particularly where we believe eligibility requirements have not been met.</p>
            </SectionCard>

            {/* ── 4. Responsibilities ── */}
            <SectionCard id="responsibilities" icon={Shield} title="4. User Responsibilities">
              <p>As a user of the EduNexa Platform, you accept the following responsibilities, which are essential to maintaining a safe, secure, and productive environment for all stakeholders:</p>
              <h3>General Responsibilities</h3>
              <ul>
                <li>Use the Platform only for its intended lawful purposes related to education and school management</li>
                <li>Maintain the confidentiality of all student records and sensitive information accessible through the Platform</li>
                <li>Ensure that any data entered into the Platform is accurate and lawfully obtained</li>
                <li>Comply with all applicable laws, including Kenyan data protection and educational regulations</li>
                <li>Report any security vulnerabilities, bugs, or irregularities promptly to our support team</li>
              </ul>
              <h3>Data Stewardship</h3>
              <p>School administrators and institutions using EduNexa act as data controllers for student and staff information. In this capacity, you are responsible for:</p>
              <ul>
                <li>Obtaining appropriate consent before entering personal data into the Platform</li>
                <li>Ensuring data accuracy and implementing procedures for data correction</li>
                <li>Honoring data subject rights including access, rectification, and erasure requests</li>
                <li>Training staff on proper use of the Platform and data handling procedures</li>
              </ul>
              <InfoBox type="warning">
                Failure to comply with your data stewardship obligations may result in liability under the Kenya Data Protection Act, 2019. EduNexa will cooperate with regulatory authorities where required by law.
              </InfoBox>
            </SectionCard>

            {/* ── 5. Usage Rules ── */}
            <SectionCard id="usage-rules" icon={FileText} title="5. Platform Usage Rules">
              <p>To ensure the integrity and security of the EduNexa Platform, the following activities are expressly prohibited:</p>
              <h3>Prohibited Activities</h3>
              <ul>
                <li>Attempting to gain unauthorized access to other accounts, systems, or networks</li>
                <li>Using the Platform to transmit malware, viruses, or any malicious code</li>
                <li>Reverse engineering, decompiling, or attempting to extract the source code of the Platform</li>
                <li>Scraping, crawling, or using automated tools to extract data without prior written consent</li>
                <li>Using the Platform to send unsolicited communications or spam</li>
                <li>Reselling, sublicensing, or commercializing access to the Platform without authorization</li>
                <li>Uploading content that infringes on intellectual property rights of third parties</li>
                <li>Using the Platform to facilitate fraud, money laundering, or any other illegal activity</li>
                <li>Interfering with or disrupting the Platform's infrastructure or connected networks</li>
              </ul>
              <h3>Acceptable Use</h3>
              <p>You may use the Platform only for legitimate educational administration purposes, including managing student records, communicating with parents and staff, tracking academic progress, and managing school operations.</p>
              <InfoBox type="info">
                EduNexa employs automated monitoring tools to detect suspicious activity. Violations of these usage rules will result in immediate account suspension and may be reported to relevant law enforcement authorities.
              </InfoBox>
            </SectionCard>

            {/* ── 6. Subscription ── */}
            <SectionCard id="subscription" icon={CreditCard} title="6. Subscription and Payments">
              <p>EduNexa offers its services through a subscription-based model. The following terms govern all financial transactions on the Platform:</p>
              <h3>Subscription Plans</h3>
              <ul>
                <li><strong>Basic Plan:</strong> Core features for small schools (up to 200 students)</li>
                <li><strong>Standard Plan:</strong> Advanced features for medium-sized institutions (up to 1,000 students)</li>
                <li><strong>Premium Plan:</strong> Full feature access with priority support (unlimited students)</li>
                <li><strong>Enterprise Plan:</strong> Custom solutions for school networks and county education offices</li>
              </ul>
              <h3>Payment Terms</h3>
              <ul>
                <li>All prices are quoted in Kenyan Shillings (KES) and include applicable taxes unless stated otherwise</li>
                <li>Subscriptions are billed in advance on a monthly or annual basis</li>
                <li>Payment is accepted via M-Pesa, bank transfer, Visa/Mastercard, and other supported methods</li>
                <li>Annual subscriptions are eligible for a discount as advertised on the pricing page</li>
                <li>Failure to pay on time may result in temporary suspension of services</li>
              </ul>
              <InfoBox type="warning">
                <strong>Auto-Renewal:</strong> Subscriptions automatically renew unless cancelled at least 7 days before the renewal date. You will receive a reminder email 14 days before renewal.
              </InfoBox>
              <h3>Price Changes</h3>
              <p>EduNexa reserves the right to modify pricing with at least 30 days' advance notice. Continued use of the Platform after a price change constitutes acceptance of the new pricing.</p>
            </SectionCard>

            {/* ── 7. Refund ── */}
            <SectionCard id="refund" icon={RefreshCw} title="7. Refund Policy">
              <p>EduNexa is committed to customer satisfaction and maintains a transparent refund policy:</p>
              <h3>Eligibility for Refunds</h3>
              <ul>
                <li><strong>14-Day Money-Back Guarantee:</strong> New subscribers may request a full refund within 14 days of their initial subscription payment if the Platform does not meet their needs</li>
                <li><strong>Service Outages:</strong> Pro-rated refunds may be issued for extended service outages (exceeding 24 continuous hours) attributable to EduNexa's infrastructure</li>
                <li><strong>Billing Errors:</strong> Full refunds are issued promptly for any demonstrable billing errors</li>
              </ul>
              <h3>Non-Refundable Items</h3>
              <ul>
                <li>Partial months of service after the 14-day guarantee period</li>
                <li>One-time setup fees and onboarding services</li>
                <li>Annual subscriptions cancelled after 30 days of the subscription start date (unless due to a service failure)</li>
                <li>Customization, integration, or professional services fees</li>
              </ul>
              <InfoBox type="info">
                To request a refund, contact our billing team at <strong>{CONTACT.email}</strong> with your account details and reason for the refund request. Refunds are processed within 7–14 business days.
              </InfoBox>
              <p>EduNexa reserves the right to deny refund requests that appear to abuse our refund policy or where accounts have violated these Terms.</p>
            </SectionCard>

            {/* ── 8. IP ── */}
            <SectionCard id="intellectual" icon={Lock} title="8. Intellectual Property Rights">
              <p>All intellectual property rights in the EduNexa Platform and its content are owned by or licensed to EduNexa Softwares Limited:</p>
              <h3>EduNexa's Intellectual Property</h3>
              <ul>
                <li>The EduNexa brand, logo, trademarks, and service marks are the exclusive property of EduNexa Softwares Limited</li>
                <li>The Platform's software, source code, architecture, and underlying technology are protected by copyright</li>
                <li>All documentation, help content, marketing materials, and user interface designs are proprietary</li>
                <li>Any improvements, updates, or modifications to the Platform remain EduNexa's sole property</li>
              </ul>
              <h3>User Content</h3>
              <p>You retain ownership of all data and content you upload to the Platform ("User Content"). By using EduNexa, you grant us a limited, non-exclusive, royalty-free license to host, process, and display your User Content solely to provide the services.</p>
              <h3>Restrictions</h3>
              <ul>
                <li>You may not copy, modify, distribute, or create derivative works based on the Platform</li>
                <li>You may not remove or alter any proprietary notices, labels, or watermarks</li>
                <li>You may not use EduNexa's brand or trademarks without prior written consent</li>
              </ul>
              <InfoBox type="warning">
                Unauthorized reproduction or distribution of EduNexa's intellectual property may result in civil and criminal penalties under Kenyan law, including the Copyright Act (Cap 130).
              </InfoBox>
            </SectionCard>

            {/* ── 9. Privacy ── */}
            <SectionCard id="privacy" icon={Database} title="9. Privacy and User Data">
              <p>EduNexa is deeply committed to protecting the privacy of all users, particularly the personal data of students and minors. Our data practices are governed by the Kenya Data Protection Act, 2019.</p>
              <h3>Data We Collect</h3>
              <ul>
                <li>Account registration information (name, email, phone number, institutional details)</li>
                <li>Student academic records (grades, attendance, examination results)</li>
                <li>Communication logs between Platform users</li>
                <li>Payment information (processed securely through certified payment gateways)</li>
                <li>Usage analytics and technical data to improve Platform performance</li>
              </ul>
              <h3>How We Use Your Data</h3>
              <ul>
                <li>To provide, maintain, and improve our school management services</li>
                <li>To process payments and manage subscriptions</li>
                <li>To communicate service updates, security alerts, and administrative messages</li>
                <li>To comply with legal obligations and respond to lawful requests from authorities</li>
                <li>To generate anonymized, aggregated analytics to improve our products</li>
              </ul>
              <InfoBox type="info">
                EduNexa does not sell, rent, or trade your personal data to third parties for marketing purposes. Any data sharing is strictly limited to what is necessary to provide our services.
              </InfoBox>
              <h3>Data Security</h3>
              <p>We implement industry-standard security measures including end-to-end encryption, secure data centers within Kenya, regular security audits, multi-factor authentication, and role-based access controls to protect your data.</p>
              <p>For full details, please review our <a href="#" className="text-[#1a56db] dark:text-blue-400 hover:underline font-medium inline-flex items-center gap-1">Privacy Policy <ExternalLink size={12} /></a>.</p>
            </SectionCard>

            {/* ── 10. Availability ── */}
            <SectionCard id="availability" icon={Wifi} title="10. Service Availability">
              <p>EduNexa strives to provide a reliable and uninterrupted service experience:</p>
              <h3>Service Level Commitment</h3>
              <ul>
                <li>We target a minimum uptime of <strong>99.5%</strong> measured on a monthly basis</li>
                <li>Scheduled maintenance windows will be communicated at least 48 hours in advance</li>
                <li>We maintain redundant infrastructure to minimize the impact of technical failures</li>
                <li>A status page (<strong>status.edunexa.co.ke</strong>) provides real-time information on Platform availability</li>
              </ul>
              <h3>Service Interruptions</h3>
              <p>EduNexa shall not be liable for service interruptions caused by:</p>
              <ul>
                <li>Force majeure events including natural disasters, power outages, or government actions</li>
                <li>Actions of third-party internet service providers or telecommunications networks</li>
                <li>Scheduled maintenance performed during communicated windows</li>
                <li>User-caused disruptions or misuse of the Platform</li>
              </ul>
              <InfoBox type="warning">
                During examination periods and critical academic events, EduNexa deploys additional infrastructure to ensure service continuity. We recommend contacting support in advance to ensure your school's critical periods are noted.
              </InfoBox>
            </SectionCard>

            {/* ── 11. Liability ── */}
            <SectionCard id="liability" icon={Scale} title="11. Limitation of Liability">
              <p>To the maximum extent permitted by applicable Kenyan law, EduNexa Softwares Limited's liability is limited as follows:</p>
              <h3>Disclaimer of Warranties</h3>
              <p>The Platform is provided on an "as is" and "as available" basis without warranties of any kind, express or implied. EduNexa does not warrant that the Platform will be error-free, uninterrupted, or free of harmful components.</p>
              <h3>Limitation of Damages</h3>
              <ul>
                <li>EduNexa shall not be liable for indirect, incidental, consequential, or punitive damages</li>
                <li>Our total aggregate liability for any claims arising from your use of the Platform shall not exceed the total subscription fees paid by you in the 12 months preceding the claim</li>
                <li>EduNexa is not liable for data loss arising from your failure to maintain adequate backups</li>
                <li>We are not responsible for third-party actions, including those of payment processors or integration partners</li>
              </ul>
              <InfoBox type="warning">
                <strong>Important:</strong> Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability. In such cases, EduNexa's liability shall be limited to the fullest extent permitted by applicable law.
              </InfoBox>
              <h3>Indemnification</h3>
              <p>You agree to indemnify, defend, and hold harmless EduNexa, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your use of the Platform, violation of these Terms, or infringement of any third-party rights.</p>
            </SectionCard>

            {/* ── 12. Termination ── */}
             <SectionCard id="termination" icon={Ban} title="12. Suspension and Termination">
              <p>EduNexa reserves the right to suspend or terminate accounts under specific circumstances:</p>
              <h3>Grounds for Suspension or Termination</h3>
              <ul>
                <li>Violation of any provision of these Terms and Conditions</li>
                <li>Failure to pay subscription fees within the grace period</li>
                <li>Engaging in fraudulent, illegal, or harmful activities through the Platform</li>
                <li>Providing false or misleading information during registration</li>
                <li>Compromising the security or integrity of the Platform</li>
                <li>Abusive behavior towards EduNexa staff or other Platform users</li>
              </ul>
              <h3>Process and Notice</h3>
              <ul>
                <li>For non-urgent violations, EduNexa will provide 7 days' written notice before termination</li>
                <li>Immediate suspension may occur without notice for serious security breaches or illegal activities</li>
                <li>You may appeal a suspension or termination decision by contacting our legal team</li>
              </ul>
              <h3>Effect of Termination</h3>
              <ul>
                <li>Upon termination, your right to access the Platform ceases immediately</li>
                <li>You may export your data within 30 days of account closure; after this period, data may be permanently deleted</li>
                <li>Provisions of these Terms that by their nature should survive termination (including IP rights, liability limitations, and dispute resolution) shall remain in effect</li>
              </ul>
              <h3>Voluntary Cancellation</h3>
              <p>You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period unless you qualify for a refund under our Refund Policy.</p>
            </SectionCard>

            {/* ── 13. Third Party ── */}
            <SectionCard id="third-party" icon={Globe} title="13. Third-Party Services">
              <p>The EduNexa Platform integrates with and may utilize services provided by third parties:</p>
              <h3>Integrated Third-Party Services</h3>
              <ul>
                <li><strong>Payment Processors:</strong> Safaricom M-Pesa, Stripe, and other certified payment gateways for fee processing</li>
                <li><strong>SMS Gateways:</strong> Africa's Talking and similar providers for automated communications</li>
                <li><strong>Cloud Infrastructure:</strong> AWS and other providers for data hosting and processing</li>
                <li><strong>Analytics Tools:</strong> Anonymized usage analytics to improve Platform performance</li>
              </ul>
              <InfoBox type="info">
                Third-party services are subject to their own terms and privacy policies. EduNexa carefully vets all integration partners to ensure they meet our privacy and security standards, but we cannot be held responsible for changes to their services or policies.
              </InfoBox>
              <h3>External Links</h3>
              <p>The Platform may contain links to external websites or resources. These links are provided for informational purposes only, and EduNexa does not endorse or assume responsibility for the content, privacy policies, or practices of any third-party sites.</p>
              <h3>Third-Party Data Sharing</h3>
              <p>We share your data with third parties only where strictly necessary to deliver our services (e.g., payment processing) and always in compliance with applicable data protection laws. We maintain data processing agreements with all third-party processors.</p>
            </SectionCard>

            {/* ── 14. Modifications ── */}
            <SectionCard id="modifications" icon={Edit} title="14. Modifications to Terms">
              <p>EduNexa reserves the right to modify these Terms and Conditions at any time to reflect changes in our services, legal requirements, or business practices.</p>
              <h3>Notification of Changes</h3>
              <ul>
                <li>Material changes to these Terms will be communicated via email to your registered address at least 30 days before they take effect</li>
                <li>Minor changes (such as typographical corrections or clarifications) may be made without prior notice</li>
                <li>The "Last Updated" date at the top of this document will always reflect the most recent version</li>
                <li>Changes will be highlighted in a "What's Changed" summary available in the Platform's legal section</li>
              </ul>
              <h3>Acceptance of Modified Terms</h3>
              <p>Your continued use of the Platform following notification of changes constitutes your acceptance of the revised Terms. If you do not agree to the modified Terms, you must discontinue use of the Platform and contact us to arrange account closure.</p>
              <InfoBox type="info">
                We recommend bookmarking this page and reviewing it periodically. The latest version of these Terms will always be accessible at <strong>edunexa.co.ke/terms</strong>.
              </InfoBox>
            </SectionCard>

            {/* ── 15. Law ── */}
            <SectionCard id="governing-law" icon={Gavel} title="15. Governing Law (Kenya)">
              <p>These Terms and Conditions shall be governed by and construed in accordance with the laws of the Republic of Kenya.</p>
              <h3>Applicable Legislation</h3>
              <ul>
                <li><strong>Kenya Data Protection Act, 2019</strong> — governing collection, processing, and storage of personal data</li>
                <li><strong>Kenya Information and Communications Act (Cap 411A)</strong> — governing electronic communications</li>
                <li><strong>Computer Misuse and Cybercrimes Act, 2018</strong> — governing cybersecurity and digital offenses</li>
                <li><strong>Consumer Protection Act, 2012</strong> — governing fair consumer practices</li>
                <li><strong>Copyright Act (Cap 130)</strong> — governing intellectual property rights</li>
              </ul>
              <h3>Dispute Resolution</h3>
              <p>Any disputes arising from or relating to these Terms shall be resolved as follows:</p>
              <ul>
                <li><strong>Step 1 — Negotiation:</strong> The parties shall first attempt to resolve disputes through good faith negotiation within 30 days</li>
                <li><strong>Step 2 — Mediation:</strong> Unresolved disputes shall be submitted to mediation under the Nairobi Centre for International Arbitration (NCIA) rules</li>
                <li><strong>Step 3 — Litigation:</strong> Disputes not resolved through mediation shall be submitted to the exclusive jurisdiction of the High Court of Kenya sitting in Nairobi</li>
              </ul>
              <InfoBox type="info">
                Both parties waive any objection to the jurisdiction and venue of Kenyan courts for any disputes arising from these Terms.
              </InfoBox>
            </SectionCard>

            {/* ── 16. Contact ── */}
            <SectionCard id="contact" icon={Phone} title="16. Contact Information">
              <p>If you have questions, concerns, or requests relating to these Terms or your use of the EduNexa Platform, please contact us through any of the following channels:</p>
              <div className="not-prose grid sm:grid-cols-2 gap-4 my-5">
                {[
                  { icon: Mail, label: "Legal & Compliance Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
                  { icon: Phone, label: "Support Hotline", value: CONTACT.phone, href: `tel:${CONTACT.phone}` },
                  { icon: MapPin, label: "Registered Office", value: CONTACT.address, href: null },
                  { icon: Globe, label: "Website", value: "www.edunexa.co.ke", href: "https://www.edunexa.co.ke" },
                ].map(({ icon: Icon, label, value, href }) => (
                  <div key={label} className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#1a56db] to-[#0ea5e9] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon size={14} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-0.5">{label}</p>
                      {href ? (
                        <a href={href} className="text-sm font-semibold text-[#1a56db] dark:text-blue-400 hover:underline break-all">{value}</a>
                      ) : (
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p>Our legal and compliance team is available Monday to Friday, 8:00 AM to 5:00 PM East Africa Time (EAT). We aim to respond to all formal legal inquiries within 5 business days.</p>
            </SectionCard>

            {/* ── 17. Acceptance ── */}
            <SectionCard id="acceptance" icon={CheckSquare} title="17. Acceptance of Terms">
              <p>By using the EduNexa Platform, you confirm that:</p>
              <ul>
                <li>You have read and fully understood these Terms and Conditions in their entirety</li>
                <li>You agree to be legally bound by all provisions contained herein</li>
                <li>You have the legal authority to accept these Terms on behalf of yourself or your institution</li>
                <li>You acknowledge that these Terms form a legally enforceable contract between you and EduNexa Softwares Limited</li>
                <li>You consent to the collection, processing, and storage of your data as described herein and in our Privacy Policy</li>
              </ul>

              {/* Agree checkbox */}
              <div className="not-prose mt-6">
                <div className={`p-5 rounded-2xl border-2 transition-all duration-300 ${agreeChecked ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-600" : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"}`}>
                  <label className="flex items-start gap-4 cursor-pointer">
                    <div className="relative flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={agreeChecked}
                        onChange={(e) => { setAgreeChecked(e.target.checked); if (!e.target.checked) setAgreed(false); }}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${agreeChecked ? "bg-emerald-500 border-emerald-500" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"}`}>
                        {agreeChecked && <Check size={14} className="text-white font-bold" />}
                      </div>
                    </div>
                    <div>
                      <p className={`font-semibold text-sm leading-snug mb-1 ${agreeChecked ? "text-emerald-800 dark:text-emerald-200" : "text-gray-800 dark:text-gray-200"}`}>
                        I have read, understood, and agree to the EduNexa Softwares Terms &amp; Conditions
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        By checking this box, you confirm you are 18 years of age or older and legally authorized to enter into this agreement. This action constitutes your electronic signature.
                      </p>
                    </div>
                  </label>

                  {agreeChecked && !agreed && (
                    <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">
                      <button
                        onClick={() => setAgreed(true)}
                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                      >
                        <CheckSquare size={16} />
                        Accept &amp; Continue to EduNexa
                      </button>
                    </div>
                  )}

                  {agreed && (
                    <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check size={18} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-800 dark:text-emerald-200 text-sm">Terms Accepted</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">Accepted on {new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

          </main>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="mt-16 bg-gray-900 dark:bg-black text-white border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-[#1a56db] to-[#0ea5e9] rounded-xl flex items-center justify-center">
                  <Sparkles size={17} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">EduNexa Softwares</p>
                  <p className="text-xs text-gray-400">School Management SaaS</p>
                </div>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">
                Empowering Kenyan schools with modern, secure, and intelligent school management solutions.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-4 text-gray-200">Legal</p>
              <ul className="space-y-2.5">
                {["Terms & Conditions", "Privacy Policy", "Cookie Policy", "Data Processing Agreement"].map(l => (
                  <li key={l}><a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-4 text-gray-200">Platform</p>
              <ul className="space-y-2.5">
                {["Features", "Pricing", "Security", "Uptime Status", "API Docs"].map(l => (
                  <li key={l}><a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-4 text-gray-200">Contact</p>
              <ul className="space-y-2.5">
                <li><a href={`mailto:${CONTACT.email}`} className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"><Mail size={11} />{CONTACT.email}</a></li>
                <li><a href={`tel:${CONTACT.phone}`} className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"><Phone size={11} />{CONTACT.phone}</a></li>
                <li><p className="text-xs text-gray-400 flex items-start gap-1.5"><MapPin size={11} className="mt-0.5 flex-shrink-0" />{CONTACT.address}</p></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} EduNexa Softwares Limited. All rights reserved. Registered in Kenya.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={11} /> Last Updated: {CONTACT.effectiveDate}</span>
              <span className="text-xs text-gray-500">Version 1.0</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Scroll to top ── */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 lg:bottom-8 lg:right-8 w-10 h-10 bg-gradient-to-br from-[#1a56db] to-[#0ea5e9] shadow-lg rounded-full flex items-center justify-center text-white z-40 hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
          aria-label="Scroll to top"
        >
          <ArrowUp size={17} />
        </button>
      )}

      {/* Mobile Nav */}
      <MobileNav active={active} open={mobileNavOpen} setOpen={setMobileNavOpen} />
    </div>
  );
}
              