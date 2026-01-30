import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://elxtwxyuukmiiksiqmpr.supabase.co';
// Using the key provided by the user. 
// Note: Normally Supabase anon keys start with "ey...", ensure this is the correct public key.
const supabaseKey = 'sb_publishable_545bJ1-raRJggRiEKq3vTA_HceM4mjz'; 

export const supabase = createClient(supabaseUrl, supabaseKey);