import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../useAuth';
import { Mail, Phone, MapPin } from 'lucide-react';

interface SchoolData {
  id: number;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  motto: string | null;
}

const Letterhead: React.FC = () => {
  const { user } = useAuth();
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchool = async () => {
      if (!user?.school_id) {
        setLoading(false);
        return;
      }

      try {
        const { data: schoolsData, error } = await supabase
          .from('schools')
          .select('*');
        
        if (error) throw error;
        
        // Find the user's specific school from the returned list
        const mySchool = (schoolsData as SchoolData[]).find((s) => s.id === user.school_id);
        if (mySchool) {
          setSchool(mySchool);
        }
      } catch (err) {
        console.error('Letterhead: Failed to fetch school data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchool();
  }, [user?.school_id]);

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center py-8 border-b-2 border-slate-200 mb-8 animate-pulse">
        <div className="w-20 h-20 bg-slate-100 rounded-full mb-4"></div>
        <div className="h-8 w-64 bg-slate-100 rounded mb-2"></div>
        <div className="h-4 w-48 bg-slate-100 rounded"></div>
      </div>
    );
  }

  if (!school) return null;

  return (
    <div className="w-full flex flex-col items-center text-center py-8 border-b-2 border-slate-900 mb-10 bg-white">
      <div className="flex flex-col md:flex-row items-center gap-6 max-w-4xl w-full">
        {school.logo_url && (
          <img 
            src={school.logo_url} 
            alt={`${school.name} Logo`} 
            className="w-24 h-24 object-contain"
            referrerPolicy="no-referrer"
          />
        )}
        
        <div className="flex-1 space-y-1">
          <h1 className="text-4xl font-display font-black text-slate-900 uppercase tracking-tighter">
            {school.name}
          </h1>
          
          {school.motto && (
            <p className="text-sm font-medium italic text-slate-500 uppercase tracking-widest">
              "{school.motto}"
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mt-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            {school.address && (
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-slate-400" />
                {school.address}
              </div>
            )}
            {school.phone && (
              <div className="flex items-center gap-2">
                <Phone size={12} className="text-slate-400" />
                {school.phone}
              </div>
            )}
            {school.email && (
              <div className="flex items-center gap-2">
                <Mail size={12} className="text-slate-400" />
                {school.email}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Letterhead;
