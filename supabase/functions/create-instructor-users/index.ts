import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the request body
    const { instructor_emails } = await req.json()

    if (!instructor_emails || !Array.isArray(instructor_emails)) {
      return new Response(
        JSON.stringify({ error: 'instructor_emails array is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const results = []

    for (const email of instructor_emails) {
      try {
        // Check if user already exists in auth.users
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const userExists = existingUsers.users.some(user => user.email === email)

        if (userExists) {
          results.push({
            email,
            status: 'already_exists',
            message: '이미 존재하는 사용자입니다.'
          })
          continue
        }

        // Create user with admin client
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: 'bsedu123', // Default password
          email_confirm: true, // Auto-confirm email
        })

        if (createError) {
          results.push({
            email,
            status: 'error',
            message: createError.message
          })
          continue
        }

        results.push({
          email,
          status: 'created',
          message: '사용자가 성공적으로 생성되었습니다.',
          user_id: newUser.user.id
        })

      } catch (error) {
        console.error('Error creating user for email:', email, error)
        results.push({
          email,
          status: 'error',
          message: error.message || '사용자 생성 중 오류가 발생했습니다.'
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        summary: {
          total: instructor_emails.length,
          created: results.filter(r => r.status === 'created').length,
          already_exists: results.filter(r => r.status === 'already_exists').length,
          errors: results.filter(r => r.status === 'error').length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})