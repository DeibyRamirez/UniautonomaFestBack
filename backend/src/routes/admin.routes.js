const express = require('express');
const {
  getPerfilAdmin,
  getAdministradores,
  getEstudiantes,
  getBootstrapAdmin,
  getInscripcionesEventos,
  patchEntregarKit,
  postCrearAdmin,
  postReenviarCorreo,
  postAsignarNumeroCorredor,
  postRegistroManual,
} = require('../controllers/admin.controller');
const { requireAuth } = require('../middlewares/requireAuth');
const { requireAdmin } = require('../middlewares/requireAdmin');
const { requireSuperAdmin } = require('../middlewares/requireSuperAdmin');

const router = express.Router();

router.get('/bootstrap', requireAuth, requireAdmin, getBootstrapAdmin);
router.get('/perfil', requireAuth, requireAdmin, getPerfilAdmin);
router.get('/students', requireAuth, requireAdmin, getEstudiantes);
router.get('/eventos', requireAuth, requireAdmin, getInscripcionesEventos);
router.patch('/students/:id/deliver', requireAuth, requireAdmin, patchEntregarKit);
router.post('/students/:id/reenviar-correo', requireAuth, requireAdmin, postReenviarCorreo);
router.post(
  '/students/:id/asignar-numero',
  requireAuth,
  requireAdmin,
  postAsignarNumeroCorredor
);
router.get('/admins', requireAuth, requireSuperAdmin, getAdministradores);
router.post('/create-admin', requireAuth, requireSuperAdmin, postCrearAdmin);
router.post('/students/registro-manual', requireAuth, requireSuperAdmin, postRegistroManual);

module.exports = router;
