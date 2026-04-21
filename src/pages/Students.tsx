import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Student, Grade } from '../types';
import { Search, UserPlus, Filter, Trash2, Edit2, X, Check, Upload, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface StudentImportRow {
  Name?: string;
  name?: string;
  'Student Name'?: string;
  AdmissionNo?: string | number;
  admission_number?: string | number;
  'Adm No'?: string | number;
  'Admission Number'?: string | number;
  Gender?: string;
  gender?: string;
  GradeID?: string | number;
  grade_id?: string | number;
  'Grade ID'?: string | number;
}

const Students = () => {
  const { token, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    admission_number: '',
    gender: 'Male',
    grade_id: ''
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);

  const fetchData = React.useCallback(async () => {
    const headers = { 'Authorization': `Bearer ${token}` };
    try {
      const [sRes, gRes] = await Promise.all([
        fetch('/api/students', { headers }),
        fetch('/api/grades', { headers })
      ]);
      const sData = await sRes.json();
      const gData = await gRes.json();
      
      setStudents(Array.isArray(sData) ? sData.sort((a, b) => a.name.localeCompare(b.name)) : []);
      setGrades(Array.isArray(gData) ? gData : []);

      if (!Array.isArray(gData) && gData.error) {
        setError(gData.error);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to connect to the server. Please check your Supabase configuration.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { 
    Promise.resolve().then(() => fetchData()); 
  }, [fetchData]);

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportLogs(['Reading file...']);
    
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws) as StudentImportRow[];
          
          setImportLogs(prev => [...prev, `Found ${data.length} records. Starting import...`]);
          
          let success = 0;
          let failed = 0;

          for (const row of data) {
            const studentData = {
              name: row.Name || row.name || row['Student Name'],
              admission_number: row.AdmissionNo || row.admission_number || row['Adm No'] || row['Admission Number'],
              gender: row.Gender || row.gender || 'Male',
              grade_id: row.GradeID || row.grade_id || row['Grade ID']
            };

            if (!studentData.name || !studentData.admission_number || !studentData.grade_id) {
              setImportLogs(prev => [...prev, `❌ Skip: Missing required fields for ${studentData.name || 'Unknown'}`]);
              failed++;
              continue;
            }

            const res = await fetch('/api/students', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(studentData),
            });

            if (res.ok) {
              success++;
            } else {
              setImportLogs(prev => [...prev, `❌ Fail: ${studentData.name} (${studentData.admission_number})`]);
              failed++;
            }
          }
          
          setImportLogs(prev => [...prev, `✅ Import Complete! Success: ${success}, Failed: ${failed}`]);
          fetchData();
        } catch {
          setError('Error parsing file');
        }
      };
      reader.readAsBinaryString(file);
    } catch {
      setError('Import failed');
    }
  };

  const downloadTemplate = () => {
    const data = [
      { name: 'John Doe', admission_number: '1001', gender: 'Male', grade_id: grades[0]?.id || 1 },
      { name: 'Jane Smith', admission_number: '1002', gender: 'Female', grade_id: grades[0]?.id || 1 },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students Template");
    XLSX.writeFile(wb, "Student_Import_Template.xlsx");
  };
  const handleEditClick = (student: Student) => {
    setEditingId(student.id);
    setFormData({
      name: student.name,
      admission_number: student.admission_number,
      gender: student.gender,
      grade_id: student.grade_id.toString()
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const url = editingId ? `/api/students/${editingId}` : '/api/students';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method: method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowModal(false);
        setEditingId(null);
        setFormData({ name: '', admission_number: '', gender: 'Male', grade_id: '' });
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save student');
      }
    } catch (err) { 
      console.error(err);
      setError('An error occurred while saving student');
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete student');
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while deleting student');
      setDeleteConfirmId(null);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.admission_number.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 text-sm">Manage student records and enrollment.</p>
        </div>
        {user?.role === 'Admin' && (
          <div className="flex gap-2">
            <button 
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              title="Download Template"
            >
              <Download size={18} />
              Template
            </button>
            <label className="cursor-pointer inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              <Upload size={18} />
              Bulk Import
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleBulkImport} />
            </label>
            <button 
              onClick={() => {
                setEditingId(null);
                setFormData({ name: '', admission_number: '', gender: 'Male', grade_id: '' });
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <UserPlus size={18} />
              Add Student
            </button>
          </div>
        )}
      </div>

      {isImporting && (
        <div className="bg-slate-900 rounded-xl p-6 text-white font-mono text-xs space-y-1 max-h-48 overflow-y-auto w-full relative">
          <button onClick={() => setIsImporting(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <FileSpreadsheet size={16} />
            <span className="font-bold uppercase tracking-widest">Import Logs</span>
          </div>
          {importLogs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <X size={16} />
            {error}
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name or admission number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
            <Filter size={18} />
            Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-3">Admission No</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Gender</th>
                <th className="px-6 py-3">Grade</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-blue-600 font-medium">{student.admission_number}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                  <td className="px-6 py-4 text-slate-600">{student.gender}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                      {student.grade_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user?.role === 'Admin' && (
                        <>
                          {deleteConfirmId === student.id ? (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => handleDelete(student.id)}
                                className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                title="Confirm Delete"
                              >
                                <Check size={18} />
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-slate-400 hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                                title="Cancel"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button 
                                onClick={() => handleEditClick(student)}
                                className="text-blue-600 hover:text-blue-800 p-1 transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmId(student.id)}
                                className="text-red-400 hover:text-red-600 p-1 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    No students found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-900 p-6 text-white">
              <h3 className="text-lg font-bold">{editingId ? 'Edit Student' : 'Add New Student'}</h3>
              <p className="text-blue-200 text-xs">{editingId ? 'Update student records.' : 'Enter details to enroll a new student.'}</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                <input 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Admission Number</label>
                <input 
                  required
                  value={formData.admission_number}
                  onChange={(e) => setFormData({...formData, admission_number: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Gender</label>
                  <select 
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Grade</label>
                  <select 
                    required
                    value={formData.grade_id}
                    onChange={(e) => setFormData({...formData, grade_id: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">{grades.length === 0 ? 'No Grades Found (Add in Grades page)' : 'Select Grade'}</option>
                    {grades.map(g => <option key={g.id} value={g.id.toString()}>{g.grade_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  {editingId ? 'Update Student' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;
