# LagunApp

Pequeña aplicación para crear y compartir perfiles de personas con gustos similares.

Cómo ejecutar localmente:

1. Instala dependencias: `npm install`
2. Inicia el servidor: `npm start`
3. Abre `http://localhost:3000` en tu navegador

Funcionalidades principales:
- Registro y login con usuario/contraseña (`/api/register`, `/api/login`).
- Al registrarte se crea un perfil con el cuestionario: edad, ubicación, comida favorita, deporte favorito, tiempo libre, música favorita, personalidad, planes favoritos y foto.
- Tras entrar verás la lista de perfiles disponibles.
- Chat en tiempo real: puedes enviar mensajes que se ven por todos los usuarios conectados.
- Grupos: puedes crear grupos (simples) y ver la lista de grupos.

Datos y persistencia:
- Los datos se guardan en `data/` en archivos JSON: `profiles.json`, `users.json`, `messages.json`, `groups.json`.

Despliegue:
- GitHub Pages sólo sirve archivos estáticos. Para mantener el chat en tiempo real y la API necesitas desplegar el servidor Node.js en un hosting que soporte Node (Heroku, Render, Railway, etc.).

Integración con Supabase (opción recomendada)
-------------------------------------------
Se puede migrar el frontend para usar Supabase (Auth, Postgres y Realtime). Ya añadí un ejemplo de configuración en `public/supabaseConfig.example.js`.

Pasos para configurar Supabase:

1. Crea un proyecto en https://app.supabase.com/
2. Ve a Settings → API y copia la URL del proyecto y la ANON KEY.
3. Crea un archivo `public/supabaseConfig.js` con estas dos constantes exportadas:

export const SUPABASE_URL = 'https://xxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'public-anon-key';

4. Crea las tablas en SQL (SQL Editor en Supabase). Ejecuta estas consultas:

-- profiles
create table profiles (
  id uuid default gen_random_uuid() primary key,
  name text,
  age int,
  location text,
  food text,
  sports text,
  hobbies text,
  music text,
  personality text,
  plans text,
  photo text,
  created_at timestamptz default now()
);

-- messages
create table messages (
  id uuid default gen_random_uuid() primary key,
  from text,
  text text,
  created_at timestamptz default now()
);

-- groups
create table groups (
  id uuid default gen_random_uuid() primary key,
  name text,
  members text[],
  created_at timestamptz default now()
);

5. En Auth -> Settings, permite Signups y configura un template de email (si quieres confirmación por email).

6. Prueba la app localmente copiando `public/supabaseConfig.example.js` a `public/supabaseConfig.js` con tus credenciales y abre `http://localhost:3000`.

Notas de seguridad:
- La ANON KEY es para uso cliente y tiene permisos limitados según las políticas RLS que configures. Para operaciones de administración desde un servidor necesitarás la Service Role Key (no la publiques).
- Configura Row Level Security (RLS) en Supabase si quieres controlar el acceso a filas por usuario.
