function validarCuerpo(validadores) {
  return (req, res, next) => {
    for (const validar of validadores) {
      const error = validar(req.body);
      if (error) {
        return res.status(400).json({ mensaje: error });
      }
    }
    next();
  };
}

module.exports = { validarCuerpo };
