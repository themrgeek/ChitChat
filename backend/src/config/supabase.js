const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
let supabaseUrl = process.env.SUPABASE_URL;
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  } else {
    console.warn('⚠️  Using mock Supabase configuration for development - Database operations will fail!');
    console.warn('📝 Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for full functionality');
    // Provide mock values for development so the client can initialize
    supabaseUrl = supabaseUrl || 'https://mock.supabase.co';
    supabaseServiceKey = supabaseServiceKey || 'mock-service-key';
    supabaseAnonKey = supabaseAnonKey || 'mock-anon-key';
  }
}

// Admin client for server-side operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Public client for client-side operations
const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = {
  supabaseAdmin,
  supabasePublic,
  supabaseUrl
};
