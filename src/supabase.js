import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hpetuehjehyrfqnavfdq.supabase.co';
const supabaseKey = 'sb_publishable_zMnqR8zGVkigId1jjHCLLg_4XQgS-EI';

export const supabase = createClient(supabaseUrl, supabaseKey);
