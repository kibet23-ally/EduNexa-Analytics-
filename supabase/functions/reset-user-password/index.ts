import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  console.log(`Request received from origin: ${origin}, method: ${req.method}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        ...(origin ? { 'Access-Control-Allow-Origin': origin } : {})
      },
      status: 200
    })
  }

  try {
    const headers = {
      ...corsHeaders,
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Content-Type': 'application/json'
    };

    const { email, newPassword, userId } = await req.json()
    
    if (!newPassword || (!email && !userId)) {
      throw new Error('Email or User ID, and New Password are required')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let targetUserId = userId;

    // If email is provided, find the actual Auth User ID (UUID)
    if (email) {
      console.log(`Looking up auth user for email: ${email}`);
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase().trim());
      if (!authUser) {
        throw new Error(`User with email ${email} not found in Supabase Auth`);
      }
      targetUserId = authUser.id;
    }

    console.log(`Updating password for user ID: ${targetUserId}`);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    )

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully' }),
      { 
        headers: headers,
        status: 200 
      }
    )
  } catch (error) {
    const origin = req.headers.get('Origin');
    const headers = {
      ...corsHeaders,
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Content-Type': 'application/json'
    };
    console.error('Edge Function Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: headers,
        status: 400 
      }
    )
  }
})
