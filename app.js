(() => {
  "use strict";
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const statusClass = value => String(value || "").replace(/\s+/g, "-");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const dateText = value => {
    if (!value) return "لم يحدد بعد";
    const p = String(value).split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : value;
  };
  let supabase = null, devices = [], editingId = null, settings = { store_name:"مركز الصيانة", whatsapp_number:"" };

  function msg(el, text, type="") { el.textContent = text; el.className = `message ${type}`.trim(); }
  function configReady() {
    return cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
      !cfg.SUPABASE_URL.includes("PASTE_YOUR") && !cfg.SUPABASE_ANON_KEY.includes("PASTE_YOUR");
  }
  function init() {
    $("year").textContent = new Date().getFullYear();
    if (window.supabase && configReady()) {
      supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      loadPublicSettings();
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session) { $("adminLoginPanel").classList.add("hidden"); $("adminPanel").classList.remove("hidden"); loadAdminData(); }
        else { $("adminPanel").classList.add("hidden"); }
      });
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) { $("adminPanel").classList.remove("hidden"); loadAdminData(); }
      });
    } else {
      msg($("lookupMessage"), "يلزم إعداد رابط Supabase ومفتاحه داخل ملف config.js قبل استخدام الموقع.", "error");
    }
  }
  async function loadPublicSettings() {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("public_store_settings");
    if (!error && data && data.length) {
      settings = { store_name: data[0].store_name || "مركز الصيانة", whatsapp_number: data[0].whatsapp_number || "" };
      updateBrand();
    }
  }
  function updateBrand() {
    $("headerStoreName").textContent = settings.store_name;
    $("footerStoreName").textContent = settings.store_name;
    const phone = String(settings.whatsapp_number || "").replace(/[^\d]/g, "");
    const link = $("supportLink");
    if (phone) { link.href = `https://wa.me/${phone}`; link.classList.remove("hidden"); }
    else link.classList.add("hidden");
  }
  $("lookupForm").addEventListener("submit", async e => {
    e.preventDefault();
    $("deviceResult").classList.add("hidden");
    msg($("lookupMessage"), "");
    if (!supabase) { msg($("lookupMessage"), "أكمل إعداد قاعدة البيانات أولاً باتباع ملف README_AR.md.", "error"); return; }
    const code = $("lookupCode").value.trim();
    if (!code) return;
    const button = $("lookupForm").querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const { data, error } = await supabase.rpc("lookup_repair_device", { p_code: code });
      if (error) throw error;
      if (!data || !data.length) { msg($("lookupMessage"), "لم نعثر على جهاز بهذا الكود. تحقق منه وحاول مجدداً.", "error"); return; }
      msg($("lookupMessage"), "تم العثور على بيانات الجهاز.", "success");
      renderResult(data[0]);
    } catch (error) { msg($("lookupMessage"), "تعذر البحث حالياً. تحقق من إعداد قاعدة البيانات ثم حاول مجدداً.", "error"); console.error(error); }
    finally { button.disabled = false; }
  });
  function renderResult(d) {
    const el = $("deviceResult");
    const phone = String(d.whatsapp_number || settings.whatsapp_number || "").replace(/[^\d]/g, "");
    el.innerHTML = `<div class="result-top"><div><span class="code-label">كود المتابعة</span><div class="code-value">${esc(d.code)}</div><h3>${esc(d.device_name)}</h3><span class="code-label">${esc(d.device_type || "نوع الجهاز غير محدد")}</span></div><span class="status ${statusClass(d.status)}">${esc(d.status)}</span></div>
    <div class="result-grid"><div class="result-item"><span>نوع العطل</span><strong>${esc(d.fault)}</strong></div><div class="result-item"><span>موعد الاستلام التقريبي</span><strong>${esc(dateText(d.due_date))}</strong></div><div class="result-item" style="grid-column:1/-1"><span>آخر ما تم إنجازه</span><strong>${esc(d.work_done || "لم تتم إضافة تحديث حتى الآن.")}</strong></div></div>
    ${phone ? `<a class="result-support" href="https://wa.me/${esc(phone)}" target="_blank" rel="noopener">تواصل مع خدمة العملاء عبر واتساب</a>` : ""}`;
    el.classList.remove("hidden");
  }
  $("adminOpenBtn").addEventListener("click", () => {
    $("adminLoginPanel").classList.remove("hidden");
    $("loginMessage").textContent = "";
    $("adminLoginPanel").scrollIntoView({ behavior:"smooth", block:"center" });
  });
  $("closeLoginBtn").addEventListener("click", () => $("adminLoginPanel").classList.add("hidden"));
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!supabase) { msg($("loginMessage"), "أكمل إعداد Supabase أولاً.", "error"); return; }
    const btn = $("loginBtn"); btn.disabled = true;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email:$("adminEmail").value.trim(), password:$("adminPassword").value });
      if (error) throw error;
      $("adminPassword").value = "";
      $("adminLoginPanel").classList.add("hidden"); $("adminPanel").classList.remove("hidden");
      await loadAdminData(); $("adminPanel").scrollIntoView({ behavior:"smooth", block:"start" });
    } catch (error) { msg($("loginMessage"), "فشل تسجيل الدخول. تحقق من بيانات الحساب وصلاحيات الإدارة.", "error"); console.error(error); }
    finally { btn.disabled = false; }
  });
  $("logoutBtn").addEventListener("click", async () => {
    if (supabase) await supabase.auth.signOut();
    $("adminPanel").classList.add("hidden");
  });
  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === btn));
    document.querySelectorAll(".tab-panel").forEach(x => x.classList.toggle("hidden", x.id !== btn.dataset.tab));
    if (btn.dataset.tab === "settingsTab") fillSettings();
  }));
  async function loadAdminData() {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data, error } = await supabase.from("repair_devices").select("*").order("created_at", { ascending:false });
    if (error) { msg($("formMessage"), "تعذر تحميل الأجهزة. تأكد من إضافة حسابك إلى قائمة المديرين في قاعدة البيانات.", "error"); console.error(error); return; }
    devices = data || []; renderDevices();
    const { data: s, error: se } = await supabase.from("store_settings").select("*").eq("id", 1).maybeSingle();
    if (!se && s) settings = { store_name:s.store_name || "مركز الصيانة", whatsapp_number:s.whatsapp_number || "" };
    updateBrand(); fillSettings();
  }
  function fillSettings() { $("storeName").value = settings.store_name || ""; $("whatsapp").value = settings.whatsapp_number || ""; }
  function generateCode() {
    // 8 أرقام عشوائية؛ يتحقق الخادم من التفرد بواسطة قيد UNIQUE.
    return String(Math.floor(10000000 + Math.random() * 90000000));
  }
  $("deviceForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!supabase) return;
    const btn = $("saveBtn"); btn.disabled = true;
    const payload = { device_name:$("deviceName").value.trim(), device_type:$("deviceType").value.trim(), fault:$("fault").value.trim(), status:$("status").value, due_date:$("dueDate").value || null, work_done:$("workDone").value.trim() };
    try {
      if (editingId) {
        const { error } = await supabase.from("repair_devices").update(payload).eq("id", editingId);
        if (error) throw error;
        msg($("formMessage"), "تم تحديث بيانات الجهاز.", "success");
      } else {
        let saved = false, newCode = "";
        for (let i=0; i<5 && !saved; i++) {
          newCode = generateCode();
          const { error } = await supabase.from("repair_devices").insert({ ...payload, code:newCode });
          if (!error) saved = true;
          else if (error.code !== "23505") throw error;
        }
        if (!saved) throw new Error("تعذر إنشاء كود فريد، حاول الحفظ مرة أخرى.");
        msg($("formMessage"), `تم حفظ الجهاز. كود المتابعة: ${newCode}`, "success");
      }
      resetForm(); await loadAdminData();
    } catch (error) { msg($("formMessage"), "لم يتم الحفظ. تحقق من اتصال قاعدة البيانات والصلاحيات ثم حاول مجدداً.", "error"); console.error(error); }
    finally { btn.disabled = false; }
  });
  function renderDevices() {
    const q = $("adminSearch").value.trim().toLowerCase();
    const filtered = devices.filter(d => [d.code,d.device_name,d.device_type,d.fault,d.status].some(v => String(v||"").toLowerCase().includes(q)));
    $("statTotal").textContent = devices.length;
    $("statWorking").textContent = devices.filter(d => ["قيد الانتظار","جاري التجهيز"].includes(d.status)).length;
    $("statReady").textContent = devices.filter(d => d.status === "جاهز للاستلام").length;
    $("deviceCount").textContent = `${filtered.length} جهاز`;
    $("devicesList").innerHTML = filtered.length ? filtered.map(d => `<article class="device-row"><div class="device-row-top"><div><h4>${esc(d.device_name)}</h4><p>الكود: <b>${esc(d.code)}</b> · ${esc(d.fault)}</p></div><span class="status ${statusClass(d.status)}">${esc(d.status)}</span></div><div class="device-meta"><span class="code-label">الاستلام: ${esc(dateText(d.due_date))}</span><div class="device-actions"><button class="ghost" data-edit="${esc(d.id)}" type="button">تعديل</button><button class="danger" data-delete="${esc(d.id)}" type="button">حذف</button></div></div></article>`).join("") : `<div class="empty">${devices.length ? "لا توجد نتائج مطابقة." : "لا توجد أجهزة مسجلة بعد."}</div>`;
  }
  $("adminSearch").addEventListener("input", renderDevices);
  $("devicesList").addEventListener("click", async e => {
    const edit = e.target.closest("[data-edit]")?.dataset.edit, del = e.target.closest("[data-delete]")?.dataset.delete;
    if (edit) {
      const d = devices.find(x => String(x.id) === String(edit)); if (!d) return;
      editingId = d.id; $("deviceName").value=d.device_name; $("deviceType").value=d.device_type||""; $("fault").value=d.fault; $("status").value=d.status; $("dueDate").value=d.due_date||""; $("workDone").value=d.work_done||"";
      $("formTitle").textContent=`تعديل الجهاز (${d.code})`; $("saveBtn").textContent="حفظ التعديلات"; $("cancelEdit").classList.remove("hidden"); $("deviceForm").scrollIntoView({behavior:"smooth",block:"start"});
    } else if (del) {
      const d = devices.find(x => String(x.id) === String(del));
      if (d && confirm(`هل تريد حذف الجهاز ${d.device_name} بالكود ${d.code}؟`)) {
        const { error } = await supabase.from("repair_devices").delete().eq("id", d.id);
        if (error) { alert("تعذر الحذف. تحقق من صلاحيات الإدارة."); return; }
        if (String(editingId) === String(d.id)) resetForm();
        await loadAdminData();
      }
    }
  });
  function resetForm() { $("deviceForm").reset(); editingId=null; $("formTitle").textContent="إضافة جهاز جديد"; $("saveBtn").textContent="حفظ الجهاز"; $("cancelEdit").classList.add("hidden"); }
  $("cancelEdit").addEventListener("click", resetForm);
  $("settingsForm").addEventListener("submit", async e => {
    e.preventDefault(); if (!supabase) return;
    const btn=$("settingsSaveBtn"); btn.disabled=true;
    const payload={ id:1, store_name:$("storeName").value.trim(), whatsapp_number:$("whatsapp").value.trim().replace(/[^\d]/g,"") };
    try {
      const { error } = await supabase.from("store_settings").upsert(payload, { onConflict:"id" });
      if (error) throw error;
      settings={store_name:payload.store_name,whatsapp_number:payload.whatsapp_number}; updateBrand();
      msg($("settingsMessage"), "تم حفظ إعدادات المركز بنجاح.", "success");
    } catch (error) { msg($("settingsMessage"), "تعذر حفظ الإعدادات. تأكد من صلاحيات حساب الإدارة.", "error"); console.error(error); }
    finally { btn.disabled=false; }
  });
  init();
})();