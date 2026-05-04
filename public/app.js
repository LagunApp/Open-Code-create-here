// Client-side logic: fetch profiles, submit new profile, and listen for real-time updates
// Frontend using Supabase (client-side)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/esm/index.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const listEl = document.getElementById('list');
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const authSection = document.getElementById('auth');
const appUi = document.getElementById('app-ui');
const chatBox = document.getElementById('global-chat');
const chatForm = document.getElementById('chat-form');
const groupForm = document.getElementById('group-form');
const groupsEl = document.getElementById('groups');

function escapeHtml(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

async function checkSession(){
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    showApp();
    subscribeRealtime();
    await loadProfiles();
    await loadMessages();
    await loadGroups();
  } else {
    showAuth();
  }
}

function showApp(){ authSection.style.display = 'none'; appUi.style.display = 'flex'; }
function showAuth(){ authSection.style.display = ''; appUi.style.display = 'none'; }

async function loadProfiles(){
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending:false });
  if (error) { listEl.innerHTML = '<p>Error cargando perfiles.</p>'; console.error(error); return; }
  renderProfiles(data);
}

function renderProfiles(profiles){
  if (!profiles || profiles.length===0) { listEl.innerHTML = '<p>No hay perfiles todavía.</p>'; return; }
  listEl.innerHTML = '';
  profiles.forEach(p => {
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <img src="${escapeHtml(p.photo || 'https://placehold.co/96x96')}" alt="foto" />
      <div class="info">
        <h3>${escapeHtml(p.name)} ${p.age?'<small>('+escapeHtml(String(p.age))+')</small>':''}</h3>
        <p><strong>De dónde:</strong> ${escapeHtml(p.location || '-')}</p>
        <p><strong>Comida:</strong> ${escapeHtml(p.food || '-')}</p>
        <p><strong>Deporte:</strong> ${escapeHtml(p.sports || '-')}</p>
        <p><strong>Aficiones:</strong> ${escapeHtml(p.hobbies || '-')}</p>
        <p><strong>Música:</strong> ${escapeHtml(p.music || '-')}</p>
        <p><strong>Personalidad:</strong> ${escapeHtml(p.personality || '-')}</p>
        <p><strong>Planes:</strong> ${escapeHtml(p.plans || '-')}</p>
      </div>
    `;
    listEl.appendChild(card);
  });
}

registerForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(registerForm);
  const username = fd.get('username');
  const password = fd.get('password');
  const profile = {};
  ['name','age','location','food','sports','hobbies','music','personality','plans','photo'].forEach(k=>{ const v=fd.get(k); if (v) profile[k]=v; });
  try{
    const { data, error } = await supabase.auth.signUp({ email: username, password });
    if (error) throw error;
    // create profile row linked by auth id will be done after confirmation; for demo we'll insert anyway if anon key allows
    await supabase.from('profiles').insert([{ ...profile, name: profile.name || username }]);
    alert('Registro completado. Revisa tu email si Supabase requiere confirmación.');
  }catch(err){ alert('Registro error: '+err.message); console.error(err); }
});

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(loginForm);
  const username = fd.get('username');
  const password = fd.get('password');
  try{
    const { data, error } = await supabase.auth.signInWithPassword({ email: username, password });
    if (error) throw error;
    showApp();
    subscribeRealtime();
    await loadProfiles();
    await loadMessages();
    await loadGroups();
  }catch(err){ alert('Login error: '+err.message); console.error(err); }
});

// Messages
async function loadMessages(){
  const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending:true });
  if (error) { console.error(error); return; }
  chatBox.innerHTML = '';
  data.forEach(appendMessage);
}

function appendMessage(m){ const el = document.createElement('div'); el.className='msg'; el.textContent = `[${new Date(m.created_at).toLocaleTimeString()}] ${m.from}: ${m.text}`; chatBox.appendChild(el); chatBox.scrollTop = chatBox.scrollHeight; }

chatForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const text = new FormData(chatForm).get('message'); if (!text) return;
  const { data: user } = await supabase.auth.getUser();
  const from = user ? (user.user.email || user.user.id) : 'anon';
  try{
    await supabase.from('messages').insert([{ from, text }]);
    chatForm.reset();
  }catch(err){ console.error(err); alert('Error enviando mensaje'); }
});

// Groups
async function loadGroups(){ const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending:false }); if (error) { console.error(error); return; } renderGroups(data); }
function renderGroups(groups){ groupsEl.innerHTML=''; if (!groups || groups.length===0) { groupsEl.textContent='No hay grupos.'; return; } groups.forEach(g=>{ const d=document.createElement('div'); d.className='group'; d.textContent=`${g.name} (${g.members?g.members.length:0})`; groupsEl.appendChild(d); }); }

groupForm.addEventListener('submit', async (e)=>{ e.preventDefault(); const name = new FormData(groupForm).get('name'); if (!name) return; const { data: user } = await supabase.auth.getUser(); const uid = user ? user.user.id : null; try{ await supabase.from('groups').insert([{ name, members: uid ? [uid] : [] }]); groupForm.reset(); }catch(err){ console.error(err); alert('Error creando grupo'); } });

// Realtime subscriptions
let profileSub=null, messageSub=null, groupSub=null;
function subscribeRealtime(){
  if (profileSub || messageSub || groupSub) return;
  profileSub = supabase.channel('public:profiles')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => { loadProfiles(); })
    .subscribe();
  messageSub = supabase.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => { appendMessage(payload.new); })
    .subscribe();
  groupSub = supabase.channel('public:groups')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, payload => { loadGroups(); })
    .subscribe();
}

checkSession();
