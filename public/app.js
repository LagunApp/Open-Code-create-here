// Client-side logic: fetch profiles, submit new profile, and listen for real-time updates
(function () {
  const state = { token: null, user: null };
  const listEl = document.getElementById('list');
  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  const authSection = document.getElementById('auth');
  const appUi = document.getElementById('app-ui');
  const chatBox = document.getElementById('global-chat');
  const chatForm = document.getElementById('chat-form');
  const groupForm = document.getElementById('group-form');
  const groupsEl = document.getElementById('groups');

  function setAuth(token, user){
    state.token = token; state.user = user;
    if (token) {
      localStorage.setItem('lagun_token', token);
      authSection.style.display = 'none';
      appUi.style.display = 'flex';
      initSocket();
      loadProfiles();
      loadGroups();
      loadMessages();
    } else {
      localStorage.removeItem('lagun_token');
      authSection.style.display = '';
      appUi.style.display = 'none';
    }
  }

  function escapeHtml(s){
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function loadProfiles(){
    try{
      const res = await fetch('/api/profiles');
      const data = await res.json();
      renderProfiles(data);
    }catch(err){ listEl.innerHTML = '<p>Error cargando perfiles.</p>'; console.error(err); }
  }

  function renderProfiles(profiles){
    if (!profiles || profiles.length === 0) { listEl.innerHTML = '<p>No hay perfiles todavía.</p>'; return; }
    listEl.innerHTML = '';
    profiles.slice().reverse().forEach(p => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="${escapeHtml(p.photo || 'https://placehold.co/96x96')}" alt="foto" />
        <div class="info">
          <h3>${escapeHtml(p.name)} <small>${p.age ? '('+escapeHtml(String(p.age))+')' : ''}</small></h3>
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

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(registerForm);
    const body = { username: fd.get('username'), password: fd.get('password'), profile: {} };
    ['name','age','location','food','sports','hobbies','music','personality','plans','photo'].forEach(k => { const v = fd.get(k); if (v) body.profile[k]=v; });
    try{
      const res = await fetch('/api/register',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'register failed');
      setAuth(data.token, data.user);
    }catch(err){ alert('Error registrando: '+err.message); console.error(err); }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const body = { username: fd.get('username'), password: fd.get('password') };
    try{
      const res = await fetch('/api/login',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'login failed');
      setAuth(data.token, data.user);
    }catch(err){ alert('Error login: '+err.message); console.error(err); }
  });

  // Socket.IO
  let socket = null;
  function initSocket(){
    if (socket) return;
    try{
      socket = io();
      socket.on('connect', () => console.log('socket connected'));
      socket.on('new-profile', (p) => { loadProfiles(); });
      socket.on('message', (m) => { appendMessage(m); });
      socket.on('group', (g) => { loadGroups(); });
    }catch(err){ console.warn('socket init failed', err); }
  }

  // Messages
  async function loadMessages(){
    try{ const res = await fetch('/api/messages'); const data = await res.json(); data.forEach(appendMessage); }catch(e){console.warn(e);} }

  function appendMessage(m){
    const el = document.createElement('div');
    el.className = 'msg';
    el.textContent = `[${new Date(m.createdAt).toLocaleTimeString()}] ${m.from}: ${m.text}`;
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = new FormData(chatForm).get('message');
    if (!text) return;
    try{
      const res = await fetch('/api/messages', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, state.token ? {'Authorization':'Bearer '+state.token} : {}), body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error('send failed');
      chatForm.reset();
    }catch(err){ alert('Error enviando mensaje'); console.error(err); }
  });

  // Groups
  async function loadGroups(){
    try{ const res = await fetch('/api/groups'); const data = await res.json(); renderGroups(data); }catch(e){console.warn(e);} }

  function renderGroups(groups){
    groupsEl.innerHTML = '';
    if (!groups || groups.length===0) { groupsEl.textContent = 'No hay grupos.'; return; }
    groups.forEach(g=>{
      const d = document.createElement('div'); d.className='group'; d.textContent = `${g.name} (${g.members ? g.members.length : 0})`;
      groupsEl.appendChild(d);
    });
  }

  groupForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = new FormData(groupForm).get('name');
    try{
      const res = await fetch('/api/groups', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, state.token ? {'Authorization':'Bearer '+state.token} : {}), body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error('group create failed');
      groupForm.reset();
      loadGroups();
    }catch(err){ alert('Error creando grupo'); console.error(err); }
  });

  // On load: restore token
  (function init(){
    const token = localStorage.getItem('lagun_token');
    if (token) {
      // best-effort: fetch nothing, set token and load data
      setAuth(token, null);
    }
  })();

})();
