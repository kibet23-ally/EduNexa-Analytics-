import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL_RAW = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY_RAW = process.env.VITE_SUPABASE_ANON_KEY;

// Clean up URL if it has /rest/v1/ suffix
const SUPABASE_URL = SUPABASE_URL_RAW ? SUPABASE_URL_RAW.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') : null;
const SUPABASE_ANON_KEY = SUPABASE_ANON_KEY_RAW || null;

// Only initialize if credentials exist to prevent crash
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Types
interface AuthRequest extends Request {
  user?: UserPayload;
}

interface UserPayload {
  id: number;
  email: string;
  role: string;
  name: string;
  school_id: number;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Auth Middleware
  const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user as UserPayload;
      next();
    });
  };

  const isSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'SuperAdmin') return res.status(403).json({ error: "Super Admin access required" });
    next();
  };

  const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'Admin' && req.user?.role !== 'SuperAdmin') return res.status(403).json({ error: "Admin access required" });
    next();
  };

  // Middleware to ensure Supabase is configured
  app.use("/api", (req, res, next) => {
    if (!supabase) {
      return res.status(500).json({ 
        error: "Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your project secrets." 
      });
    }
    next();
  });

  // Super Admin Platform Aggregations
  app.get("/api/super/stats", authenticateToken, isSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { data: schools } = await supabase!.from("schools").select("id, subscription_status");
      const { count: studentCount } = await supabase!.from("students").select("id", { count: 'exact', head: true });
      
      const stats = {
        totalSchools: schools?.length || 0,
        activeSubscriptions: schools?.filter(s => s.subscription_status === 'Active').length || 0,
        expiredSchools: schools?.filter(s => s.subscription_status === 'Expired').length || 0,
        totalStudents: studentCount || 0
      };
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Aggregation failed" });
    }
  });

  app.get("/api/super/recent-schools", authenticateToken, isSuperAdmin, async (req: AuthRequest, res: Response) => {
    const { data, error } = await supabase!.from("schools").select("*").order("created_at", { ascending: false }).limit(5);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/super/growth-data", authenticateToken, isSuperAdmin, async (req: AuthRequest, res: Response) => {
    // Generate simple monthly counts for visual chart
    const { data } = await supabase!.from("schools").select("created_at");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const growth = months.map(m => ({ month: m, schools: 0 }));
    
    data?.forEach(s => {
      const mIdx = new Date(s.created_at).getMonth();
      growth[mIdx].schools += 1;
    });
    res.json(growth);
  });

  // Schools
  app.get("/api/schools", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { data, error } = await supabase!.from("schools").select("*");
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });
  app.post("/api/schools", authenticateToken, isSuperAdmin, async (req: AuthRequest, res: Response) => {
    const { name, slug, logo_url, admin_name, admin_email, admin_password } = req.body;
    
    try {
      // 1. Create the school
      const { data: school, error: schoolErr } = await supabase!.from("schools").insert([{ 
        name, 
        slug, 
        logo_url,
        subscription_status: 'Active',
        subscription_tier: 'Basic'
      }]).select().single();
      
      if (schoolErr) throw schoolErr;

      // 2. Create the first Admin for this school
      const hashedPassword = bcrypt.hashSync(admin_password, 10);
      const { error: adminErr } = await supabase!.from("teachers").insert([{
        name: admin_name,
        email: admin_email,
        password: hashedPassword,
        role: 'Admin',
        school_id: school.id
      }]);

      if (adminErr) throw adminErr;

      res.json(school);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Registration failed";
      res.status(400).json({ error: errorMessage });
    }
  });

  app.delete("/api/schools/:id", authenticateToken, isSuperAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    
    try {
      // 1. Delete all dependent data for this school
      // To be safe with foreign keys and potential missing columns in teacher_subjects, 
      // we fetch IDs first for some deletions.
      
      const schoolId = parseInt(id);
      if (isNaN(schoolId)) throw new Error("Invalid school ID");

      // Marks
      await supabase!.from("marks").delete().eq("school_id", schoolId);
      
      // Teacher Subjects (Assignments)
      // Usually teacher_subjects links teacher_id, subject_id, grade_id.
      // We fetch teacher IDs belonging to this school first.
      const { data: teachers } = await supabase!.from("teachers").select("id").eq("school_id", schoolId);
      const teacherIds = teachers?.map(t => t.id) || [];
      
      if (teacherIds.length > 0) {
        await supabase!.from("teacher_subjects").delete().in("teacher_id", teacherIds);
      }
      
      // Students
      await supabase!.from("students").delete().eq("school_id", schoolId);
      
      // Exams
      await supabase!.from("exams").delete().eq("school_id", schoolId);
      
      // Subjects
      await supabase!.from("subjects").delete().eq("school_id", schoolId);
      
      // Grades
      await supabase!.from("grades").delete().eq("school_id", schoolId);
      
      // Teachers
      await supabase!.from("teachers").delete().eq("school_id", schoolId);
      
      // 2. Finally delete the school
      const { error: finalErr } = await supabase!.from("schools").delete().eq("id", schoolId);
      
      if (finalErr) throw finalErr;
      res.json({ message: "School and all associated data deleted successfully" });
    } catch (err: unknown) {
      console.error("CRITICAL: School Deletion Failure for ID:", id);
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Deletion failed";
      res.status(400).json({ error: errorMessage, details: err });
    }
  });

  app.get("/api/schools/:id/stats", authenticateToken, isSuperAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const { count: teachers } = await supabase!.from("teachers").select("id", { count: 'exact', head: true }).eq("school_id", id);
      const { count: students } = await supabase!.from("students").select("id", { count: 'exact', head: true }).eq("school_id", id);
      const { count: subjects } = await supabase!.from("subjects").select("id", { count: 'exact', head: true }).eq("school_id", id);
      const { count: marks } = await supabase!.from("marks").select("id", { count: 'exact', head: true }).eq("school_id", id);

      res.json({
        teachers: teachers || 0,
        students: students || 0,
        subjects: subjects || 0,
        marks: marks || 0
      });
    } catch {
      res.status(400).json({ error: "Failed to fetch school stats" });
    }
  });

  app.patch("/api/schools/:id", authenticateToken, isSuperAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, logo_url, subscription_tier, subscription_status } = req.body;
    
    const { data, error } = await supabase!
      .from("schools")
      .update({ name, logo_url, subscription_tier, subscription_status })
      .eq("id", id)
      .select()
      .single();
      
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/super/users", authenticateToken, isSuperAdmin, async (req: AuthRequest, res: Response) => {
    const { data, error } = await supabase!
      .from("teachers")
      .select("id, name, email, role, school_id, schools(name)");
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/super/profile", authenticateToken, isSuperAdmin, async (req: AuthRequest, res: Response) => {
    const { name, email } = req.body;
    const { data, error } = await supabase!
      .from("teachers")
      .update({ name, email })
      .eq("id", req.user!.id)
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });
  app.put("/api/schools/:id", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, slug, logo_url } = req.body;
    const { data, error } = await supabase!.from("schools").update({ name, slug, logo_url }).eq("id", id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/debug/users", async (req, res) => {
    const { data, error } = await supabase!.from("teachers").select("email");
    res.json({ data, error });
  });

  // Supabase Health Check
  app.get("/api/health/supabase", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { error } = await supabase!.from("teachers").select("count").limit(1);
      if (error) throw error;
      res.json({ status: "connected", message: "Successfully connected to Supabase" });
    } catch (err: unknown) {
      console.error("Supabase Connection Failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ 
        status: "error", 
        message: "Failed to connect to Supabase. Please check your Project URL and Anon API Key.",
        details: errorMessage
      });
    }
  });

  // Auth Routes
  app.post("/api/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    // Check if the API key looks like a Stripe key
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    if (anonKey.startsWith("sb_publishable_")) {
      return res.status(500).json({ 
        error: "Configuration Error: Your Supabase API Key looks like a Stripe key. Please use your Supabase 'anon' key (starts with 'eyJ')." 
      });
    }

    try {
      if (!supabase) {
        return res.status(500).json({ error: "Supabase client not initialized. Check your Environment Variables." });
      }

      const { data: user, error } = await supabase
        .from("teachers")
        .select("*, schools:school_id(name)")
        .eq("email", email)
        .single();

      if (error) {
        console.error("Login Failed [Supabase Query Error]:", email, error);
        if (error.code === 'PGRST116') {
          return res.status(401).json({ error: "User not found." });
        }
        return res.status(401).json({ error: `Database Error: ${error.message}` });
      }

      if (!user || !bcrypt.compareSync(password, user.password)) {
        console.error("Login Failed [Password Mismatch]:", email);
        return res.status(401).json({ error: "Incorrect password." });
      }

      const schoolName = (user as { schools?: { name: string } }).schools?.name || "EduNexa School";

      const token = jwt.sign({ 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        name: user.name,
        school_id: user.school_id,
        school_name: schoolName 
      }, JWT_SECRET);
      res.json({ token, user: { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        name: user.name, 
        school_id: user.school_id,
        school_name: schoolName 
      } });
    } catch (err: unknown) {
      console.error("Login Exception:", err);
      res.status(500).json({ error: "System Error: Could not reach the database. Please check your Supabase URL." });
    }
  });

  // Grades
  app.get("/api/grades", authenticateToken, async (req: AuthRequest, res: Response) => {
    const { data, error } = await supabase!.from("grades").select("*").eq("school_id", req.user!.school_id);
    if (error) {
      console.error("Supabase Error [GET /api/grades]:", error);
      return res.status(400).json({ error: error.message });
    }
    res.json(data);
  });
  app.post("/api/grades", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { grade_name } = req.body;
    const { data, error } = await supabase!.from("grades").insert([{ grade_name, school_id: req.user!.school_id }]).select().single();
    if (error) {
      console.error("Supabase Error [POST /api/grades]:", error);
      return res.status(400).json({ error: error.message });
    }
    res.json(data);
  });
  app.delete("/api/grades/:id", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const { count, error: countErr } = await supabase!.from("students").select("*", { count: 'exact', head: true }).eq("grade_id", id).eq("school_id", req.user!.school_id);
      if (countErr) throw countErr;
      if (count && count > 0) {
        return res.status(400).json({ error: "Cannot delete grade with existing students." });
      }
      const { error } = await supabase!.from("grades").delete().eq("id", id).eq("school_id", req.user!.school_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: unknown) {
      console.error("Delete Grade Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  });

  // Subjects
  app.get("/api/subjects", authenticateToken, async (req: AuthRequest, res: Response) => {
    const { data, error } = await supabase!.from("subjects").select("*").eq("school_id", req.user!.school_id);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });
  app.post("/api/subjects", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { subject_name, subject_code } = req.body;
    const { data, error } = await supabase!.from("subjects").insert([{ subject_name, subject_code, school_id: req.user!.school_id }]).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });
  app.put("/api/subjects/:id", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { subject_name, subject_code } = req.body;
    const { data, error } = await supabase!.from("subjects").update({ subject_name, subject_code }).eq("id", id).eq("school_id", req.user!.school_id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });
  app.delete("/api/subjects/:id", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const { count, error: countErr } = await supabase!.from("marks").select("*", { count: 'exact', head: true }).eq("subject_id", id).eq("school_id", req.user!.school_id);
      if (countErr) throw countErr;
      if (count && count > 0) {
        return res.status(400).json({ error: "Cannot delete subject with existing marks. Delete the marks first." });
      }
      await supabase!.from("teacher_subjects").delete().eq("subject_id", id);
      const { error } = await supabase!.from("subjects").delete().eq("id", id).eq("school_id", req.user!.school_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: unknown) {
      console.error("Delete Subject Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  });

  // Marks Bulk Upload
  app.post("/api/marks/bulk", authenticateToken, async (req: AuthRequest, res: Response) => {
    const { exam_id, subject_id, marks } = req.body;
    if (!exam_id || !subject_id || !marks || !Array.isArray(marks)) {
      return res.status(400).json({ error: "Invalid data. exam_id, subject_id, and marks array are required." });
    }

    try {
      const inserts = marks.map((m: { student_id: string; score: string }) => ({
        student_id: parseInt(m.student_id),
        subject_id: parseInt(subject_id as string),
        exam_id: parseInt(exam_id as string),
        score: parseFloat(m.score),
        school_id: req.user!.school_id
      }));

      const { error } = await supabase!.from("marks").upsert(inserts, {
        onConflict: 'student_id,subject_id,exam_id'
      });

      if (error) throw error;
      res.json({ success: true, count: inserts.length });
    } catch (err: unknown) {
      console.error("Bulk Marks Error:", err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.get("/api/students", authenticateToken, async (req: AuthRequest, res: Response) => {
    const { data, error } = await supabase!
      .from("students")
      .select(`
        *,
        grades (grade_name, school_id)
      `)
      .eq("school_id", req.user!.school_id);
    if (error) return res.status(400).json({ error: error.message });
    const formatted = data.map(s => ({
      ...s,
      grade_name: s.grades?.grade_name
    }));
    res.json(formatted);
  });
  app.post("/api/students", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { name, admission_number, gender, grade_id } = req.body;
    const { data, error } = await supabase!.from("students").insert([{ name, admission_number, gender, grade_id, school_id: req.user!.school_id }]).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });
  app.put("/api/students/:id", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, admission_number, gender, grade_id } = req.body;
    const { data, error } = await supabase!.from("students").update({ name, admission_number, gender, grade_id }).eq("id", id).eq("school_id", req.user!.school_id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });
  app.delete("/api/students/:id", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const { count, error: countErr } = await supabase!.from("marks").select("*", { count: 'exact', head: true }).eq("student_id", id).eq("school_id", req.user!.school_id);
      if (countErr) throw countErr;
      if (count && count > 0) {
        return res.status(400).json({ error: "Cannot delete student with existing marks." });
      }
      const { error } = await supabase!.from("students").delete().eq("id", id).eq("school_id", req.user!.school_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: unknown) {
      console.error("Delete Student Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  });

  // Exams
  app.get("/api/exams", authenticateToken, async (req: AuthRequest, res: Response) => {
    const { data, error } = await supabase!.from("exams").select("*").eq("school_id", req.user!.school_id);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });
  app.post("/api/exams", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { exam_name, term, year } = req.body;
    const { data, error } = await supabase!.from("exams").insert([{ exam_name, term, year, school_id: req.user!.school_id }]).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });
  app.put("/api/exams/:id", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { exam_name, term, year } = req.body;
    const { data, error } = await supabase!.from("exams").update({ exam_name, term, year }).eq("id", id).eq("school_id", req.user!.school_id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });
  app.delete("/api/exams/:id", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const { count, error: countErr } = await supabase!.from("marks").select("*", { count: 'exact', head: true }).eq("exam_id", id).eq("school_id", req.user!.school_id);
      if (countErr) throw countErr;
      if (count && count > 0) {
        return res.status(400).json({ error: "Cannot delete exam with existing marks." });
      }
      const { error } = await supabase!.from("exams").delete().eq("id", id).eq("school_id", req.user!.school_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: unknown) {
      console.error("Delete Exam Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      res.status(400).json({ error: errorMessage });
    }
  });

  // Teachers
  app.get("/api/teachers", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { data, error } = await supabase!.from("teachers").select("id, name, email, role, school_id").eq("school_id", req.user!.school_id);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });
  app.post("/api/teachers", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { name, email, password, role } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const { data, error } = await supabase!.from("teachers").insert([{ 
      name, 
      email, 
      password: hashedPassword, 
      role, 
      school_id: req.user!.school_id 
    }]).select("id, name, email, role, school_id").single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });
  app.delete("/api/teachers/:id", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { count, error: countErr } = await supabase!.from("teacher_subjects").select("*", { count: 'exact', head: true }).eq("teacher_id", id);
    if (countErr) return res.status(400).json({ error: countErr.message });
    if (count && count > 0) {
      return res.status(400).json({ error: "Cannot delete teacher with existing assignments. Remove assignments first." });
    }
    const { error } = await supabase!.from("teachers").delete().eq("id", id).eq("school_id", req.user!.school_id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });

  // Teacher Assignments
  app.get("/api/assignments", authenticateToken, async (req: AuthRequest, res: Response) => {
    const { data, error } = await supabase!
      .from("teacher_subjects")
      .select(`
        *,
        teachers (name, school_id),
        subjects (subject_name, school_id),
        grades (grade_name, school_id)
      `)
      .eq("teachers.school_id", req.user!.school_id);
    if (error) return res.status(400).json({ error: error.message });
    const formatted = (data || []).filter(ts => ts.teachers?.school_id === req.user!.school_id).map(ts => ({
      ...ts,
      teacher_name: ts.teachers?.name,
      subject_name: ts.subjects?.subject_name,
      grade_name: ts.grades?.grade_name
    }));
    res.json(formatted);
  });
  app.post("/api/assignments", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { teacher_id, subject_id, grade_id } = req.body;
    
    // Security check: Verify all IDs belong to the same school
    const [tCheck, sCheck, gCheck] = await Promise.all([
      supabase!.from("teachers").select("id").eq("id", teacher_id).eq("school_id", req.user!.school_id).single(),
      supabase!.from("subjects").select("id").eq("id", subject_id).eq("school_id", req.user!.school_id).single(),
      supabase!.from("grades").select("id").eq("id", grade_id).eq("school_id", req.user!.school_id).single(),
    ]);

    if (tCheck.error || sCheck.error || gCheck.error) {
      return res.status(403).json({ error: "Access denied or invalid resource mapping." });
    }

    const { error } = await supabase!.from("teacher_subjects").insert([{ 
      teacher_id, 
      subject_id, 
      grade_id,
      school_id: req.user!.school_id
    }]);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });
  app.delete("/api/assignments", authenticateToken, isAdmin, async (req: AuthRequest, res: Response) => {
    const { teacher_id, subject_id, grade_id } = req.body;
    
    // Security check
    const { data: tCheck } = await supabase!.from("teachers").select("school_id").eq("id", teacher_id).single();
    if (tCheck?.school_id !== req.user!.school_id) {
       return res.status(403).json({ error: "Access denied." });
    }

    const { error } = await supabase!.from("teacher_subjects").delete().match({ teacher_id, subject_id, grade_id });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });

  // Marks
  app.get("/api/marks", authenticateToken, async (req: AuthRequest, res: Response) => {
    const { exam_id, grade_id, subject_id } = req.query;
    let query = supabase!
      .from("marks")
      .select(`
        *,
        students (name, admission_number, grade_id, school_id),
        subjects (subject_name, school_id)
      `)
      .eq("school_id", req.user!.school_id);
    
    if (exam_id) query = query.eq("exam_id", exam_id);
    if (subject_id) query = query.eq("subject_id", subject_id);
    
    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    const formatted = (data || [])
      .filter(m => !grade_id || m.students?.grade_id === Number(grade_id))
      .map(m => ({
        ...m,
        student_name: m.students?.name,
        admission_number: m.students?.admission_number,
        subject_name: m.subjects?.subject_name
      }));
    res.json(formatted);
  });

  app.post("/api/marks", authenticateToken, async (req: AuthRequest, res: Response) => {
    const { student_id, subject_id, exam_id, score } = req.body;
    const user = req.user as UserPayload;

    if (user.role === 'Teacher') {
      const { data: assignment, error: assignErr } = await supabase!
        .from("teacher_subjects")
        .select("*, teachers(id, school_id)")
        .eq("teacher_id", user.id)
        .eq("subject_id", subject_id)
        .single();
      
      if (assignErr || !assignment || assignment.teachers?.school_id !== user.school_id) {
        return res.status(403).json({ error: "You are not assigned to this subject" });
      }
    }

    const { error } = await supabase!.from("marks").upsert({ 
      student_id, 
      subject_id, 
      exam_id, 
      score,
      school_id: user.school_id
    }, { onConflict: 'student_id,subject_id,exam_id' });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });

  // Analytics & Reports
  app.get("/api/reports/class-results", authenticateToken, async (req: AuthRequest, res: Response) => {
    const { exam_id, grade_id } = req.query;
    if (!exam_id || !grade_id) return res.status(400).json({ error: "exam_id and grade_id required" });

    const [studentsRes, subjectsRes, marksRes] = await Promise.all([
      supabase!.from("students").select("*").eq("grade_id", grade_id).eq("school_id", req.user!.school_id),
      supabase!.from("subjects").select("*").eq("school_id", req.user!.school_id),
      supabase!.from("marks")
        .select("*, subjects(subject_code, school_id)")
        .eq("exam_id", exam_id)
        .eq("school_id", req.user!.school_id)
    ]);

    if (studentsRes.error) return res.status(400).json({ error: studentsRes.error.message });

    const formattedMarks = marksRes.data?.map(m => ({
      ...m,
      subject_code: m.subjects?.subject_code
    })) || [];

    res.json({ 
      students: studentsRes.data, 
      subjects: subjectsRes.data, 
      marks: formattedMarks 
    });
  });

  // Vite setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
