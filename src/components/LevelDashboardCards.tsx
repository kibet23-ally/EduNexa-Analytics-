import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../useAuth';
import {
  BookOpen, GraduationCap, Users, BarChart2,
  CalendarCheck, TrendingUp, ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ─── Level config ───────────────────────────────────────────────── */
const LEVEL_CONFIG: Record<string, {
  name: string; description: string;
  icon: React.ElementType; color: string; bg: string; border: string;
}> = {
  PRIMARY: {
    name: 'Primary School', description: 'Grades 1 – 6',
    icon: BookOpen, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe',
  },
  JSS: {
    name: 'Junior Secondary', description: 'Grades 7 – 9',
    icon: GraduationCap, color: '#1e3a5f', bg: '#f0f4fb', border: '#96aed3',
  },
};

interface LevelStats {
  level_code:    string;
  level_name:    string;
  students:      number;
  teachers:      number;
  grades:        number;
  avg_attendance: number;
  avg_marks:     number;
}

interface CombinedStats {
  total_students: number;
  total_teachers: number;
  total_grades:   number;
}

export default function LevelDashboardCards() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const schoolId  = Number(user?.school_id);

  const [levelStats,    setLevelStats]    = useState<LevelStats[]>([]);
  const [combinedStats, setCombinedStats] = useState<CombinedStats | null>(null);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    const fetch = async () => {
      setLoading(true);

      // 1. Get active school levels
      const { data: levels } = await supabase
        .from('school_levels')
        .select('level_code, level_name')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      if (!levels?.length) { setLoading(false); return; }

      // 2. Get grades per level
      const { data: grades } = await supabase
        .from('grades')
        .select('id, level_code')
        .eq('school_id', schoolId);

      // 3. Get students per grade (to know per level)
      const { data: students } = await supabase
        .from('students')
        .select('id, grade_id')
        .eq('school_id', schoolId);

      // 4. Get marks for avg performance
      const { data: marks } = await supabase
        .from('marks')
        .select('score, grade_id')
        .eq('school_id', schoolId)
        .not('score', 'is', null);

      // 5. Get attendance for today
      const today = new Date().toISOString().split('T')[0];
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status, grade_id')
        .eq('school_id', schoolId)
        .eq('date', today);

      // 6. Get teachers
      const { data: teachers } = await supabase
        .from('teachers')
        .select('id')
        .eq('school_id', schoolId);

      // Build grade → level map
      const gradeLevel: Record<string, string> = {};
      (grades || []).forEach(g => { gradeLevel[g.id] = g.level_code; });

      // Build stats per level
      const stats: LevelStats[] = levels.map(level => {
        const levelGrades  = (grades || []).filter(g => g.level_code === level.level_code);
        const gradeIds     = new Set(levelGrades.map(g => String(g.id)));

        const levelStudents = (students || []).filter(s => gradeIds.has(String(s.grade_id)));
        const levelMarks    = (marks || []).filter(m => gradeIds.has(String(m.grade_id)));
        const levelAtt      = (attendance || []).filter(a => gradeIds.has(String(a.grade_id)));

        const avgMarks = levelMarks.length
          ? Math.round(levelMarks.reduce((a, m) => a + (m.score ?? 0), 0) / levelMarks.length * 10) / 10
          : 0;

        const presentCount = levelAtt.filter(a => a.status === 'present').length;
        const avgAtt = levelAtt.length
          ? Math.round(presentCount / levelAtt.length * 100)
          : 0;

        return {
          level_code:    level.level_code,
          level_name:    level.level_name,
          students:      levelStudents.length,
          teachers:      teachers?.length || 0,
          grades:        levelGrades.length,
          avg_attendance: avgAtt,
          avg_marks:     avgMarks,
        };
      });

      setCombinedStats({
        total_students: (students || []).length,
        total_teachers: (teachers || []).length,
        total_grades:   (grades || []).length,
      });

      setLevelStats(stats);
      setLoading(false);
    };
    fetch();
  }, [schoolId]);

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!levelStats.length) return null;

  return (
    <div className="space-y-4">
      {/* ── Combined totals ── */}
      {combinedStats && levelStats.length > 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-4 rounded-full bg-[#1e3a5f]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              School Overview — All Levels
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Students', value: combinedStats.total_students, icon: Users },
              { label: 'Total Teachers', value: combinedStats.total_teachers, icon: Users },
              { label: 'Total Grades',   value: combinedStats.total_grades,   icon: BookOpen },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <div className="text-2xl font-black text-[#1e3a5f] dark:text-white">{value}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Per-level cards ── */}
      <div className={`grid gap-4 ${levelStats.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-md'}`}>
        {levelStats.map(level => {
          const cfg  = LEVEL_CONFIG[level.level_code] || LEVEL_CONFIG.JSS;
          const Icon = cfg.icon;

          return (
            <div
              key={level.level_code}
              className="rounded-2xl border-2 p-5 transition-all hover:shadow-md"
              style={{ borderColor: cfg.border, background: cfg.bg }}
            >
              {/* Level header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: cfg.color + '20', border: `1.5px solid ${cfg.border}` }}>
                    <Icon size={16} style={{ color: cfg.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{cfg.name}</h3>
                    <p className="text-[10px] text-slate-500">{cfg.description}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  ACTIVE
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: 'Learners',   value: level.students,      icon: Users,         color: cfg.color },
                  { label: 'Classes',    value: level.grades,         icon: BookOpen,      color: cfg.color },
                  { label: 'Attendance', value: `${level.avg_attendance}%`, icon: CalendarCheck, color: level.avg_attendance >= 80 ? '#15803d' : '#d97706' },
                  { label: 'Avg Score',  value: level.avg_marks > 0 ? `${level.avg_marks}%` : '—', icon: TrendingUp, color: cfg.color },
                ].map(({ label, value, icon: StatIcon, color }) => (
                  <div key={label} className="bg-white/70 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <StatIcon size={11} style={{ color }} />
                      <span className="text-[10px] text-slate-500">{label}</span>
                    </div>
                    <div className="text-lg font-black" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Quick links */}
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/students')}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors bg-white/80 hover:bg-white"
                  style={{ color: cfg.color }}
                >
                  <Users size={11} /> Students
                </button>
                <button
                  onClick={() => navigate('/insights')}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors bg-white/80 hover:bg-white"
                  style={{ color: cfg.color }}
                >
                  <BarChart2 size={11} /> Analytics
                  <ChevronRight size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
