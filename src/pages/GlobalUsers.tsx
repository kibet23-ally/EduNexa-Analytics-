import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Users2, Search, Filter, Shield, GraduationCap, Building2 } from 'lucide-react';

import { User } from '../types';

const GlobalUsers = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/super/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUsers();
  }, [token]);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.schools?.name || 'Global').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Global User Directory</h1>
          <p className="text-slate-500 mt-2">Managing {users.length} users across the EduNexa network.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or school..."
              className="pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl w-80 shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
            />
          </div>
          <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-500 hover:bg-slate-50 transition-colors shadow-sm">
            <Filter size={20} />
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-slate-400 text-xs uppercase tracking-widest font-bold border-b border-slate-50">
              <th className="px-8 py-5">Identified User</th>
              <th className="px-8 py-5">Role/Access</th>
              <th className="px-8 py-5">Assigned Institution</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{user.name}</p>
                      <p className="text-sm text-slate-400 font-medium">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                    user.role === 'SuperAdmin' ? 'bg-purple-50 text-purple-600' :
                    user.role === 'Admin' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'
                  }`}>
                    {user.role === 'SuperAdmin' ? <Shield size={12} /> : 
                     user.role === 'Admin' ? <GraduationCap size={12} /> : <Users2 size={12} />}
                    {user.role}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-2 text-slate-600 font-medium tracking-tight">
                    <Building2 size={16} className="text-slate-300" />
                    {user.schools?.name || <span className="text-slate-300 italic">Platform Level</span>}
                  </div>
                </td>
                <td className="px-8 py-5 text-right">
                  <button className="text-slate-300 hover:text-blue-600 font-bold text-sm transition-colors opacity-0 group-hover:opacity-100">
                    Edit Permissions
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GlobalUsers;
