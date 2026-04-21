import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { User, Subject, Grade, Assignment } from '../types';
import { UserPlus, Link as LinkIcon, Trash2 } from 'lucide-react';

const Teachers = () => {
  const { token } = useAuth();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  const [teacherForm, setTeacherForm] = useState({ name: '', email: '', password: '', role: 'Teacher' });
  const [assignForm, setAssignForm] = useState({ teacher_id: '', subject_id: '', grade_id: '' });

  const fetchData = React.useCallback(async () => {
    const headers = { 'Authorization': `Bearer ${token}` };
    const [t, s, g, a] = await Promise.all([
      fetch('/api/teachers', { headers }).then(r => r.json()),
      fetch('/api/subjects', { headers }).then(r => r.json()),
      fetch('/api/grades', { headers }).then(r => r.json()),
      fetch('/api/assignments', { headers }).then(r => r.json())
    ]);
    setTeachers(Array.isArray(t) ? t.sort((a: User, b: User) => a.name.localeCompare(b.name)) : []);
    setSubjects(Array.isArray(s) ? s.sort((a: Subject, b: Subject) => a.subject_name.localeCompare(b.subject_name)) : []);
    setGrades(g);
    setAssignments(a);
  }, [token]);

  useEffect(() => {
    Promise.resolve().then(() => fetchData());
  }, [fetchData]);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(teacherForm),
    });
    if (res.ok) {
      setShowTeacherModal(false);
      setTeacherForm({ name: '', email: '', password: '', role: 'Teacher' });
      fetchData();
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(assignForm),
    });
    if (res.ok) {
      setShowAssignModal(false);
      setAssignForm({ teacher_id: '', subject_id: '', grade_id: '' });
      fetchData();
    }
  };

  const handleDeleteTeacher = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this teacher?')) return;
    const res = await fetch(`/api/teachers/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete teacher');
    }
  };

  const handleDeleteAssignment = async (teacher_id: number, subject_id: number, grade_id: number) => {
    if (!window.confirm('Are you sure you want to remove this assignment?')) return;
    const res = await fetch('/api/assignments', {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ teacher_id, subject_id, grade_id })
    });
    if (res.ok) {
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to remove assignment');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teachers & Assignments</h1>
          <p className="text-slate-500 text-sm">Manage staff and their subject responsibilities.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowAssignModal(true)}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <LinkIcon size={18} />
            Assign Subject
          </button>
          <button 
            onClick={() => setShowTeacherModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <UserPlus size={18} />
            Add Teacher
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900">Staff List</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{t.name}</td>
                    <td className="px-6 py-4 text-slate-600">{t.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.role === 'Admin' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                        {t.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteTeacher(t.id)}
                        className="text-red-400 hover:text-red-600 p-1 transition-colors"
                        title="Delete Teacher"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900">Subject Assignments</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                  <th className="px-6 py-3">Teacher</th>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3">Grade</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {assignments.map((a, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{a.teacher_name}</td>
                    <td className="px-6 py-4 text-slate-600">{a.subject_name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                        {a.grade_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteAssignment(a.teacher_id, a.subject_id, a.grade_id)}
                        className="text-red-400 hover:text-red-600 p-1 transition-colors"
                        title="Remove Assignment"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showTeacherModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-900 p-6 text-white">
              <h3 className="text-lg font-bold">Add New Teacher</h3>
            </div>
            <form onSubmit={handleCreateTeacher} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                <input required value={teacherForm.name} onChange={(e) => setTeacherForm({...teacherForm, name: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                <input type="email" required value={teacherForm.email} onChange={(e) => setTeacherForm({...teacherForm, email: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                <input type="password" required value={teacherForm.password} onChange={(e) => setTeacherForm({...teacherForm, password: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                <select value={teacherForm.role} onChange={(e) => setTeacherForm({...teacherForm, role: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="Teacher">Teacher</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowTeacherModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">Save Teacher</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-900 p-6 text-white">
              <h3 className="text-lg font-bold">Assign Subject to Teacher</h3>
            </div>
            <form onSubmit={handleAssign} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Teacher</label>
                <select required value={assignForm.teacher_id} onChange={(e) => setAssignForm({...assignForm, teacher_id: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Select Teacher</option>
                  {teachers.filter(t => t.role !== 'Admin').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                <select required value={assignForm.subject_id} onChange={(e) => setAssignForm({...assignForm, subject_id: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Grade</label>
                <select required value={assignForm.grade_id} onChange={(e) => setAssignForm({...assignForm, grade_id: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Select Grade</option>
                  {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teachers;
