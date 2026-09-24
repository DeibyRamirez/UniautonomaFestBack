const express = require('express');
const {
  getPerfilAdmin,
  getAdministradores,
  getEstudiantes,
  getInscripcionesEventos,
  patchEntregarKit,
  postCrearAdmin,
} = require('../controllers/admin.controller');
const { requireAuth } = require('../middlewares/requireAuth');
const { requireAdmin } = require('../middlewares/requireAdmin');
const { requireSuperAdmin } = require('../middlewares/requireSuperAdmin');

const router = express.Router();

router.get('/perfil', requireAuth, requireAdmin, getPerfilAdmin);
router.get('/students', requireAuth, requireAdmin, getEstudiantes);
router.get('/eventos', requireAuth, requireAdmin, getInscripcionesEventos);
router.patch('/students/:id/deliver', requireAuth, requireAdmin, patchEntregarKit);
router.get('/admins', requireAuth, requireSuperAdmin, getAdministradores);
router.post('/create-admin', requireAuth, requireSuperAdmin, postCrearAdmin);

module.exports = router;
