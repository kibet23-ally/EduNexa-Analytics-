import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { User, Subject, Grade } from '../types';
import { UserPlus, Link as LinkIcon, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useData, useDataMutation } from '../hooks/useData';
import { TableSkeleton } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 50;

interface AssignmentRecord {
id: number;
teacher_id: number;
teachers?: { name: string };
subject_id: number;
subjects?: { subject_name: string };
grade_id: number;
grades?: { grade_name: string };
}

const Teachers = () => {
const { user } = useAuth();
const { isReadOnly } = useSubscription();
const [page, setPage] = useState(0);

// Mutations
const teachersMutation = useDataMutation('teachers');
const assignmentMutation = useDataMutation('teacher_assignments');

// Optimized Fetching
const teachersQuery = useData<User>('teachers-page', 'teachers', {
range: { from: page * PAGE_SIZE, to: (page + 1) * PAGE_SIZE - 1 },
orderBy: { column: 'name' }
} as any, !!user?.school_id);

const subjectsQuery = useData<Subject>('subjects-list', 'subjects', {
select: 'id, subject_name',
orderBy: { column: 'subject_name' }
}, !!user?.school_id);

const gradesQuery = useData<Grade>('grades-list', 'grades', {
select: 'id, grade_name',
orderBy: { column: 'grade_name' }
}, !!user?.school_id);

const assignmentsQuery = useData<AssignmentRecord>('assignments-list', 'teacher_assignments', {
select: '*, teachers:teacher_id(id, name), subjects:subject_id(id, subject_name), grades:grade_id(id, grade_name)'
}, !!user?.school_id);

// Local UI State
const [showTeacherModal, setShowTeacherModal] = useState(false);
const [showAssignModal, setShowAssignModal] = useState(false);
const [loading, setLoading] = useState(false);
const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
const [assignmentDeleteConfirmId, setAssignmentDeleteConfirmId] = useState<number | null>(null);

const [teacherForm, setTeacherForm] = useState({ id: '', name: '', email: '', phone: '', password: '', role: 'Teacher' });
const [isEditing, setIsEditing] = useState(false);
const [assignForm, setAssignForm] = useState({ teacher_id: '', subject_id: '', grade_id: '' });

const NON_TEACHER_ROLES = ['superadmin', 'super_admin', 'admin'];
const teachers = useMemo(() => {
const data = (teachersQuery.data as User[]) || [];
return data.filter(
t => !NON_TEACHER_ROLES.includes((t.role || '').toLowerCase().replace(/_/g, ''))
);
}, [teachersQuery.data]);
const subjects = useMemo(() => (subjectsQuery.data as Subject[]) || [], [subjectsQuery.data]);
const grades = useMemo(() => (gradesQuery.data as Grade[]) || [], [gradesQuery.data]);
const rawAssignments = useMemo(() => (assignmentsQuery.data as AssignmentRecord[]) || [], [assignmentsQuery.data]);

const processedAssignments = useMemo(() => {
return rawAssignments.map((item) => ({
id: item.id,
teacher_id: item.teacher_id,
teacher_name: item.teachers?.name || 'Unknown',
subject_id: item.subject_id,
subject_name: item.subjects?.subject_name || 'Unknown',
grade_id: item.grade_id,
grade_name: item.grades?.grade_name || 'Unknown'
}));
}, [rawAssignments]);

const handleSaveTeacher = async (e: React.FormEvent) => {
e.preventDefault();
if (isReadOnly) return;

// Password is required for new teachers  
if (!isEditing && (!teacherForm.password || teacherForm.password.length < 6)) {  
  setFeedback({ type: 'error', message: 'Password must be at least 6 characters.' });  
  return;  
}  

setLoading(true);  
setFeedback(null);  

try {  
  // Validate Kenya phone number format (+254)  
  let cleanPhone = teacherForm.phone.replace(/\s+/g, '');  
  if (cleanPhone) {  
    if (cleanPhone.startsWith('0')) {  
      cleanPhone = '+254' + cleanPhone.substring(1);  
    } else if (!cleanPhone.startsWith('+')) {  
      cleanPhone = '+254' + cleanPhone;  
    }  
    if (!/^\+254\d{9}$/.test(cleanPhone)) {  
      throw new Error('Invalid Kenya phone number format. Use +2547XXXXXXXX');  
    }  
  }  

  // Check for duplicate phone number  
  if (cleanPhone) {  
    const { data: existingPhone } = await supabase  
      .from('teachers')  
      .select('id')  
      .eq('phone', cleanPhone)  
      .neq('id', teacherForm.id || '00000000-0000-0000-0000-000000000000')  
      .maybeSingle();  

    if (existingPhone) {  
      throw new Error('This phone number is already registered to another teacher.');  
    }  
  }  

  if (isEditing) {  
    // Update existing teacher  
    const payload: any = {  
      name: teacherForm.name,  
      email: teacherForm.email,  
      phone: cleanPhone || null,  
      role: teacherForm.role || 'Teacher',  
    };  
    if (teacherForm.password) payload.password = teacherForm.password;  

    await teachersMutation.mutateAsync({  
      operation: 'update',  
      payload,  
      filters: { id: teacherForm.id }  
    });  

    // Update auth metadata if needed (via edge function or direct if admin)  
    await supabase.functions.invoke('update-teacher-auth', {  
      body: {  
        id: teacherForm.id,  
        name: teacherForm.name,  
        email: teacherForm.email,  
        phone: cleanPhone || null,  
        role: teacherForm.role?.toLowerCase() === 'admin' ? 'school_admin' : 'teacher',  
      }  
    });  

    setFeedback({ type: 'success', message: `${teacherForm.name} updated successfully.` });  
  } else {  
    // Create new teacher  
    const payload = {  
      name:      teacherForm.name,  
      email:     teacherForm.email,  
      phone:     cleanPhone || null,  
      password:  teacherForm.password,  
      role:      teacherForm.role || 'Teacher',  
      school_id: Number(user?.school_id),  
    };  

    const result = await teachersMutation.mutateAsync({  
      operation: 'insert',  
      payload: [payload],  
    });  

    const teacherId = Array.isArray(result?.data) ? result?.data[0]?.id : result?.data?.id;  

    const { error: fnError } = await supabase.functions.invoke('create-teacher-auth', {  
      body: {  
        teacher_id: teacherId ?? null,  
        name:       teacherForm.name,  
        email:      teacherForm.email,  
        phone:      cleanPhone || null,  
        password:   teacherForm.password,  
        role:       teacherForm.role?.toLowerCase() === 'admin' ? 'school_admin' : 'teacher',  
        school_id:  Number(user?.school_id),  
      },  
    });  

    if (fnError) throw fnError;  
    setFeedback({ type: 'success', message: `${teacherForm.name} registered successfully.` });  
  }  

  setShowTeacherModal(false);  
  resetTeacherForm();  
  setTimeout(() => setFeedback(null), 4000);  

} catch (err: any) {  
  setFeedback({ type: 'error', message: err.message || 'Failed to save teacher' });  
} finally {  
  setLoading(false);  
}

};

const resetTeacherForm = () => {
setTeacherForm({ id: '', name: '', email: '', phone: '', password: '', role: 'Teacher' });
setIsEditing(false);
};

const handleEditClick = (teacher: any) => {
setTeacherForm({
id: teacher.id,
name: teacher.name,
email: teacher.email,
phone: teacher.phone || '',
password: '', // Don't show password
role: teacher.role || 'Teacher'
});
setIsEditing(true);
setShowTeacherModal(true);
};

const handleAssign = async (e: React.FormEvent) => {
e.preventDefault();
if (isReadOnly) return;

setLoading(true);  
try {  
  const payload = {  
    teacher_id: assignForm.teacher_id,  
    subject_id: assignForm.subject_id,  
    grade_id: assignForm.grade_id,  
    school_id: user?.school_id,  
    is_active: true  
  };  

  await assignmentMutation.mutateAsync({ operation: 'insert', payload: [payload] });  
  setFeedback({ type: 'success', message: 'Subject assigned successfully!' });  
  setShowAssignModal(false);  
  setAssignForm({ teacher_id: '', subject_id: '', grade_id: '' });  
  setTimeout(() => setFeedback(null), 3000);  
} catch (err: unknown) {  
  setFeedback({ type: 'error', message: (err as Error).message || 'Failed to assign' });  
} finally {  
  setLoading(false);  
}

};

const handleDeleteTeacher = async (id: number) => {
if (isReadOnly) return;
try {
await teachersMutation.mutateAsync({ operation: 'delete', filters: { id } });
setDeleteConfirmId(null);
} catch (err: unknown) {
setFeedback({ type: 'error', message: (err as Error).message });
}
};

const handleDeleteAssignment = async (id: number) => {
if (isReadOnly) return;
try {
await assignmentMutation.mutateAsync({ operation: 'delete', filters: { id } });
setAssignmentDeleteConfirmId(null);
} catch (err: unknown) {
setFeedback({ type: 'error', message: (err as Error).message });
}
};

return (
<div className="space-y-8">
{feedback && (
<div className={fixed top-4 right-4 z-[100] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${   feedback.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'   }}>
<span className="font-bold text-sm">{feedback.message}</span>
</div>
)}

<div className="flex items-center justify-between">  
    <div>  
      <h1 className="text-2xl font-bold text-slate-900">Teachers</h1>  
      <p className="text-slate-500 text-sm">Manage staff and assignments.</p>  
    </div>  
    <div className="flex gap-3">  
      <button  
        disabled={isReadOnly}  
        onClick={() => setShowAssignModal(true)}  
        className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm bg-white hover:bg-slate-50"  
      >  
        <LinkIcon size={18} /> Assign Subject  
      </button>  
      <button  
        disabled={isReadOnly}  
        onClick={() => setShowTeacherModal(true)}  
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"  
      >  
        <UserPlus size={18} /> Add Teacher  
      </button>  
    </div>  
  </div>  

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">  
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">  
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">  
        <h3 className="font-bold text-slate-900 text-sm">Staff List</h3>  
        <div className="flex items-center gap-2">  
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 border rounded disabled:opacity-30"><ChevronLeft size={16}/></button>  
          <span className="text-xs font-bold">Page {page + 1}</span>  
          <button onClick={() => setPage(p => p + 1)} disabled={teachers.length < PAGE_SIZE} className="p-1 border rounded disabled:opacity-30"><ChevronRight size={16}/></button>  
        </div>  
      </div>  
      <div className="overflow-x-auto min-h-[300px]">  
        {teachersQuery.isLoading ? (  
          <div className="p-6"><TableSkeleton rows={8} cols={4} /></div>  
        ) : (  
          <table className="w-full text-left">  
            <thead className="text-xs text-slate-400 uppercase font-bold border-b">  
              <tr>  
                <th className="px-6 py-3">Name & Contact</th>  
                <th className="px-6 py-3">Role</th>  
                <th className="px-6 py-3 text-right">Actions</th>  
              </tr>  
            </thead>  
            <tbody className="text-sm divide-y">  
              {teachers.map((t: any) => (  
                <tr key={t.id} className="hover:bg-slate-50">  
                  <td className="px-6 py-4">  
                    <div className="font-bold text-slate-800">{t.name}</div>  
                    <div className="flex flex-col gap-0.5 mt-1">  
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">  
                        <span className="font-bold">E:</span> {t.email}  
                      </div>  
                      {t.phone && (  
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">  
                          <span className="font-bold">P:</span> {t.phone}  
                        </div>  
                      )}  
                    </div>  
                  </td>  
                  <td className="px-6 py-4">  
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100">{t.role}</span>  
                  </td>  
                  <td className="px-6 py-4 text-right">  
                    <div className="flex justify-end gap-2">  
                      <button   
                        onClick={() => handleEditClick(t)}  
                        className="text-blue-600 hover:text-blue-800 text-xs font-bold"  
                      >  
                        Edit  
                      </button>  
                      {deleteConfirmId === t.id ? (  
                        <button onClick={() => handleDeleteTeacher(t.id)} className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold">Confirm</button>  
                      ) : (  
                        <button onClick={() => setDeleteConfirmId(t.id)} className="text-slate-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>  
                      )}  
                    </div>  
                  </td>  
                </tr>  
              ))}  
            </tbody>  
          </table>  
        )}  
      </div>  
    </div>  

    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">  
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">  
        <h3 className="font-bold text-slate-900 text-sm">Active Assignments</h3>  
      </div>  
      <div className="overflow-x-auto">  
        {assignmentsQuery.isLoading ? (  
          <div className="p-6"><TableSkeleton rows={8} cols={4} /></div>  
        ) : (  
          <table className="w-full text-left">  
            <thead className="text-xs text-slate-400 uppercase font-bold border-b">  
              <tr>  
                <th className="px-6 py-3">Staff</th>  
                <th className="px-6 py-3">Subject & Grade</th>  
                <th className="px-6 py-3 text-right">Action</th>  
              </tr>  
            </thead>  
            <tbody className="text-sm divide-y">  
              {processedAssignments.map((a) => (  
                <tr key={a.id} className="hover:bg-slate-50">  
                  <td className="px-6 py-4 font-bold text-slate-800">{a.teacher_name}</td>  
                  <td className="px-6 py-4">  
                    <div className="flex items-center gap-2">  
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg">{a.subject_name}</span>  
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-50 text-slate-700 rounded-lg">{a.grade_name}</span>  
                    </div>  
                  </td>  
                  <td className="px-6 py-4 text-right">  
                    {assignmentDeleteConfirmId === a.id ? (  
                      <button onClick={() => handleDeleteAssignment(a.id)} className="text-red-600 px-2 py-1 font-bold">YES</button>  
                    ) : (  
                      <button onClick={() => setAssignmentDeleteConfirmId(a.id)} className="text-slate-300 hover:text-red-600"><Trash2 size={16} /></button>  
                    )}  
                  </td>  
                </tr>  
              ))}  
            </tbody>  
          </table>  
        )}  
      </div>  
    </div>  
  </div>  

  {/* Add/Edit Teacher Modal */}  
  {showTeacherModal && (  
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">  
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">  
        <div className="p-6 border-b">  
          <h3 className="text-lg font-bold">{isEditing ? 'Edit Teacher' : 'Add Teacher'}</h3>  
          <p className="text-slate-400 text-xs mt-1">  
            {isEditing ? 'Update teacher information and contact details.' : 'The teacher will use this email/phone and password to log in.'}  
          </p>  
        </div>  
        <form onSubmit={handleSaveTeacher} className="p-6 space-y-4">  
          <input  
            required  
            placeholder="Full Name"  
            value={teacherForm.name}  
            onChange={e => setTeacherForm({...teacherForm, name: e.target.value})}  
            className="w-full px-4 py-2 border rounded-lg"  
          />  
          <input  
            type="email"  
            required  
            placeholder="Email"  
            value={teacherForm.email}  
            onChange={e => setTeacherForm({...teacherForm, email: e.target.value})}  
            className="w-full px-4 py-2 border rounded-lg"  
          />  
          <div className="relative">  
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">🇰🇪</span>  
            <input  
              placeholder="Phone (e.g. 712345678)"  
              value={teacherForm.phone}  
              onChange={e => setTeacherForm({...teacherForm, phone: e.target.value})}  
              className="w-full pl-12 pr-4 py-2 border rounded-lg"  
            />  
          </div>  
          {/* Password is now required — teacher needs it to log in */}  
          <div>  
            <input  
              type="password"  
              required={!isEditing}  
              minLength={6}  
                                placeholder={isEditing ? "New Password (leave blank to keep current)" : "Password (min. 6 characters)"}  
              value={teacherForm.password}  
              onChange={e => setTeacherForm({...teacherForm, password: e.target.value})}  
              className="w-full px-4 py-2 border rounded-lg"  
            />  
            {!isEditing && (  
              <p className="text-slate-400 text-xs mt-1 ml-1">  
                Share this password with the teacher so they can log in.  
              </p>  
            )}  
          </div>  
          <select  
            value={teacherForm.role}  
            onChange={e => setTeacherForm({...teacherForm, role: e.target.value})}  
            className="w-full px-4 py-2 border rounded-lg"  
          >  
            <option value="Teacher">Teacher</option>  
            <option value="Admin">Admin</option>  
          </select>  
          <div className="flex gap-3 mt-6">  
            <button  
              type="button"  
              onClick={() => { setShowTeacherModal(false); resetTeacherForm(); }}  
              className="flex-1 px-4 py-2 border rounded-lg"  
            >  
              Cancel  
            </button>  
            <button  
              type="submit"  
              disabled={loading}  
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2"  
            >  
              {loading ? (  
                <>  
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">  
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>  
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>  
                  </svg>  
                  Saving…  
                </>  
              ) : (isEditing ? 'Update Teacher' : 'Save Teacher')}  
            </button>  
          </div>  
        </form>  
      </div>  
    </div>  
  )}  

  {/* Assign Subject Modal */}  
  {showAssignModal && (  
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">  
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">  
        <div className="p-6 border-b"><h3 className="text-lg font-bold">Assign Subject</h3></div>  
        <form onSubmit={handleAssign} className="p-6 space-y-4">  
          <select required value={assignForm.teacher_id} onChange={e => setAssignForm({...assignForm, teacher_id: e.target.value})} className="w-full px-4 py-2 border rounded-lg">  
            <option value="">Select Teacher</option>  
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}  
          </select>  
          <select required value={assignForm.subject_id} onChange={e => setAssignForm({...assignForm, subject_id: e.target.value})} className="w-full px-4 py-2 border rounded-lg">  
            <option value="">Select Subject</option>  
            {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}  
          </select>  
          <select required value={assignForm.grade_id} onChange={e => setAssignForm({...assignForm, grade_id: e.target.value})} className="w-full px-4 py-2 border rounded-lg">  
            <option value="">Select Grade</option>  
            {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}  
          </select>  
          <div className="flex gap-3 mt-6">  
            <button type="button" onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>  
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50">Assign</button>  
          </div>  
        </form>  
      </div>  
    </div>  
  )}  
</div>

);
};

export default Teachers;
     