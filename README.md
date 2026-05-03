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
