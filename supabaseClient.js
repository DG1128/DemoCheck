import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://wajkisiwqfqoihleibtl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhamtpc2l3cWZxb2lobGVpYnRsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkwNDEzOSwiZXhwIjoyMDc5NDgwMTM5fQ.R4Y7vFCUVd0s1OPKeTmVSmJZPIQb3XOb6zjEkz39Czg"; // your anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
