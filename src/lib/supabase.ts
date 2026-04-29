import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zclwokyzsqzitqwmugtt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjbHdva3l6c3F6aXRxd211Z3R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODc2NjIsImV4cCI6MjA5MjI2MzY2Mn0.DZUX4qVSNbd-Ai9R8NmYSQ_mdhhtt2-pYCS_T-D76tk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
