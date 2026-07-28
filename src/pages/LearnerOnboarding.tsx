import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import { fetchWithProxy, writeWithProxy } from '../lib/fetchProxy';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Check, ChevronLeft, ChevronRight, Upload, User, Users, HeartPulse,
  GraduationCap, FileText, Wallet, Loader2, AlertTriangle, X, Camera,
  Save, Printer, Archive,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════════════ */
interface Grade { id: string; grade_name: string; }

interface Guardian {
  _key: string;
  full_name: string;
  relationship: string;
  phone: string;
  alt_phone: string;
  email: string;
  address: string;
  is_emergency_contact: boolean;
  phoneWarning?: string;
}

interface DocSlot {
  doc_type: 'birth_certificate' | 'passport_photo' | 'guardian_id' | 'previous_report' | 'transfer_letter' | 'admission_letter' | 'other';
  label: string;
  optional?: boolean;
  file?: File;
  previewUrl?: string;
  existingUrl?: string;
}

interface LearnerForm {
  admission_number: string;
  admissionAuto: boolean;
  upi_number: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  birth_certificate_number: string;
  nationality: string;
  photo_url: string;
  date_of_admission: string;
  grade_id: string;
  stream: string;
  boarding_status: string;
  previous_school: string;
  student_status: string;

  blood_group: string;
  allergies: string;
  medical_conditions: string;
  special_needs: string;
  emergency_medical_notes: string;

  previous_academic_performance: string;
  admission_category: string;
  talents: string;

  fee_category: string;
  sponsor_bursary: string;
  billing_guardian_key: string;
}

const emptyGuardian = (): Guardian => ({
  _key: Math.random().toString(36).slice(2),
  full_name: '', relationship: '', phone: '', alt_phone: '', email: '', address: '',
  is_emergency_contact: false,
});

const emptyForm = (): LearnerForm => ({
  admission_number: '', admissionAuto: true, upi_number: '',
  first_name: '', middle_name: '', last_name: '',
  gender: '', date_of_birth: '', birth_certificate_number: '', nationality: 'Kenyan',
  photo_url: '', date_of_admission: new Date().toISOString().slice(0, 10),
  grade_id: '', stream: '', boarding_status: 'Day', previous_school: '', student_status: 'Active',
  blood_group: '', allergies: '', medical_conditions: '', special_needs: '', emergency_medical_notes: '',
  previous_academic_performance: '', admission_category: '', talents: '',
  fee_category: '', sponsor_bursary: '', billing_guardian_key: '',
});

const DOC_SLOTS_DEFAULT: DocSlot[] = [
  { doc_type: 'birth_certificate', label: 'Birth Certificate' },
  { doc_type: 'passport_photo',    label: 'Student Passport Photo' },
  { doc_type: 'guardian_id',       label: 'Parent / Guardian ID' },
  { doc_type: 'previous_report',   label: 'Previous Report Form' },
  { doc_type: 'transfer_letter',   label: 'Transfer Letter', optional: true },
  { doc_type: 'admission_letter',  label: 'Admission Letter' },
  { doc_type: 'other',             label: 'Other Supporting Document', optional: true },
];

const STEPS = [
  { key: 'basic',      label: 'Basic Info',   icon: User },
  { key: 'guardians',  label: 'Guardians',    icon: Users },
  { key: 'medical',    label: 'Medical',      icon: HeartPulse },
  { key: 'academic',   label: 'Academic',     icon: GraduationCap },
  { key: 'documents',  label: 'Documents',    icon: FileText },
  { key: 'financial',  label: 'Financial',    icon: Wallet },
  { key: 'review',     label: 'Review',       icon: Check },
];

/* ══════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════ */
const LearnerOnboarding: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditing = !!id;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<LearnerForm>(emptyForm());
  const [guardians, setGuardians] = useState<Guardian[]>([emptyGuardian()]);
  const [docs, setDocs] = useState<DocSlot[]>(DOC_SLOTS_DEFAULT.map(d => ({ ...d })));
  const [studentDbId, setStudentDbId] = useState<number | null>(id ? parseInt(id) : null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dupWarnings, setDupWarnings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);
  const [photoUploading, setPhotoUploading] = useState(false);

  const gradesQuery = useData<Grade>('grades-list-onboard', 'grades', {
    select: 'id, grade_name',
    filters: user?.school_id ? { school_id: user.school_id } : undefined,
  }, !!user?.school_id);
  const grades = useMemo(() => gradesQuery.data || [], [gradesQuery.data]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstLoad = useRef(true);

  /* ── Load existing learner (edit mode) or resume a draft ──────────────── */
  useEffect(() => {
    if (!isEditing || !user?.school_id) return;
    (async () => {
      setLoadingExisting(true);
      const { data } = await fetchWithProxy('students', {
        filters: { id: parseInt(id!), school_id: user.school_id },
        single: true,
      });
      const s = Array.isArray(data) ? data[0] : data;
      if (s) {
        setForm(f => ({
          ...f,
          admission_number: s.admission_number || '', admissionAuto: false,
          upi_number: s.upi_number || '',
          first_name: s.first_name || '', middle_name: s.middle_name || '', last_name: s.last_name || '',
          gender: s.gender || '', date_of_birth: s.date_of_birth || '',
          birth_certificate_number: s.birth_certificate_number || '', nationality: s.nationality || 'Kenyan',
          photo_url: s.photo_url || '', date_of_admission: s.date_of_admission || f.date_of_admission,
          grade_id: s.grade_id ? String(s.grade_id) : '', stream: s.stream || '',
          boarding_status: s.boarding_status || 'Day', previous_school: s.previous_school || '',
          student_status: s.student_status || 'Active',
          blood_group: s.blood_group || '', allergies: s.allergies || '',
          medical_conditions: s.medical_conditions || '', special_needs: s.special_needs || '',
          emergency_medical_notes: s.emergency_medical_notes || '',
          previous_academic_performance: s.previous_academic_performance || '',
          admission_category: s.admission_category || '', talents: s.talents || '',
          fee_category: s.fee_category || '', sponsor_bursary: s.sponsor_bursary || '',
          billing_guardian_key: '',
        }));
      }
      const { data: gData } = await fetchWithProxy('guardians', { filters: { student_id: parseInt(id!) } });
      if (Array.isArray(gData) && gData.length) {
        setGuardians(gData.map((g: any) => ({
          _key: String(g.id), full_name: g.full_name, relationship: g.relationship || '',
          phone: g.phone || '', alt_phone: g.alt_phone || '', email: g.email || '',
          address: g.address || '', is_emergency_contact: !!g.is_emergency_contact,
        })));
      }
      const { data: docData } = await fetchWithProxy('learner_documents', { filters: { student_id: parseInt(id!) } });
      if (Array.isArray(docData) && docData.length) {
        setDocs(prev => prev.map(slot => {
          const match = docData.find((d: any) => d.doc_type === slot.doc_type);
          return match ? { ...slot, existingUrl: match.file_url } : slot;
        }));
      }
      setLoadingExisting(false);
      firstLoad.current = false;
    })();
  }, [isEditing, id, user?.school_id]);

  /* ── Auto-generate admission number for new learners ──────────────────── */
  useEffect(() => {
    if (isEditing || !user?.school_id || !form.admissionAuto) return;
    (async () => {
      const { data } = await fetchWithProxy('students', {
        select: 'admission_number',
        filters: { school_id: user.school_id },
        orderBy: { column: 'admission_number', ascending: false },
        limit: 1,
      });
      const last = Array.isArray(data) && data[0]?.admission_number;
      const num = last ? (parseInt(String(last).replace(/\D/g, '')) || 0) + 1 : 1;
      const yr = new Date().getFullYear().toString().slice(-2);
      setForm(f => ({ ...f, admission_number: `ADM${yr}${String(num).padStart(4, '0')}` }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.school_id, isEditing]);

  /* ── Duplicate detection (debounced) ───────────────────────────────────── */
  const checkDuplicate = useCallback(async (field: 'admission_number' | 'upi_number' | 'birth_certificate_number', value: string) => {
    if (!value || !user?.school_id) { setDupWarnings(w => ({ ...w, [field]: '' })); return; }
    const filters: Record<string, unknown> = { [field]: value };
    if (field === 'admission_number') filters.school_id = user.school_id;
    const { count } = await fetchWithProxy('students', { filters, countOnly: true });
    const isSelf = isEditing && studentDbId;
    const dupCount = count ?? 0;
    if (dupCount > (isSelf ? 1 : 0)) {
      setDupWarnings(w => ({ ...w, [field]: `This ${field.replace(/_/g, ' ')} is already in use by another learner.` }));
    } else {
      setDupWarnings(w => ({ ...w, [field]: '' }));
    }
  }, [user?.school_id, isEditing, studentDbId]);

  const checkGuardianPhoneDuplicate = useCallback(async (key: string, phone: string) => {
    if (!phone || !user?.school_id) return;
    const { count } = await fetchWithProxy('guardians', { filters: { school_id: user.school_id, phone }, countOnly: true });
    if ((count ?? 0) > 0) {
      setGuardians(gs => gs.map(g => g._key === key ? { ...g, phoneWarning: 'A guardian with this phone number already exists — they may already be linked to another learner.' } : g));
    } else {
      setGuardians(gs => gs.map(g => g._key === key ? { ...g, phoneWarning: undefined } : g));
    }
  }, [user?.school_id]);

  /* ── Auto-save draft (debounced, whole-form snapshot) ──────────────────── */
  const saveDraft = useCallback(async () => {
    if (!user?.school_id || !user?.id) return;
    setAutoSaveState('saving');
    try {
      const draftPayload = {
        school_id: user.school_id,
        name: `${form.first_name} ${form.last_name}`.trim() || 'Draft Learner',
        admission_number: form.admission_number || `DRAFT-${Date.now()}`,
        grade_id: form.grade_id ? parseInt(form.grade_id) : null,
        gender: form.gender || null,
        is_draft: true,
        draft_data: { form, guardians, step },
        updated_by: user.id,
      };
      if (studentDbId) {
        await writeWithProxy('students', 'update', { draft_data: draftPayload.draft_data, updated_by: user.id }, { id: studentDbId });
      } else {
        const { data } = await writeWithProxy('students', 'insert', { ...draftPayload, created_by: user.id });
        const newId = Array.isArray(data) ? data[0]?.id : undefined;
        if (newId) setStudentDbId(newId);
      }
      setAutoSaveState('saved');
    } catch {
      setAutoSaveState('error');
    }
  }, [form, guardians, step, studentDbId, user?.school_id, user?.id]);

  useEffect(() => {
    if (firstLoad.current && isEditing) return; // don't autosave while loading existing record
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { saveDraft(); }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, guardians]);

  /* ── Field validation per step ──────────────────────────────────────────── */
  const validateStep = (stepIdx: number): boolean => {
    const e: Record<string, string> = {};
    if (stepIdx === 0) {
      if (!form.admission_number) e.admission_number = 'Required';
      if (!form.first_name) e.first_name = 'Required';
      if (!form.last_name) e.last_name = 'Required';
      if (!form.gender) e.gender = 'Required';
      if (!form.date_of_birth) e.date_of_birth = 'Required';
      if (!form.grade_id) e.grade_id = 'Required';
      if (!form.date_of_admission) e.date_of_admission = 'Required';
    }
    if (stepIdx === 1) {
      if (!guardians.length || !guardians.some(g => g.full_name && g.phone)) {
        e.guardians = 'At least one guardian with a name and phone number is required';
      }
      if (!guardians.some(g => g.is_emergency_contact)) {
        e.guardians_emergency = 'Mark at least one guardian as the emergency contact';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => { if (validateStep(step)) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  /* ── Photo upload ───────────────────────────────────────────────────────── */
  const handlePhotoSelect = async (file: File) => {
    setPhotoUploading(true);
    try {
      // Center-crop to square client-side (simple, dependency-free crop).
      const cropped = await centerCropSquare(file, 480);
      const path = `${user?.school_id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { error } = await supabase.storage.from('learner-photos').upload(path, cropped, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('learner-photos').getPublicUrl(path);
      setForm(f => ({ ...f, photo_url: pub.publicUrl }));
    } catch {
      setBanner({ type: 'error', msg: 'Photo upload failed. Please try a different image.' });
    } finally {
      setPhotoUploading(false);
    }
  };

  /* ── Document upload (deferred: files stored in state, uploaded on submit) ─ */
  const handleDocSelect = (docType: DocSlot['doc_type'], file: File) => {
    setDocs(prev => prev.map(d => d.doc_type === docType
      ? { ...d, file, previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined }
      : d));
  };

  /* ── Final submit ───────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!validateStep(0) || !validateStep(1)) { setBanner({ type: 'error', msg: 'Please complete all required fields before submitting.' }); return; }
    if (dupWarnings.admission_number || dupWarnings.upi_number || dupWarnings.birth_certificate_number) {
      setBanner({ type: 'error', msg: 'Please resolve duplicate warnings before submitting.' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        school_id: user?.school_id,
        name: `${form.first_name} ${form.middle_name} ${form.last_name}`.replace(/\s+/g, ' ').trim(),
        first_name: form.first_name, middle_name: form.middle_name || null, last_name: form.last_name,
        admission_number: form.admission_number, upi_number: form.upi_number || null,
        gender: form.gender, date_of_birth: form.date_of_birth,
        birth_certificate_number: form.birth_certificate_number || null, nationality: form.nationality || null,
        photo_url: form.photo_url || null, date_of_admission: form.date_of_admission,
        grade_id: parseInt(form.grade_id), stream: form.stream || null,
        boarding_status: form.boarding_status, previous_school: form.previous_school || null,
        student_status: form.student_status,
        blood_group: form.blood_group || null, allergies: form.allergies || null,
        medical_conditions: form.medical_conditions || null, special_needs: form.special_needs || null,
        emergency_medical_notes: form.emergency_medical_notes || null,
        previous_academic_performance: form.previous_academic_performance || null,
        admission_category: form.admission_category || null, talents: form.talents || null,
        fee_category: form.fee_category || null, sponsor_bursary: form.sponsor_bursary || null,
        is_draft: false,
        updated_by: user?.id,
      };

      let finalId = studentDbId;
      if (finalId) {
        await writeWithProxy('students', 'update', payload, { id: finalId });
      } else {
        const { data } = await writeWithProxy('students', 'insert', { ...payload, created_by: user?.id });
        finalId = Array.isArray(data) ? data[0]?.id : null;
        setStudentDbId(finalId);
      }
      if (!finalId) throw new Error('Could not resolve learner record id');

      // Guardians: delete-then-reinsert is simplest & safe for a modest guardian count.
      await writeWithProxy('guardians', 'delete', undefined, { student_id: finalId });
      for (const g of guardians.filter(g => g.full_name && g.phone)) {
        await writeWithProxy('guardians', 'insert', {
          student_id: finalId, school_id: user?.school_id,
          full_name: g.full_name, relationship: g.relationship || null,
          phone: g.phone, alt_phone: g.alt_phone || null, email: g.email || null,
          address: g.address || null, is_emergency_contact: g.is_emergency_contact,
        });
      }

      // Documents: upload any newly-selected files, record metadata.
      for (const d of docs) {
        if (!d.file) continue;
        const path = `${user?.school_id}/${finalId}/${d.doc_type}_${Date.now()}_${d.file.name.replace(/\s+/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('learner-documents').upload(path, d.file, { upsert: true });
        if (upErr) continue;
        await writeWithProxy('learner_documents', 'insert', {
          student_id: finalId, school_id: user?.school_id, doc_type: d.doc_type,
          file_url: path, file_name: d.file.name, uploaded_by: user?.id,
        });
      }

      setBanner({ type: 'success', msg: 'Learner profile saved successfully.' });
      setTimeout(() => navigate('/students'), 1200);
    } catch (err: unknown) {
      setBanner({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to save learner profile.' });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── PDF export ─────────────────────────────────────────────────────────── */
  const printProfile = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('LEARNER PROFILE', 105, 16, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`${form.first_name} ${form.middle_name} ${form.last_name}`.replace(/\s+/g, ' '), 105, 24, { align: 'center' });

    autoTable(doc, {
      startY: 32,
      head: [['Field', 'Value']],
      body: [
        ['Admission No', form.admission_number], ['UPI Number', form.upi_number],
        ['Gender', form.gender], ['Date of Birth', form.date_of_birth],
        ['Birth Cert. No', form.birth_certificate_number], ['Nationality', form.nationality],
        ['Grade', grades.find(g => String(g.id) === form.grade_id)?.grade_name || ''],
        ['Stream', form.stream], ['Boarding Status', form.boarding_status],
        ['Status', form.student_status], ['Previous School', form.previous_school],
      ],
      theme: 'grid', styles: { fontSize: 8 },
    });

    const y1 = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold'); doc.text('Parents / Guardians', 14, y1);
    autoTable(doc, {
      startY: y1 + 3,
      head: [['Name', 'Relationship', 'Phone', 'Emergency']],
      body: guardians.filter(g => g.full_name).map(g => [g.full_name, g.relationship, g.phone, g.is_emergency_contact ? 'Yes' : 'No']),
      theme: 'grid', styles: { fontSize: 8 },
    });

    const y2 = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold'); doc.text('Medical / Health', 14, y2);
    autoTable(doc, {
      startY: y2 + 3,
      body: [
        ['Blood Group', form.blood_group], ['Allergies', form.allergies],
        ['Medical Conditions', form.medical_conditions], ['Special Needs', form.special_needs],
      ],
      theme: 'grid', styles: { fontSize: 8 },
    });

    doc.save(`Learner_Profile_${form.admission_number || 'draft'}.pdf`);
  };

  const archiveLearner = async () => {
    if (!studentDbId) return;
    if (!window.confirm('Archive this learner? Their record will be hidden but not permanently deleted.')) return;
    await writeWithProxy('students', 'update', { deleted_at: new Date().toISOString(), deleted_by: user?.id }, { id: studentDbId });
    navigate('/students');
  };

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  if (loadingExisting) {
    return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isEditing ? 'Edit Learner Profile' : 'Learner Admission'}</h1>
          <p className="text-slate-500 text-sm">Complete each section to build the learner's full profile.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {autoSaveState === 'saving' && <span className="flex items-center gap-1 text-slate-400"><Loader2 size={12} className="animate-spin" /> Saving draft…</span>}
          {autoSaveState === 'saved'  && <span className="flex items-center gap-1 text-green-600"><Save size={12} /> Draft saved</span>}
          {autoSaveState === 'error'  && <span className="flex items-center gap-1 text-red-500"><AlertTriangle size={12} /> Draft save failed</span>}
        </div>
      </div>

      {banner && (
        <div className={`rounded-xl p-4 flex items-center justify-between text-sm font-medium ${banner.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {banner.msg}
          <button onClick={() => setBanner(null)}><X size={16} /></button>
        </div>
      )}

      {/* Stepper */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 overflow-x-auto">
        <div className="flex items-center min-w-max">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step, done = i < step;
            return (
              <React.Fragment key={s.key}>
                <button onClick={() => setStep(i)} className="flex flex-col items-center gap-1 px-2">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                    ${active ? 'bg-blue-600 border-blue-600 text-white' : done ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                    {done ? <Check size={16} /> : <Icon size={16} />}
                  </div>
                  <span className={`text-[10px] font-medium ${active ? 'text-blue-600' : 'text-slate-400'}`}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <div className={`h-0.5 w-8 ${i < step ? 'bg-green-400' : 'bg-slate-200'}`} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-slate-100 p-6">
        {step === 0 && (
          <BasicInfoStep form={form} setForm={setForm} errors={errors} dupWarnings={dupWarnings}
            checkDuplicate={checkDuplicate} grades={grades} photoUploading={photoUploading} onPhotoSelect={handlePhotoSelect} />
        )}
        {step === 1 && (
          <GuardiansStep guardians={guardians} setGuardians={setGuardians} errors={errors} onPhoneBlur={checkGuardianPhoneDuplicate} />
        )}
        {step === 2 && <MedicalStep form={form} setForm={setForm} />}
        {step === 3 && <AcademicStep form={form} setForm={setForm} />}
        {step === 4 && <DocumentsStep docs={docs} onSelect={handleDocSelect} />}
        {step === 5 && <FinancialStep form={form} setForm={setForm} guardians={guardians} />}
        {step === 6 && <ReviewStep form={form} guardians={guardians} docs={docs} grades={grades} />}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={goBack} disabled={step === 0}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 disabled:opacity-40">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          {isEditing && (
            <button onClick={archiveLearner} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200">
              <Archive size={16} /> Archive
            </button>
          )}
          <button onClick={printProfile} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200">
            <Printer size={16} /> Print Profile
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={goNext} className="inline-flex items-center gap-1 px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white">
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="inline-flex items-center gap-1 px-5 py-2 rounded-lg text-sm font-bold bg-green-600 text-white disabled:opacity-60">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Submit Admission
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════
   STEP: BASIC INFO
══════════════════════════════════════════════════════════════════════ */
const Field: React.FC<{ label: string; required?: boolean; error?: string; warning?: string; children: React.ReactNode }> = ({ label, required, error, warning, children }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-slate-500 uppercase">{label}{required && <span className="text-red-500"> *</span>}</label>
    {children}
    {error && <p className="text-xs text-red-500">{error}</p>}
    {warning && !error && <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={11} /> {warning}</p>}
  </div>
);

const inputCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20";

const BasicInfoStep: React.FC<any> = ({ form, setForm, errors, dupWarnings, checkDuplicate, grades, photoUploading, onPhotoSelect }) => (
  <div className="grid md:grid-cols-3 gap-5">
    <div className="md:col-span-3 flex items-center gap-4">
      <div className="w-24 h-24 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative">
        {photoUploading ? <Loader2 className="animate-spin text-blue-500" /> : form.photo_url
          ? <img src={form.photo_url} alt="Learner" className="w-full h-full object-cover" />
          : <Camera className="text-slate-300" size={28} />}
      </div>
      <label className="cursor-pointer text-sm font-medium text-blue-600 inline-flex items-center gap-1">
        <Upload size={14} /> Upload Passport Photo
        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onPhotoSelect(e.target.files[0])} />
      </label>
    </div>

    <Field label="Admission Number" required error={errors.admission_number} warning={dupWarnings.admission_number}>
      <div className="flex gap-2">
        <input className={inputCls} value={form.admission_number} disabled={form.admissionAuto}
          onChange={e => setForm((f: LearnerForm) => ({ ...f, admission_number: e.target.value }))}
          onBlur={e => checkDuplicate('admission_number', e.target.value)} />
        <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
          <input type="checkbox" checked={form.admissionAuto} onChange={e => setForm((f: LearnerForm) => ({ ...f, admissionAuto: e.target.checked }))} /> Auto
        </label>
      </div>
    </Field>
    <Field label="UPI Number" warning={dupWarnings.upi_number}>
      <input className={inputCls} value={form.upi_number}
        onChange={e => setForm((f: LearnerForm) => ({ ...f, upi_number: e.target.value }))}
        onBlur={e => checkDuplicate('upi_number', e.target.value)} />
    </Field>
    <Field label="Birth Certificate Number" warning={dupWarnings.birth_certificate_number}>
      <input className={inputCls} value={form.birth_certificate_number}
        onChange={e => setForm((f: LearnerForm) => ({ ...f, birth_certificate_number: e.target.value }))}
        onBlur={e => checkDuplicate('birth_certificate_number', e.target.value)} />
    </Field>

    <Field label="First Name" required error={errors.first_name}>
      <input className={inputCls} value={form.first_name} onChange={e => setForm((f: LearnerForm) => ({ ...f, first_name: e.target.value }))} />
    </Field>
    <Field label="Middle Name">
      <input className={inputCls} value={form.middle_name} onChange={e => setForm((f: LearnerForm) => ({ ...f, middle_name: e.target.value }))} />
    </Field>
    <Field label="Last Name" required error={errors.last_name}>
      <input className={inputCls} value={form.last_name} onChange={e => setForm((f: LearnerForm) => ({ ...f, last_name: e.target.value }))} />
    </Field>

    <Field label="Gender" required error={errors.gender}>
      <select className={inputCls} value={form.gender} onChange={e => setForm((f: LearnerForm) => ({ ...f, gender: e.target.value }))}>
        <option value="">Select</option><option>Male</option><option>Female</option>
      </select>
    </Field>
    <Field label="Date of Birth" required error={errors.date_of_birth}>
      <input type="date" className={inputCls} value={form.date_of_birth} onChange={e => setForm((f: LearnerForm) => ({ ...f, date_of_birth: e.target.value }))} />
    </Field>
    <Field label="Nationality">
      <input className={inputCls} value={form.nationality} onChange={e => setForm((f: LearnerForm) => ({ ...f, nationality: e.target.value }))} />
    </Field>

    <Field label="Date of Admission" required error={errors.date_of_admission}>
      <input type="date" className={inputCls} value={form.date_of_admission} onChange={e => setForm((f: LearnerForm) => ({ ...f, date_of_admission: e.target.value }))} />
    </Field>
    <Field label="Grade / Class" required error={errors.grade_id}>
      <select className={inputCls} value={form.grade_id} onChange={e => setForm((f: LearnerForm) => ({ ...f, grade_id: e.target.value }))}>
        <option value="">Select</option>
        {grades.map((g: Grade) => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
      </select>
    </Field>
    <Field label="Stream">
      <input className={inputCls} value={form.stream} onChange={e => setForm((f: LearnerForm) => ({ ...f, stream: e.target.value }))} />
    </Field>

    <Field label="Boarding Status">
      <select className={inputCls} value={form.boarding_status} onChange={e => setForm((f: LearnerForm) => ({ ...f, boarding_status: e.target.value }))}>
        <option>Day</option><option>Boarding</option>
      </select>
    </Field>
    <Field label="Previous School">
      <input className={inputCls} value={form.previous_school} onChange={e => setForm((f: LearnerForm) => ({ ...f, previous_school: e.target.value }))} />
    </Field>
    <Field label="Student Status">
      <select className={inputCls} value={form.student_status} onChange={e => setForm((f: LearnerForm) => ({ ...f, student_status: e.target.value }))}>
        <option>Active</option><option>Transferred</option><option>Alumni</option><option>Suspended</option>
      </select>
    </Field>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════
   STEP: GUARDIANS
══════════════════════════════════════════════════════════════════════ */
const GuardiansStep: React.FC<any> = ({ guardians, setGuardians, errors, onPhoneBlur }) => {
  const update = (key: string, patch: Partial<Guardian>) =>
    setGuardians((gs: Guardian[]) => gs.map(g => g._key === key ? { ...g, ...patch } : g));
  const remove = (key: string) => setGuardians((gs: Guardian[]) => gs.filter(g => g._key !== key));
  const add = () => setGuardians((gs: Guardian[]) => [...gs, emptyGuardian()]);

  return (
    <div className="space-y-5">
      {errors.guardians && <p className="text-sm text-red-500 flex items-center gap-1"><AlertTriangle size={14} /> {errors.guardians}</p>}
      {errors.guardians_emergency && <p className="text-sm text-red-500 flex items-center gap-1"><AlertTriangle size={14} /> {errors.guardians_emergency}</p>}
      {guardians.map((g: Guardian, idx: number) => (
        <div key={g._key} className="border border-slate-200 rounded-xl p-4 space-y-3 relative">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">Guardian {idx + 1}</span>
            {guardians.length > 1 && <button onClick={() => remove(g._key)} className="text-red-500"><X size={16} /></button>}
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Full Name" required><input className={inputCls} value={g.full_name} onChange={e => update(g._key, { full_name: e.target.value })} /></Field>
            <Field label="Relationship"><input className={inputCls} value={g.relationship} onChange={e => update(g._key, { relationship: e.target.value })} placeholder="Mother / Father / Guardian" /></Field>
            <Field label="Phone Number" required warning={g.phoneWarning}>
              <input className={inputCls} value={g.phone} onChange={e => update(g._key, { phone: e.target.value })} onBlur={e => onPhoneBlur(g._key, e.target.value)} />
            </Field>
            <Field label="Alternative Phone"><input className={inputCls} value={g.alt_phone} onChange={e => update(g._key, { alt_phone: e.target.value })} /></Field>
            <Field label="Email (Optional)"><input type="email" className={inputCls} value={g.email} onChange={e => update(g._key, { email: e.target.value })} /></Field>
            <Field label="Physical Address"><input className={inputCls} value={g.address} onChange={e => update(g._key, { address: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={g.is_emergency_contact} onChange={e => update(g._key, { is_emergency_contact: e.target.checked })} />
            Emergency contact
          </label>
        </div>
      ))}
      <button onClick={add} className="text-sm font-medium text-blue-600">+ Add another parent / guardian</button>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════
   STEP: MEDICAL
══════════════════════════════════════════════════════════════════════ */
const MedicalStep: React.FC<any> = ({ form, setForm }) => (
  <div className="grid md:grid-cols-2 gap-5">
    <Field label="Blood Group (Optional)">
      <select className={inputCls} value={form.blood_group} onChange={e => setForm((f: LearnerForm) => ({ ...f, blood_group: e.target.value }))}>
        <option value="">Unknown</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b}>{b}</option>)}
      </select>
    </Field>
    <Field label="Allergies"><input className={inputCls} value={form.allergies} onChange={e => setForm((f: LearnerForm) => ({ ...f, allergies: e.target.value }))} /></Field>
    <Field label="Medical Conditions (if any)"><textarea className={inputCls} rows={3} value={form.medical_conditions} onChange={e => setForm((f: LearnerForm) => ({ ...f, medical_conditions: e.target.value }))} /></Field>
    <Field label="Special Needs (if any)"><textarea className={inputCls} rows={3} value={form.special_needs} onChange={e => setForm((f: LearnerForm) => ({ ...f, special_needs: e.target.value }))} /></Field>
    <div className="md:col-span-2">
      <Field label="Emergency Medical Notes"><textarea className={inputCls} rows={3} value={form.emergency_medical_notes} onChange={e => setForm((f: LearnerForm) => ({ ...f, emergency_medical_notes: e.target.value }))} /></Field>
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════
   STEP: ACADEMIC
══════════════════════════════════════════════════════════════════════ */
const AcademicStep: React.FC<any> = ({ form, setForm }) => (
  <div className="grid md:grid-cols-2 gap-5">
    <Field label="Previous School"><input className={inputCls} value={form.previous_school} onChange={e => setForm((f: LearnerForm) => ({ ...f, previous_school: e.target.value }))} /></Field>
    <Field label="Admission Category"><input className={inputCls} value={form.admission_category} onChange={e => setForm((f: LearnerForm) => ({ ...f, admission_category: e.target.value }))} placeholder="e.g. Regular, Special Needs, Transfer" /></Field>
    <div className="md:col-span-2">
      <Field label="Previous Academic Performance (Optional)"><textarea className={inputCls} rows={3} value={form.previous_academic_performance} onChange={e => setForm((f: LearnerForm) => ({ ...f, previous_academic_performance: e.target.value }))} /></Field>
    </div>
    <div className="md:col-span-2">
      <Field label="Talents / Co-curricular Interests"><textarea className={inputCls} rows={2} value={form.talents} onChange={e => setForm((f: LearnerForm) => ({ ...f, talents: e.target.value }))} /></Field>
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════
   STEP: DOCUMENTS
══════════════════════════════════════════════════════════════════════ */
const DocumentsStep: React.FC<any> = ({ docs, onSelect }) => (
  <div className="grid md:grid-cols-2 gap-4">
    {docs.map((d: DocSlot) => (
      <div key={d.doc_type} className="border border-slate-200 rounded-xl p-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
          {d.previewUrl ? <img src={d.previewUrl} className="w-full h-full object-cover" alt={d.label} />
            : d.existingUrl ? <FileText className="text-blue-500" />
            : <Upload className="text-slate-300" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-700">{d.label}{d.optional && <span className="text-slate-400 font-normal"> (optional)</span>}</p>
          <p className="text-xs text-slate-400">{d.file?.name || (d.existingUrl ? 'Uploaded' : 'No file selected')}</p>
          <label className="text-xs font-medium text-blue-600 cursor-pointer">
            {d.existingUrl || d.file ? 'Replace file' : 'Choose file'}
            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && onSelect(d.doc_type, e.target.files[0])} />
          </label>
        </div>
      </div>
    ))}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════
   STEP: FINANCIAL
══════════════════════════════════════════════════════════════════════ */
const FinancialStep: React.FC<any> = ({ form, setForm, guardians }) => (
  <div className="grid md:grid-cols-2 gap-5">
    <Field label="Fee Category"><input className={inputCls} value={form.fee_category} onChange={e => setForm((f: LearnerForm) => ({ ...f, fee_category: e.target.value }))} placeholder="e.g. Standard, Bursary, Scholarship" /></Field>
    <Field label="Sponsor / Bursary (if applicable)"><input className={inputCls} value={form.sponsor_bursary} onChange={e => setForm((f: LearnerForm) => ({ ...f, sponsor_bursary: e.target.value }))} /></Field>
    <Field label="Billing Parent / Guardian">
      <select className={inputCls} value={form.billing_guardian_key} onChange={e => setForm((f: LearnerForm) => ({ ...f, billing_guardian_key: e.target.value }))}>
        <option value="">Select guardian</option>
        {guardians.filter((g: Guardian) => g.full_name).map((g: Guardian) => <option key={g._key} value={g._key}>{g.full_name}</option>)}
      </select>
    </Field>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════
   STEP: REVIEW
══════════════════════════════════════════════════════════════════════ */
const ReviewStep: React.FC<any> = ({ form, guardians, docs, grades }) => (
  <div className="space-y-6 text-sm">
    <div>
      <h3 className="font-bold text-slate-800 mb-2">Basic Information</h3>
      <div className="grid md:grid-cols-3 gap-2 text-slate-600">
        <p><span className="text-slate-400">Name:</span> {form.first_name} {form.middle_name} {form.last_name}</p>
        <p><span className="text-slate-400">Admission No:</span> {form.admission_number}</p>
        <p><span className="text-slate-400">Grade:</span> {grades.find((g: Grade) => String(g.id) === form.grade_id)?.grade_name}</p>
        <p><span className="text-slate-400">Gender:</span> {form.gender}</p>
        <p><span className="text-slate-400">DOB:</span> {form.date_of_birth}</p>
        <p><span className="text-slate-400">Boarding:</span> {form.boarding_status}</p>
      </div>
    </div>
    <div>
      <h3 className="font-bold text-slate-800 mb-2">Guardians</h3>
      {guardians.filter((g: Guardian) => g.full_name).map((g: Guardian) => (
        <p key={g._key} className="text-slate-600">{g.full_name} — {g.relationship} — {g.phone} {g.is_emergency_contact && <span className="text-green-600 font-medium">(Emergency)</span>}</p>
      ))}
    </div>
    <div>
      <h3 className="font-bold text-slate-800 mb-2">Documents attached</h3>
      <p className="text-slate-600">{docs.filter((d: DocSlot) => d.file || d.existingUrl).map((d: DocSlot) => d.label).join(', ') || 'None yet'}</p>
    </div>
    <p className="text-xs text-slate-400">Review each section using the stepper above, then click Submit Admission to save this learner profile.</p>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════
   HELPER: client-side center-square crop (no external cropping library)
══════════════════════════════════════════════════════════════════════ */
async function centerCropSquare(file: File, size: number): Promise<File> {
  const img = document.createElement('img');
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  URL.revokeObjectURL(url);
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b as Blob), 'image/jpeg', 0.85));
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

export default LearnerOnboarding;