-- =================================================================
--  CORTES DE CAJA: una fila por cada Cierre X y cada Cierre Z.
--  Fila de X: NoCierreX lleno. Fila de Z: NoCierreX NULL y NoCierreZ lleno.
--   CodUser      usuario que generó el corte
--   fecha_hora   momento del corte (lo pone el backend, hora Venezuela)
--   total_ventas X: acumulado del día del CodUser | Z: total del día
--   NoCierreX    número del X (NULL en filas Z)
--   NoCierreZ    número del Z; en las filas X se llena cuando se hace
--                el Z de ese día, así cada X queda ligado a su Z.
--
--  OJO: DROP borra las filas que ya tenga la tabla.
-- =================================================================

DROP TABLE IF EXISTS cortes_caja;

CREATE TABLE cortes_caja (
  idcortes_caja INT(11) NOT NULL AUTO_INCREMENT,
  CodUser INT(11) NULL DEFAULT NULL,
  fecha_hora DATETIME NOT NULL,
  total_ventas DECIMAL(14,2) NOT NULL DEFAULT 0,
  NoCierreX INT(11) NULL DEFAULT NULL,
  NoCierreZ INT(11) NULL DEFAULT NULL,
  PRIMARY KEY (idcortes_caja)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
