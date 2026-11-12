-- =================================================================
--  CIERRES X / Z
--  NoCierre -> NoCierreZ, FechaCierre -> FechaCierreZ
--  y se agregan NoCierreX / FechaCierreX.
--
--  Un ALTER por columna para que corra igual en MariaDB y en TiDB.
--  Solo MariaDB/MySQL con triggers: después de este script volver a ejecutar
--  src/modules/audit/auditoria_legacy_triggers.sql (ya usa los nombres nuevos).
--  TiDB no soporta triggers: ahí basta con este script.
-- =================================================================

ALTER TABLE recibopago CHANGE COLUMN NoCierre NoCierreZ INT(11) NULL DEFAULT NULL;
ALTER TABLE recibopago CHANGE COLUMN FechaCierre FechaCierreZ DATE NULL DEFAULT NULL;
ALTER TABLE recibopago ADD COLUMN NoCierreX INT(11) NULL DEFAULT NULL;
ALTER TABLE recibopago ADD COLUMN FechaCierreX DATETIME NULL DEFAULT NULL;

ALTER TABLE depositos CHANGE COLUMN NoCierre NoCierreZ INT(11) NULL DEFAULT NULL;
ALTER TABLE depositos CHANGE COLUMN FechaCierre FechaCierreZ DATE NULL DEFAULT NULL;
ALTER TABLE depositos ADD COLUMN NoCierreX INT(11) NULL DEFAULT NULL;
ALTER TABLE depositos ADD COLUMN FechaCierreX DATETIME NULL DEFAULT NULL;

ALTER TABLE contratos CHANGE COLUMN NoCierre NoCierreZ INT(11) NULL DEFAULT NULL;
ALTER TABLE contratos CHANGE COLUMN FechaCierre FechaCierreZ DATE NULL DEFAULT NULL;
ALTER TABLE contratos ADD COLUMN NoCierreX INT(11) NULL DEFAULT NULL;
ALTER TABLE contratos ADD COLUMN FechaCierreX DATETIME NULL DEFAULT NULL;

ALTER TABLE cierres CHANGE COLUMN NoCierre NoCierreZ INT(11) NULL DEFAULT NULL;
ALTER TABLE cierres CHANGE COLUMN FechaCierre FechaCierreZ DATE NULL DEFAULT NULL;
ALTER TABLE cierres ADD COLUMN NoCierreX INT(11) NULL DEFAULT NULL;
ALTER TABLE cierres ADD COLUMN FechaCierreX DATETIME NULL DEFAULT NULL;

-- deactosgrados nunca tuvo FechaCierre
ALTER TABLE deactosgrados CHANGE COLUMN NoCierre NoCierreZ INT(11) NULL DEFAULT NULL;
ALTER TABLE deactosgrados ADD COLUMN NoCierreX INT(11) NULL DEFAULT NULL;

-- Correlativos: el X sigue con el NoCierre actual, el Z arranca en 1
ALTER TABLE configuracion CHANGE COLUMN NoCierre NoCierreX INT(11) NULL DEFAULT NULL;
ALTER TABLE configuracion ADD COLUMN NoCierreZ INT(11) NULL DEFAULT 1;
