// /api/create-user.js
// Endpoint Vercel — crea usuario en Firebase Auth sin afectar la sesión del admin
// Variable requerida: FIREBASE_SERVICE_ACCOUNT (JSON del service account en Vercel)

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

function initAdmin() {
  if (getApps().length > 0) return;
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  initializeApp({ credential: cert(serviceAccount) });
}

module.exports = async function handler(req, res) {
  // CORS para el dominio de la app
  res.setHeader('Access-Control-Allow-Origin', 'https://hse-esq-app.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    initAdmin();
    const { cedula, action } = req.body;

    if (!cedula || typeof cedula !== 'string' || !/^\d{6,15}$/.test(cedula.trim())) {
      return res.status(400).json({ error: 'Cédula inválida' });
    }

    const c = cedula.trim();
    const email = `${c}@hse.esq`;
    const password = `Esq${c}#`;

    const adminAuth = getAuth();

    // ── ACCIÓN: crear usuario ──────────────────────────────────
    if (!action || action === 'create') {
      try {
        const userRecord = await adminAuth.createUser({
          uid: c,
          email,
          password,
          displayName: c
        });
        return res.status(200).json({
          ok: true,
          uid: userRecord.uid,
          email: userRecord.email,
          passwordInicial: password
        });
      } catch (err) {
        if (err.code === 'auth/email-already-exists' || err.code === 'auth/uid-already-exists') {
          return res.status(200).json({
            ok: true,
            alreadyExists: true,
            email,
            message: 'El usuario ya tiene cuenta en Firebase Auth'
          });
        }
        throw err;
      }
    }

    // ── ACCIÓN: eliminar usuario ───────────────────────────────
    if (action === 'delete') {
      try {
        await adminAuth.deleteUser(c);
        return res.status(200).json({ ok: true, deleted: c });
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          return res.status(200).json({ ok: true, notFound: true });
        }
        throw err;
      }
    }

    return res.status(400).json({ error: 'Acción no reconocida' });

  } catch (err) {
    console.error('create-user error:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
};
