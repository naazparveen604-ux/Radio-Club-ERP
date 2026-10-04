import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Authenticate the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Verify admin role via profiles (database lookup, safest method per Phase 2)
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role_id !== 1) { // 1 = super_admin
      throw new Error('Forbidden: Requires super_admin role')
    }

    const { email, password, full_name, role_id } = await req.json()

    if (!email || !password || !full_name) {
      throw new Error('Missing required fields')
    }

    // Now instantiate admin client with SERVICE_ROLE_KEY
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (createError) throw createError

    // Optionally update the role if provided
    if (role_id && role_id !== 4) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ role_id })
        .eq('id', newUser.user.id)
      
      if (updateError) throw updateError
    }

    return new Response(
      JSON.stringify(newUser),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
