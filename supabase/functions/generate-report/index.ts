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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role_id')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role_id !== 1 && profile.role_id !== 3)) { // 1 = super_admin, 3 = club_manager
      throw new Error('Forbidden: Requires manager or admin role')
    }

    const { report_type } = await req.json()

    // Service role required to bypass RLS in edge function, but we strictly scope it manually
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let reportData = null
    
    if (report_type === 'tasks') {
      let query = supabaseAdmin.from('tasks').select('*, teams(name), profiles:created_by(full_name)')
      
      if (profile.role_id === 3) { // Manager
        // Get manager's teams
        const { data: teams } = await supabaseAdmin.from('teams').select('id').eq('manager_id', user.id)
        if (!teams || teams.length === 0) {
          return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }
        const teamIds = teams.map((t: any) => t.id)
        query = query.in('team_id', teamIds)
      }

      const { data, error } = await query
      if (error) throw error
      reportData = data
    } else {
      throw new Error('Unknown report type')
    }

    // Log the generation
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'generate_report',
      module: 'reports',
      new_value: { report_type }
    })

    return new Response(
      JSON.stringify(reportData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
