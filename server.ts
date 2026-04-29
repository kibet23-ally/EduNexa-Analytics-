import express from "express";
import { createServer as createViteServer } from "vite";
import compression from "compression";
import path from "path";
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Initialize Supabase Admin with the Service Role Key for high-privilege tasks
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zclwokyzsqzitqwmugtt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Essential Middleware
  app.use(compression());
  app.use(express.json());

  // Performance Logger Middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 500) {
        console.warn(`[PERF ALERT] SLOW REQUEST: ${req.method} ${req.path} took ${duration}ms`);
      }
    });
    next();
  });

  /**
   * Middleware: Subscription Access Control
   * 1. Fetches school data
   * 2. Checks expiry
   * 3. Blocks non-GET requests if expired
   */
  const checkSubscription = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip non-API and static routes
    if (!req.path.startsWith('/api')) return next();
    
    // Always allow health checks
    if (req.path === '/api/health') return next();

    // Skip verification for login/auth routes to prevent loops
    const authRoutes = ['/api/auth/teacher-login', '/api/admin/reset-password', '/api/admin/create-school-admin'];
    if (authRoutes.includes(req.path)) return next();

    try {
      let schoolId = req.body.schoolId || req.body.school_id;
      
      // 1. Try to get schoolId from sessionToken (DB_SESSION_ style)
      const sessionToken = req.body.sessionToken || req.headers['x-session-token'];
      if (!schoolId && sessionToken && typeof sessionToken === 'string' && sessionToken.startsWith('DB_SESSION_')) {
        const parts = sessionToken.split('_');
        const tId = parts[2];
        const { data: teacher } = await supabaseAdmin!.from('teachers').select('school_id').eq('id', tId).maybeSingle();
        schoolId = teacher?.school_id;
      }

      // 2. Try to get schoolId from Auth Header (JWT style)
      if (!schoolId && req.headers.authorization) {
        const token = req.headers.authorization.replace('Bearer ', '');
        const { data: { user } } = await supabaseAdmin!.auth.getUser(token);
        if (user) {
          schoolId = user.user_metadata?.school_id || user.app_metadata?.school_id;
          if (!schoolId) {
             const { data: profile } = await supabaseAdmin!.from('users').select('school_id').eq('id', user.id).maybeSingle();
             schoolId = profile?.school_id;
          }
        }
      }

      if (!schoolId) {
        // If we can't find a schoolId, we can't enforce subscription.
        // For production, you might want to block or allow. We'll allow for now.
        return next();
      }

      const { data: school, error } = await supabaseAdmin!
        .from('schools')
        .select('subscription_status, subscription_expiry')
        .eq('id', schoolId)
        .maybeSingle();

      if (error || !school) {
        console.warn(`[Subscription] School ${schoolId} not found or error occurred`);
        return next();
      }

      const now = new Date();
      const expiry = school.subscription_expiry ? new Date(school.subscription_expiry) : null;
      
      // LOGGING AS REQUESTED
      console.log(`[Subscription Log]
  Path: ${req.path}
  Method: ${req.method}
  School: ${schoolId}
  Status: ${school.subscription_status}
  Expiry Date: ${expiry ? expiry.toISOString() : 'N/A'}
  Current Date: ${now.toISOString()}
      `);

      // Auto-update status to "expired" if date passed but still marked active
      if (expiry && now > expiry && (school.subscription_status?.toLowerCase() === 'active' || school.subscription_status === 'Active')) {
        console.log(`[Subscription] Auto-updating school ${schoolId} to expired`);
        await supabaseAdmin!
          .from('schools')
          .update({ subscription_status: 'expired' })
          .eq('id', schoolId);
        school.subscription_status = 'expired';
      }

      const isExpired = (expiry && now > expiry) || school.subscription_status?.toLowerCase() === 'expired' || school.subscription_status === 'Expired';
      
      if (isExpired) {
        // Block mutations (non-GET)
        const isGetRequest = req.method === 'GET' || req.path.includes('/fetch');
        const isMutation = !isGetRequest;
        
        if (isMutation) {
          console.warn(`[Subscription BLOCKED] Request to ${req.path} for expired school ${schoolId}`);
          return res.status(403).json({ 
            error: "Subscription expired. Your account is in read-only mode. Please contact support or your school administrator.",
            expired: true 
          });
        }
      }

      next();
    } catch (err) {
      console.error("[Subscription Middleware Error]:", err);
      next();
    }
  };

  // Apply checkSubscription globally to /api
  app.use('/api', checkSubscription);

  // Health and debug routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "EduNexa Analytics: Online",
      timestamp: new Date().toISOString(),
      admin_ready: !!supabaseAdmin
    });
  });

  // Admin Password Reset Endpoint (Bypasses Frontend CORS issues)
  app.post("/api/admin/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;

    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Service Key not configured on server" });
    }

    if (!email || !newPassword) {
      return res.status(400).json({ error: "Email and New Password are required" });
    }

    try {
      console.log(`[Admin] Resetting password for: ${email}`);
      const cleanEmail = email.toLowerCase().trim();
      
      // 1. Try finding User ID in 'users' table or 'teachers' table
      const [{ data: userData }, { data: teacherData }] = await Promise.all([
        supabaseAdmin.from('users').select('id').ilike('email', cleanEmail).maybeSingle(),
        supabaseAdmin.from('teachers').select('id').ilike('email', cleanEmail).maybeSingle()
      ]);

      let targetId: string | null = userData?.id || teacherData?.id || null;

      // 3. Fallback: search Auth list robustly
      if (!targetId) {
        console.log(`[Admin] User not found in DB tables, searching Auth list for ${cleanEmail}...`);
        let foundAuthUser = null;
        let page = 1;
        while (page <= 5) {
          const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
            page: page,
            perPage: 1000
          });
          if (listError) throw listError;
          if (!users || users.length === 0) break;
          foundAuthUser = users.find(u => u.email?.toLowerCase() === cleanEmail);
          if (foundAuthUser) {
            targetId = foundAuthUser.id;
            break;
          }
          if (users.length < 1000) break;
          page++;
        }
      }

      if (!targetId) {
        return res.status(404).json({ error: `User not found. Ensure '${email}' is exactly how it appears in the User Registry.` });
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetId, { password: newPassword });
      if (updateError) throw updateError;
      res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // Create School Admin Endpoint
  app.post("/api/admin/create-school-admin", async (req, res) => {
    const { email, password, name, schoolId, role = 'Admin' } = req.body;

    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Service Key not configured on server" });
    }

    if (!email || !password || !name || !schoolId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      console.log(`[Admin] Starting provision for: ${email}`);
      const cleanEmail = email.toLowerCase().trim();

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: { name, school_id: schoolId }
      });

      if (authError) {
        console.error(`[Admin] Auth creation failed for ${email}:`, authError.message);
        throw authError;
      }
      
      const userId = authData.user.id;
      console.log(`[Admin] Auth user created: ${userId}. Linking to DB tables...`);

      const [userRes, teacherRes] = await Promise.all([
        supabaseAdmin.from('users').insert([{ id: userId, email: cleanEmail, name, role, school_id: schoolId }]),
        supabaseAdmin.from('teachers').insert([{ email: cleanEmail, name, role, school_id: schoolId, status: 'Active' }])
      ]);

      if (userRes.error) console.error(`[Admin] 'users' table link failed:`, userRes.error.message);
      if (teacherRes.error) console.error(`[Admin] 'teachers' table link failed:`, teacherRes.error.message);

      console.log(`[Admin] Provision complete for ${email}`);
      res.json({ success: true, userId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Admin Error] User Creation:", message);
      res.status(500).json({ error: message });
    }
  });

  // Teacher Login Endpoint (For teachers without Supabase Auth)
  app.post("/api/auth/teacher-login", async (req, res) => {
    const { email, password } = req.body;

    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Service Key not configured on server" });
    }

    try {
      const cleanEmail = email.toLowerCase().trim();
      console.log(`[Login] Teacher login attempt for: ${cleanEmail}`);

      const { data: teacher, error } = await supabaseAdmin
        .from('teachers')
        .select('*')
        .ilike('email', cleanEmail)
        .eq('password', password)
        .maybeSingle();

      if (error) throw error;

      if (!teacher) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check if school is suspended
      if (teacher.school_id) {
        const { data: schoolData } = await supabaseAdmin
          .from('schools')
          .select('subscription_status')
          .eq('id', teacher.school_id)
          .maybeSingle();

        const schoolStatus = (schoolData?.subscription_status || '').toLowerCase();
        
        if (schoolStatus === 'suspended') {
          return res.status(403).json({ error: "Your school account is currently suspended. Please contact your administrator." });
        }
      }

      console.log(`[Login] Successful teacher login: ${cleanEmail}`);
      res.json({ 
        success: true, 
        user: {
          id: `teacher-${teacher.id}`,
          email: teacher.email,
          name: teacher.name,
          role: teacher.role || 'Teacher',
          school_id: teacher.school_id
        },
        token: `DB_SESSION_${teacher.id}_${Buffer.from(teacher.email).toString('base64')}`
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Login Error] Teacher Authentication:", message);
      res.status(500).json({ error: message });
    }
  });

  // Data Proxy for Table-Based Teachers/Admins
  app.post("/api/proxy/fetch", async (req, res) => {
    const { table, query, sessionToken } = req.body;

    if (!supabaseAdmin) return res.status(500).json({ error: "Service Key Missing" });
    
    try {
      let schoolId = null;

      // 1. Try DB_SESSION_ (Legacy Teachers)
      if (sessionToken && sessionToken.startsWith('DB_SESSION_')) {
        const parts = sessionToken.split('_');
        const tId = parts[2];
        const { data: teacher } = await supabaseAdmin
          .from('teachers')
          .select('school_id')
          .eq('id', tId)
          .single();
        schoolId = teacher?.school_id;
      } 
      
      let isSuperAdmin = false;
      // 2. Try Authorization Header (Modern Admins/Teachers)
      if (!schoolId && req.headers.authorization) {
        const token = req.headers.authorization.replace('Bearer ', '');
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) {
          const role = user.user_metadata?.role || user.app_metadata?.role;
          if (role?.toLowerCase() === 'superadmin' || role?.toLowerCase() === 'super_admin') {
            isSuperAdmin = true;
          }

          schoolId = user.user_metadata?.school_id || user.app_metadata?.school_id;
          if (!schoolId) {
            const { data: profile } = await supabaseAdmin.from('users').select('school_id, role').eq('id', user.id).maybeSingle();
            schoolId = profile?.school_id;
            if (profile?.role?.toLowerCase() === 'superadmin' || profile?.role?.toLowerCase() === 'super_admin') {
              isSuperAdmin = true;
            }
          }
        }
      }

      if (!schoolId && !isSuperAdmin) {
        return res.status(401).json({ error: "Invalid or missing session token. Please re-login." });
      }

      let sbQuery = supabaseAdmin.from(table).select(query.select || '*', query.options || {});
      
      // Support Range Pagination
      if (query.range) {
        sbQuery = sbQuery.range(query.range.from, query.range.to);
      }

      // Support OrderBy
      if (query.orderBy) {
        sbQuery = sbQuery.order(query.orderBy.column, { 
          ascending: query.orderBy.ascending !== false 
        });
      }

      // Support Limit
      if (query.limit) {
        sbQuery = sbQuery.limit(query.limit);
      }

      // GLOBAL TABLES that don't have school_id
      const globalTables = ['subscription_plans', 'orders'];
      const isGlobalTable = globalTables.includes(table);

      // Only apply school_id filter if NOT a super admin AND it's not a global table
      if (!isSuperAdmin && schoolId && !isGlobalTable) {
        if (table === 'schools') {
          // Schools table uses 'id' instead of 'school_id'
          sbQuery = sbQuery.eq('id', schoolId);
        } else {
          sbQuery = sbQuery.eq('school_id', schoolId);
        }
      }

      if (query.filters) {
        Object.entries(query.filters).forEach(([key, val]) => {
          sbQuery = sbQuery.eq(key, val);
        });
      }

      console.log(`[Proxy Fetch] Table: ${table}, School: ${schoolId}`);
      const { data, count, error } = await sbQuery;

      if (error) {
        console.error(`[Proxy Fetch Error] Table: ${table}:`, error);
        return res.status(500).json({ error: error.message || "Database fetch error" });
      }
      res.json({ data, count });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Proxy Fetch Error] Table: ${table}:`, message);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/proxy/write", async (req, res) => {
    const { table, operation, payload, filters, onConflict, sessionToken } = req.body;

    if (!supabaseAdmin) return res.status(500).json({ error: "Service Key Missing" });

    try {
      let schoolId = null;

      // 1. Try DB_SESSION_
      if (sessionToken && sessionToken.startsWith('DB_SESSION_')) {
        const parts = sessionToken.split('_');
        const tId = parts[2];
        const { data: teacher } = await supabaseAdmin
          .from('teachers')
          .select('school_id')
          .eq('id', tId)
          .single();
        schoolId = teacher?.school_id;
      }
      
      let isSuperAdmin = false;
      // 2. Try Authorization
      if (!schoolId && req.headers.authorization) {
        const token = req.headers.authorization.replace('Bearer ', '');
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) {
          const role = user.user_metadata?.role || user.app_metadata?.role;
          if (role?.toLowerCase() === 'superadmin' || role?.toLowerCase() === 'super_admin') {
            isSuperAdmin = true;
          }

          schoolId = user.user_metadata?.school_id || user.app_metadata?.school_id;
          if (!schoolId) {
            const { data: profile } = await supabaseAdmin.from('users').select('school_id, role').eq('id', user.id).maybeSingle();
            schoolId = profile?.school_id;
            if (profile?.role?.toLowerCase() === 'superadmin' || profile?.role?.toLowerCase() === 'super_admin') {
              isSuperAdmin = true;
            }
          }
        }
      }

      if (!schoolId && !isSuperAdmin) {
        return res.status(401).json({ error: "Invalid or missing session token. Please re-login." });
      }

      const sbTable = supabaseAdmin.from(table);
      
      // GLOBAL TABLES that don't have school_id
      const globalTables = ['subscription_plans', 'orders'];
      const isGlobalTable = globalTables.includes(table);

      // Block non-SuperAdmins from writing to global tables (security)
      if (isGlobalTable && !isSuperAdmin) {
        return res.status(403).json({ error: `You don't have permission to write to ${table}` });
      }

      // Ensure payload or filters always have school_id IF NOT super admin
      if (!isSuperAdmin && schoolId && !isGlobalTable && table !== 'schools') {
        if (Array.isArray(payload)) {
          payload.forEach((item: Record<string, unknown>) => { item.school_id = schoolId; });
        } else if (payload && typeof payload === 'object') {
          (payload as Record<string, unknown>).school_id = schoolId;
        }
      }

      let result;
      if (operation === 'insert' || operation === 'upsert') {
        if (operation === 'upsert') {
          result = await sbTable.upsert(payload, { onConflict }).select();
        } else {
          result = await sbTable.insert(payload).select();
        }
      } else if (operation === 'update') {
        let updateQuery = sbTable.update(payload);
        
        // Apply security filters
        if (!isSuperAdmin && schoolId) {
          if (table === 'schools') {
            updateQuery = updateQuery.eq('id', schoolId);
          } else if (!isGlobalTable) {
            updateQuery = updateQuery.eq('school_id', schoolId);
          }
        }

        if (filters) {
          Object.entries(filters).forEach(([key, val]) => {
            updateQuery = updateQuery.eq(key, val);
          });
        }
        result = await updateQuery.select();
      } else if (operation === 'delete') {
        let deleteQuery = sbTable.delete();

        // Apply security filters
        if (!isSuperAdmin && schoolId) {
          if (table === 'schools') {
            deleteQuery = deleteQuery.eq('id', schoolId);
          } else if (!isGlobalTable) {
            deleteQuery = deleteQuery.eq('school_id', schoolId);
          }
        }

        if (filters) {
          Object.entries(filters).forEach(([key, val]) => {
            deleteQuery = deleteQuery.eq(key, val);
          });
        }
        result = await deleteQuery.select();
      } else {
        return res.status(400).json({ error: "Invalid operation" });
      }

      if (result.error) {
        console.error(`[Proxy Write Error] Table: ${table}:`, result.error);
        return res.status(500).json({ error: result.error.message || "Database write error" });
      }
      res.json({ data: result.data });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Proxy Write Error] Table: ${table}:`, message);
      res.status(500).json({ error: message });
    }
  });

  // Diagnostic Endpoint
  app.get("/api/debug-env", (req, res) => {
    res.json({
      node_env: process.env.NODE_ENV,
      supabase_url_set: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      supabase_anon_key_set: !!(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
      mode: "frontend-only"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EduNexa Analytics Server running on http://localhost:${PORT}`);
    console.log("Status: API Data Proxy Enabled. Compression Active.");
  });
}

startServer();
