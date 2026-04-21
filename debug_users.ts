import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listUsers() {
  const { data, error } = await supabase.from("teachers").select("email, name, role");
  if (error) {
    console.error("Error fetching teachers:", error);
  } else {
    console.log("Registered Users:");
    console.table(data);
  }
}

listUsers();
