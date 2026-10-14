/*
  إعدادات الاتصال العامة بمشروع Supabase.
  استبدل القيمتين من Project Settings → API.
  مسموح وضع anon/publishable key في الواجهة فقط عند تفعيل RLS والسياسات المرفقة.
  لا تضع service_role key هنا أبداً.
*/
window.APP_CONFIG = {
  SUPABASE_URL: "https://msfkzlgzrrwowzqswjeo.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_VrSSf2MML6_kII0uVt535w_kxtc62vQ"
};