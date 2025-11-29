import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://wajkisiwqfqoihleibtl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhamtpc2l3cWZxb2lobGVpYnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MDQxMzksImV4cCI6MjA3OTQ4MDEzOX0.i-kXWQt_-6cYZXvTwMFZ2WQo4wmg2nRE7inLPXk8Y9s"; // your anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
