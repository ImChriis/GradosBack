-- =================================================================
--  SISTEMA DE AUDITORIA - Base de datos: `grados`
--  Generado automaticamente desde el esquema real (2026-10-09T19:26:47)
--  Motor: MariaDB 10.4 / MySQL 5.7+
--
--  Contenido:
--    1) Tabla central: auditoria_general (con CodUser = persona que hizo el cambio)
--    2) Indices sobre la bitacora (idempotentes)
--    3) Triggers AFTER INSERT / UPDATE / DELETE por tabla monitoreada
--
--  NOTA: CodUser toma el valor de la columna CodUser de cada tabla monitoreada.
--        Las tablas bancos, configuracion y metodopago NO tienen CodUser
--        -> ahi CodUser queda NULL y usuario_bd conserva el usuario de BD.
--
--  IMPORTANTE: ejecutar con seleccionada la base `grados`
--  El script es idempotente: puede ejecutarse mas de una vez.
-- =================================================================

DELIMITER $$

-- DROP TABLE IF EXISTS `auditoria_general` $$  -- SOLO si quieres borrar el historial y empezar de cero (opcional, comentado)

CREATE TABLE IF NOT EXISTS `auditoria_general` (
  `id_auditoria` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `tabla_afectada` VARCHAR(100) NOT NULL,
  `accion` ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  `id_registro` INT NULL,
  `CodUser` INT NULL,
  `detalles` TEXT NULL,
  `usuario_bd` VARCHAR(100) NULL,
  `fecha_hora` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_aud_fecha` (`fecha_hora`),
  KEY `idx_aud_tabla` (`tabla_afectada`, `id_registro`),
  KEY `idx_aud_accion` (`accion`)
) ENGINE = InnoDB $$

-- Upgrade idempotente: agrega la columna CodUser si no existe
-- (si vienes de una version anterior que tenia "cod_user", ejecuta primero:
--  ALTER TABLE `auditoria_general` CHANGE COLUMN `cod_user` `CodUser` INT NULL; )
ALTER TABLE `auditoria_general` ADD COLUMN IF NOT EXISTS `CodUser` INT NULL AFTER `id_registro` $$

-- =================================================================
--  TRIGGERS
-- =================================================================

-- -----------------------------------------------------------------
-- TABLA: actosgrados  |  LLAVE: id  |  12 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_actosgrados_insert` $$
CREATE TRIGGER `trg_audit_actosgrados_insert`
AFTER INSERT ON `actosgrados`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'actosgrados',
        'INSERT',
        NEW.`id`,
        NEW.`CodUser`,
        JSON_OBJECT('id', NEW.`id`, 'CodigoActo', NEW.`CodigoActo`, 'Fecha', NEW.`Fecha`, 'Hora', NEW.`Hora`, 'CodigoInst', NEW.`CodigoInst`, 'siglas', NEW.`siglas`, 'titulo', NEW.`titulo`, 'CoLugar', NEW.`CoLugar`, 'MnCosto', NEW.`MnCosto`, 'especialidad', NEW.`especialidad`, 'CodUser', NEW.`CodUser`, 'Culminada', NEW.`Culminada`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_actosgrados_update` $$
CREATE TRIGGER `trg_audit_actosgrados_update`
AFTER UPDATE ON `actosgrados`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`id` <=> OLD.`id`, '', CONCAT('id: ', IFNULL(CAST(OLD.`id` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`id` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodigoActo` <=> OLD.`CodigoActo`, '', CONCAT('CodigoActo: ', IFNULL(CAST(OLD.`CodigoActo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodigoActo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Fecha` <=> OLD.`Fecha`, '', CONCAT('Fecha: ', IFNULL(CAST(OLD.`Fecha` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Fecha` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Hora` <=> OLD.`Hora`, '', CONCAT('Hora: ', IFNULL(CAST(OLD.`Hora` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Hora` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodigoInst` <=> OLD.`CodigoInst`, '', CONCAT('CodigoInst: ', IFNULL(CAST(OLD.`CodigoInst` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodigoInst` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`siglas` <=> OLD.`siglas`, '', CONCAT('siglas: ', IFNULL(CAST(OLD.`siglas` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`siglas` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`titulo` <=> OLD.`titulo`, '', CONCAT('titulo: ', IFNULL(CAST(OLD.`titulo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`titulo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CoLugar` <=> OLD.`CoLugar`, '', CONCAT('CoLugar: ', IFNULL(CAST(OLD.`CoLugar` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CoLugar` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnCosto` <=> OLD.`MnCosto`, '', CONCAT('MnCosto: ', IFNULL(CAST(OLD.`MnCosto` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnCosto` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`especialidad` <=> OLD.`especialidad`, '', CONCAT('especialidad: ', IFNULL(CAST(OLD.`especialidad` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`especialidad` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodUser` <=> OLD.`CodUser`, '', CONCAT('CodUser: ', IFNULL(CAST(OLD.`CodUser` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodUser` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Culminada` <=> OLD.`Culminada`, '', CONCAT('Culminada: ', IFNULL(CAST(OLD.`Culminada` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Culminada` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'actosgrados',
            'UPDATE',
            NEW.`id`,
            NEW.`CodUser`,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_actosgrados_delete` $$
CREATE TRIGGER `trg_audit_actosgrados_delete`
AFTER DELETE ON `actosgrados`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'actosgrados',
        'DELETE',
        OLD.`id`,
        OLD.`CodUser`,
        JSON_OBJECT('id', OLD.`id`, 'CodigoActo', OLD.`CodigoActo`, 'Fecha', OLD.`Fecha`, 'Hora', OLD.`Hora`, 'CodigoInst', OLD.`CodigoInst`, 'siglas', OLD.`siglas`, 'titulo', OLD.`titulo`, 'CoLugar', OLD.`CoLugar`, 'MnCosto', OLD.`MnCosto`, 'especialidad', OLD.`especialidad`, 'CodUser', OLD.`CodUser`, 'Culminada', OLD.`Culminada`),
        USER()
    );
END $$

-- -----------------------------------------------------------------
-- TABLA: deactosgrados  |  LLAVE: id  |  17 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_deactosgrados_insert` $$
CREATE TRIGGER `trg_audit_deactosgrados_insert`
AFTER INSERT ON `deactosgrados`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'deactosgrados',
        'INSERT',
        NEW.`id`,
        NEW.`CodUser`,
        JSON_OBJECT('id', NEW.`id`, 'CodigoActo', NEW.`CodigoActo`, 'NoContrato', NEW.`NoContrato`, 'NuCedula', NEW.`NuCedula`, 'Nombre', NEW.`Nombre`, 'Txcontacto', NEW.`Txcontacto`, 'MnContrato', NEW.`MnContrato`, 'MnDescuento', NEW.`MnDescuento`, 'MnPagado', NEW.`MnPagado`, 'MnSaldo', NEW.`MnSaldo`, 'MnInicial', NEW.`MnInicial`, 'MaEdoCont', NEW.`MaEdoCont`, 'CodUser', NEW.`CodUser`, 'chemise', NEW.`chemise`, 'fecha', NEW.`fecha`, 'CodSucursal', NEW.`CodSucursal`, 'NoCierre', NEW.`NoCierre`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_deactosgrados_update` $$
CREATE TRIGGER `trg_audit_deactosgrados_update`
AFTER UPDATE ON `deactosgrados`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`id` <=> OLD.`id`, '', CONCAT('id: ', IFNULL(CAST(OLD.`id` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`id` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodigoActo` <=> OLD.`CodigoActo`, '', CONCAT('CodigoActo: ', IFNULL(CAST(OLD.`CodigoActo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodigoActo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoContrato` <=> OLD.`NoContrato`, '', CONCAT('NoContrato: ', IFNULL(CAST(OLD.`NoContrato` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoContrato` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NuCedula` <=> OLD.`NuCedula`, '', CONCAT('NuCedula: ', IFNULL(CAST(OLD.`NuCedula` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NuCedula` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Nombre` <=> OLD.`Nombre`, '', CONCAT('Nombre: ', IFNULL(CAST(OLD.`Nombre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Nombre` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Txcontacto` <=> OLD.`Txcontacto`, '', CONCAT('Txcontacto: ', IFNULL(CAST(OLD.`Txcontacto` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Txcontacto` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnContrato` <=> OLD.`MnContrato`, '', CONCAT('MnContrato: ', IFNULL(CAST(OLD.`MnContrato` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnContrato` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnDescuento` <=> OLD.`MnDescuento`, '', CONCAT('MnDescuento: ', IFNULL(CAST(OLD.`MnDescuento` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnDescuento` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnPagado` <=> OLD.`MnPagado`, '', CONCAT('MnPagado: ', IFNULL(CAST(OLD.`MnPagado` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnPagado` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnSaldo` <=> OLD.`MnSaldo`, '', CONCAT('MnSaldo: ', IFNULL(CAST(OLD.`MnSaldo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnSaldo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnInicial` <=> OLD.`MnInicial`, '', CONCAT('MnInicial: ', IFNULL(CAST(OLD.`MnInicial` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnInicial` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MaEdoCont` <=> OLD.`MaEdoCont`, '', CONCAT('MaEdoCont: ', IFNULL(CAST(OLD.`MaEdoCont` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MaEdoCont` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodUser` <=> OLD.`CodUser`, '', CONCAT('CodUser: ', IFNULL(CAST(OLD.`CodUser` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodUser` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`chemise` <=> OLD.`chemise`, '', CONCAT('chemise: ', IFNULL(CAST(OLD.`chemise` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`chemise` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`fecha` <=> OLD.`fecha`, '', CONCAT('fecha: ', IFNULL(CAST(OLD.`fecha` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`fecha` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodSucursal` <=> OLD.`CodSucursal`, '', CONCAT('CodSucursal: ', IFNULL(CAST(OLD.`CodSucursal` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodSucursal` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoCierre` <=> OLD.`NoCierre`, '', CONCAT('NoCierre: ', IFNULL(CAST(OLD.`NoCierre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoCierre` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'deactosgrados',
            'UPDATE',
            NEW.`id`,
            NEW.`CodUser`,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_deactosgrados_delete` $$
CREATE TRIGGER `trg_audit_deactosgrados_delete`
AFTER DELETE ON `deactosgrados`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'deactosgrados',
        'DELETE',
        OLD.`id`,
        OLD.`CodUser`,
        JSON_OBJECT('id', OLD.`id`, 'CodigoActo', OLD.`CodigoActo`, 'NoContrato', OLD.`NoContrato`, 'NuCedula', OLD.`NuCedula`, 'Nombre', OLD.`Nombre`, 'Txcontacto', OLD.`Txcontacto`, 'MnContrato', OLD.`MnContrato`, 'MnDescuento', OLD.`MnDescuento`, 'MnPagado', OLD.`MnPagado`, 'MnSaldo', OLD.`MnSaldo`, 'MnInicial', OLD.`MnInicial`, 'MaEdoCont', OLD.`MaEdoCont`, 'CodUser', OLD.`CodUser`, 'chemise', OLD.`chemise`, 'fecha', OLD.`fecha`, 'CodSucursal', OLD.`CodSucursal`, 'NoCierre', OLD.`NoCierre`),
        USER()
    );
END $$

-- -----------------------------------------------------------------
-- TABLA: recibopago  |  LLAVE: id  |  25 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_recibopago_insert` $$
CREATE TRIGGER `trg_audit_recibopago_insert`
AFTER INSERT ON `recibopago`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'recibopago',
        'INSERT',
        NEW.`id`,
        NEW.`CodUser`,
        JSON_OBJECT('id', NEW.`id`, 'Tipo', NEW.`Tipo`, 'NoRecibo', NEW.`NoRecibo`, 'FeRecibo', NEW.`FeRecibo`, 'NuCedula', NEW.`NuCedula`, 'CodigoActo', NEW.`CodigoActo`, 'NoContrato', NEW.`NoContrato`, 'TpRecibo', NEW.`TpRecibo`, 'MnRecibo', NEW.`MnRecibo`, 'MnSaldoRec', NEW.`MnSaldoRec`, 'TxConcepRec', NEW.`TxConcepRec`, 'MaFormPag', NEW.`MaFormPag`, 'TxBanco', NEW.`TxBanco`, 'NuRefDocBan', NEW.`NuRefDocBan`, 'Anulado', NEW.`Anulado`, 'MnRecEfect', NEW.`MnRecEfect`, 'MnRecTarDeb', NEW.`MnRecTarDeb`, 'MnRecTarCre', NEW.`MnRecTarCre`, 'MnRecDep', NEW.`MnRecDep`, 'MnRecChep', NEW.`MnRecChep`, 'MnRecOtro', NEW.`MnRecOtro`, 'CodUser', NEW.`CodUser`, 'CodSucursal', NEW.`CodSucursal`, 'NoCierre', NEW.`NoCierre`, 'FechaCierre', NEW.`FechaCierre`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_recibopago_update` $$
CREATE TRIGGER `trg_audit_recibopago_update`
AFTER UPDATE ON `recibopago`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`id` <=> OLD.`id`, '', CONCAT('id: ', IFNULL(CAST(OLD.`id` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`id` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Tipo` <=> OLD.`Tipo`, '', CONCAT('Tipo: ', IFNULL(CAST(OLD.`Tipo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Tipo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoRecibo` <=> OLD.`NoRecibo`, '', CONCAT('NoRecibo: ', IFNULL(CAST(OLD.`NoRecibo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoRecibo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`FeRecibo` <=> OLD.`FeRecibo`, '', CONCAT('FeRecibo: ', IFNULL(CAST(OLD.`FeRecibo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`FeRecibo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NuCedula` <=> OLD.`NuCedula`, '', CONCAT('NuCedula: ', IFNULL(CAST(OLD.`NuCedula` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NuCedula` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodigoActo` <=> OLD.`CodigoActo`, '', CONCAT('CodigoActo: ', IFNULL(CAST(OLD.`CodigoActo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodigoActo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoContrato` <=> OLD.`NoContrato`, '', CONCAT('NoContrato: ', IFNULL(CAST(OLD.`NoContrato` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoContrato` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TpRecibo` <=> OLD.`TpRecibo`, '', CONCAT('TpRecibo: ', IFNULL(CAST(OLD.`TpRecibo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TpRecibo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnRecibo` <=> OLD.`MnRecibo`, '', CONCAT('MnRecibo: ', IFNULL(CAST(OLD.`MnRecibo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnRecibo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnSaldoRec` <=> OLD.`MnSaldoRec`, '', CONCAT('MnSaldoRec: ', IFNULL(CAST(OLD.`MnSaldoRec` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnSaldoRec` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TxConcepRec` <=> OLD.`TxConcepRec`, '', CONCAT('TxConcepRec: ', IFNULL(CAST(OLD.`TxConcepRec` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TxConcepRec` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MaFormPag` <=> OLD.`MaFormPag`, '', CONCAT('MaFormPag: ', IFNULL(CAST(OLD.`MaFormPag` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MaFormPag` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TxBanco` <=> OLD.`TxBanco`, '', CONCAT('TxBanco: ', IFNULL(CAST(OLD.`TxBanco` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TxBanco` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NuRefDocBan` <=> OLD.`NuRefDocBan`, '', CONCAT('NuRefDocBan: ', IFNULL(CAST(OLD.`NuRefDocBan` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NuRefDocBan` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Anulado` <=> OLD.`Anulado`, '', CONCAT('Anulado: ', IFNULL(CAST(OLD.`Anulado` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Anulado` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnRecEfect` <=> OLD.`MnRecEfect`, '', CONCAT('MnRecEfect: ', IFNULL(CAST(OLD.`MnRecEfect` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnRecEfect` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnRecTarDeb` <=> OLD.`MnRecTarDeb`, '', CONCAT('MnRecTarDeb: ', IFNULL(CAST(OLD.`MnRecTarDeb` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnRecTarDeb` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnRecTarCre` <=> OLD.`MnRecTarCre`, '', CONCAT('MnRecTarCre: ', IFNULL(CAST(OLD.`MnRecTarCre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnRecTarCre` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnRecDep` <=> OLD.`MnRecDep`, '', CONCAT('MnRecDep: ', IFNULL(CAST(OLD.`MnRecDep` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnRecDep` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnRecChep` <=> OLD.`MnRecChep`, '', CONCAT('MnRecChep: ', IFNULL(CAST(OLD.`MnRecChep` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnRecChep` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnRecOtro` <=> OLD.`MnRecOtro`, '', CONCAT('MnRecOtro: ', IFNULL(CAST(OLD.`MnRecOtro` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnRecOtro` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodUser` <=> OLD.`CodUser`, '', CONCAT('CodUser: ', IFNULL(CAST(OLD.`CodUser` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodUser` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodSucursal` <=> OLD.`CodSucursal`, '', CONCAT('CodSucursal: ', IFNULL(CAST(OLD.`CodSucursal` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodSucursal` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoCierre` <=> OLD.`NoCierre`, '', CONCAT('NoCierre: ', IFNULL(CAST(OLD.`NoCierre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoCierre` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`FechaCierre` <=> OLD.`FechaCierre`, '', CONCAT('FechaCierre: ', IFNULL(CAST(OLD.`FechaCierre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`FechaCierre` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'recibopago',
            'UPDATE',
            NEW.`id`,
            NEW.`CodUser`,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_recibopago_delete` $$
CREATE TRIGGER `trg_audit_recibopago_delete`
AFTER DELETE ON `recibopago`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'recibopago',
        'DELETE',
        OLD.`id`,
        OLD.`CodUser`,
        JSON_OBJECT('id', OLD.`id`, 'Tipo', OLD.`Tipo`, 'NoRecibo', OLD.`NoRecibo`, 'FeRecibo', OLD.`FeRecibo`, 'NuCedula', OLD.`NuCedula`, 'CodigoActo', OLD.`CodigoActo`, 'NoContrato', OLD.`NoContrato`, 'TpRecibo', OLD.`TpRecibo`, 'MnRecibo', OLD.`MnRecibo`, 'MnSaldoRec', OLD.`MnSaldoRec`, 'TxConcepRec', OLD.`TxConcepRec`, 'MaFormPag', OLD.`MaFormPag`, 'TxBanco', OLD.`TxBanco`, 'NuRefDocBan', OLD.`NuRefDocBan`, 'Anulado', OLD.`Anulado`, 'MnRecEfect', OLD.`MnRecEfect`, 'MnRecTarDeb', OLD.`MnRecTarDeb`, 'MnRecTarCre', OLD.`MnRecTarCre`, 'MnRecDep', OLD.`MnRecDep`, 'MnRecChep', OLD.`MnRecChep`, 'MnRecOtro', OLD.`MnRecOtro`, 'CodUser', OLD.`CodUser`, 'CodSucursal', OLD.`CodSucursal`, 'NoCierre', OLD.`NoCierre`, 'FechaCierre', OLD.`FechaCierre`),
        USER()
    );
END $$

-- -----------------------------------------------------------------
-- TABLA: depositos  |  LLAVE: id  |  13 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_depositos_insert` $$
CREATE TRIGGER `trg_audit_depositos_insert`
AFTER INSERT ON `depositos`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'depositos',
        'INSERT',
        NEW.`id`,
        NEW.`CodUser`,
        JSON_OBJECT('id', NEW.`id`, 'NoContrato', NEW.`NoContrato`, 'NuCedula', NEW.`NuCedula`, 'NoRecibo', NEW.`NoRecibo`, 'Fecha', NEW.`Fecha`, 'TipoOperacion', NEW.`TipoOperacion`, 'TxBanco', NEW.`TxBanco`, 'NuDeposito', NEW.`NuDeposito`, 'MnDeposito', NEW.`MnDeposito`, 'CodUser', NEW.`CodUser`, 'CodSucursal', NEW.`CodSucursal`, 'NoCierre', NEW.`NoCierre`, 'FechaCierre', NEW.`FechaCierre`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_depositos_update` $$
CREATE TRIGGER `trg_audit_depositos_update`
AFTER UPDATE ON `depositos`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`id` <=> OLD.`id`, '', CONCAT('id: ', IFNULL(CAST(OLD.`id` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`id` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoContrato` <=> OLD.`NoContrato`, '', CONCAT('NoContrato: ', IFNULL(CAST(OLD.`NoContrato` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoContrato` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NuCedula` <=> OLD.`NuCedula`, '', CONCAT('NuCedula: ', IFNULL(CAST(OLD.`NuCedula` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NuCedula` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoRecibo` <=> OLD.`NoRecibo`, '', CONCAT('NoRecibo: ', IFNULL(CAST(OLD.`NoRecibo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoRecibo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Fecha` <=> OLD.`Fecha`, '', CONCAT('Fecha: ', IFNULL(CAST(OLD.`Fecha` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Fecha` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TipoOperacion` <=> OLD.`TipoOperacion`, '', CONCAT('TipoOperacion: ', IFNULL(CAST(OLD.`TipoOperacion` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TipoOperacion` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TxBanco` <=> OLD.`TxBanco`, '', CONCAT('TxBanco: ', IFNULL(CAST(OLD.`TxBanco` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TxBanco` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NuDeposito` <=> OLD.`NuDeposito`, '', CONCAT('NuDeposito: ', IFNULL(CAST(OLD.`NuDeposito` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NuDeposito` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnDeposito` <=> OLD.`MnDeposito`, '', CONCAT('MnDeposito: ', IFNULL(CAST(OLD.`MnDeposito` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnDeposito` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodUser` <=> OLD.`CodUser`, '', CONCAT('CodUser: ', IFNULL(CAST(OLD.`CodUser` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodUser` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodSucursal` <=> OLD.`CodSucursal`, '', CONCAT('CodSucursal: ', IFNULL(CAST(OLD.`CodSucursal` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodSucursal` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoCierre` <=> OLD.`NoCierre`, '', CONCAT('NoCierre: ', IFNULL(CAST(OLD.`NoCierre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoCierre` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`FechaCierre` <=> OLD.`FechaCierre`, '', CONCAT('FechaCierre: ', IFNULL(CAST(OLD.`FechaCierre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`FechaCierre` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'depositos',
            'UPDATE',
            NEW.`id`,
            NEW.`CodUser`,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_depositos_delete` $$
CREATE TRIGGER `trg_audit_depositos_delete`
AFTER DELETE ON `depositos`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'depositos',
        'DELETE',
        OLD.`id`,
        OLD.`CodUser`,
        JSON_OBJECT('id', OLD.`id`, 'NoContrato', OLD.`NoContrato`, 'NuCedula', OLD.`NuCedula`, 'NoRecibo', OLD.`NoRecibo`, 'Fecha', OLD.`Fecha`, 'TipoOperacion', OLD.`TipoOperacion`, 'TxBanco', OLD.`TxBanco`, 'NuDeposito', OLD.`NuDeposito`, 'MnDeposito', OLD.`MnDeposito`, 'CodUser', OLD.`CodUser`, 'CodSucursal', OLD.`CodSucursal`, 'NoCierre', OLD.`NoCierre`, 'FechaCierre', OLD.`FechaCierre`),
        USER()
    );
END $$

-- -----------------------------------------------------------------
-- TABLA: clientes  |  LLAVE: id  |  9 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_clientes_insert` $$
CREATE TRIGGER `trg_audit_clientes_insert`
AFTER INSERT ON `clientes`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'clientes',
        'INSERT',
        NEW.`id`,
        NEW.`CodUser`,
        JSON_OBJECT('id', NEW.`id`, 'nucedula', NEW.`nucedula`, 'txnombre', NEW.`txnombre`, 'txdireccion', NEW.`txdireccion`, 'txtelefono', NEW.`txtelefono`, 'txcelular', NEW.`txcelular`, 'txemail', NEW.`txemail`, 'feingreso', NEW.`feingreso`, 'CodUser', NEW.`CodUser`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_clientes_update` $$
CREATE TRIGGER `trg_audit_clientes_update`
AFTER UPDATE ON `clientes`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`id` <=> OLD.`id`, '', CONCAT('id: ', IFNULL(CAST(OLD.`id` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`id` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`nucedula` <=> OLD.`nucedula`, '', CONCAT('nucedula: ', IFNULL(CAST(OLD.`nucedula` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`nucedula` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`txnombre` <=> OLD.`txnombre`, '', CONCAT('txnombre: ', IFNULL(CAST(OLD.`txnombre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`txnombre` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`txdireccion` <=> OLD.`txdireccion`, '', CONCAT('txdireccion: ', IFNULL(CAST(OLD.`txdireccion` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`txdireccion` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`txtelefono` <=> OLD.`txtelefono`, '', CONCAT('txtelefono: ', IFNULL(CAST(OLD.`txtelefono` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`txtelefono` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`txcelular` <=> OLD.`txcelular`, '', CONCAT('txcelular: ', IFNULL(CAST(OLD.`txcelular` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`txcelular` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`txemail` <=> OLD.`txemail`, '', CONCAT('txemail: ', IFNULL(CAST(OLD.`txemail` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`txemail` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`feingreso` <=> OLD.`feingreso`, '', CONCAT('feingreso: ', IFNULL(CAST(OLD.`feingreso` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`feingreso` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodUser` <=> OLD.`CodUser`, '', CONCAT('CodUser: ', IFNULL(CAST(OLD.`CodUser` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodUser` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'clientes',
            'UPDATE',
            NEW.`id`,
            NEW.`CodUser`,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_clientes_delete` $$
CREATE TRIGGER `trg_audit_clientes_delete`
AFTER DELETE ON `clientes`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'clientes',
        'DELETE',
        OLD.`id`,
        OLD.`CodUser`,
        JSON_OBJECT('id', OLD.`id`, 'nucedula', OLD.`nucedula`, 'txnombre', OLD.`txnombre`, 'txdireccion', OLD.`txdireccion`, 'txtelefono', OLD.`txtelefono`, 'txcelular', OLD.`txcelular`, 'txemail', OLD.`txemail`, 'feingreso', OLD.`feingreso`, 'CodUser', OLD.`CodUser`),
        USER()
    );
END $$

-- -----------------------------------------------------------------
-- TABLA: bancos  |  LLAVE: id  |  4 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_bancos_insert` $$
CREATE TRIGGER `trg_audit_bancos_insert`
AFTER INSERT ON `bancos`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'bancos',
        'INSERT',
        NEW.`id`,
        NULL,
        JSON_OBJECT('id', NEW.`id`, 'bancos', NEW.`bancos`, 'codigo', NEW.`codigo`, 'status', NEW.`status`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_bancos_update` $$
CREATE TRIGGER `trg_audit_bancos_update`
AFTER UPDATE ON `bancos`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`id` <=> OLD.`id`, '', CONCAT('id: ', IFNULL(CAST(OLD.`id` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`id` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`bancos` <=> OLD.`bancos`, '', CONCAT('bancos: ', IFNULL(CAST(OLD.`bancos` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`bancos` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`codigo` <=> OLD.`codigo`, '', CONCAT('codigo: ', IFNULL(CAST(OLD.`codigo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`codigo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`status` <=> OLD.`status`, '', CONCAT('status: ', IFNULL(CAST(OLD.`status` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`status` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'bancos',
            'UPDATE',
            NEW.`id`,
            NULL,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_bancos_delete` $$
CREATE TRIGGER `trg_audit_bancos_delete`
AFTER DELETE ON `bancos`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'bancos',
        'DELETE',
        OLD.`id`,
        NULL,
        JSON_OBJECT('id', OLD.`id`, 'bancos', OLD.`bancos`, 'codigo', OLD.`codigo`, 'status', OLD.`status`),
        USER()
    );
END $$

-- -----------------------------------------------------------------
-- TABLA: configuracion  |  LLAVE: Id  |  34 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_configuracion_insert` $$
CREATE TRIGGER `trg_audit_configuracion_insert`
AFTER INSERT ON `configuracion`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'configuracion',
        'INSERT',
        NEW.`Id`,
        NULL,
        JSON_OBJECT('Id', NEW.`Id`, 'CoSucursal', NEW.`CoSucursal`, 'NbSucursal', NEW.`NbSucursal`, 'Producto', NEW.`Producto`, 'Nombre', NEW.`Nombre`, 'Rif', NEW.`Rif`, 'Direccion', NEW.`Direccion`, 'Telefono', NEW.`Telefono`, 'Fax', NEW.`Fax`, 'feregistro', NEW.`feregistro`, 'txclaveadm', '***', 'NoRecibo', NEW.`NoRecibo`, 'NoContrato', NEW.`NoContrato`, 'NoActo', NEW.`NoActo`, 'CaDiasFab', NEW.`CaDiasFab`, 'CaDiasEngaste', NEW.`CaDiasEngaste`, 'MaFormRec', NEW.`MaFormRec`, 'PcOro18', NEW.`PcOro18`, 'PcOro14', NEW.`PcOro14`, 'PcOro10', NEW.`PcOro10`, 'MnMerma', NEW.`MnMerma`, 'MnCostOro', NEW.`MnCostOro`, 'Impuesto', NEW.`Impuesto`, 'MnCostoMano', NEW.`MnCostoMano`, 'UbicacionLogo', NEW.`UbicacionLogo`, 'UbicacionRpt', NEW.`UbicacionRpt`, 'TxMensaje1', NEW.`TxMensaje1`, 'TxMensaje2', NEW.`TxMensaje2`, 'TxMensaje3', NEW.`TxMensaje3`, 'GeneraNoRecibo', NEW.`GeneraNoRecibo`, 'GeneraNoContrato', NEW.`GeneraNoContrato`, 'GeneraNoActo', NEW.`GeneraNoActo`, 'GeneraNoCierre', NEW.`GeneraNoCierre`, 'NoCierre', NEW.`NoCierre`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_configuracion_update` $$
CREATE TRIGGER `trg_audit_configuracion_update`
AFTER UPDATE ON `configuracion`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`Id` <=> OLD.`Id`, '', CONCAT('Id: ', IFNULL(CAST(OLD.`Id` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Id` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CoSucursal` <=> OLD.`CoSucursal`, '', CONCAT('CoSucursal: ', IFNULL(CAST(OLD.`CoSucursal` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CoSucursal` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NbSucursal` <=> OLD.`NbSucursal`, '', CONCAT('NbSucursal: ', IFNULL(CAST(OLD.`NbSucursal` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NbSucursal` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Producto` <=> OLD.`Producto`, '', CONCAT('Producto: ', IFNULL(CAST(OLD.`Producto` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Producto` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Nombre` <=> OLD.`Nombre`, '', CONCAT('Nombre: ', IFNULL(CAST(OLD.`Nombre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Nombre` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Rif` <=> OLD.`Rif`, '', CONCAT('Rif: ', IFNULL(CAST(OLD.`Rif` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Rif` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Direccion` <=> OLD.`Direccion`, '', CONCAT('Direccion: ', IFNULL(CAST(OLD.`Direccion` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Direccion` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Telefono` <=> OLD.`Telefono`, '', CONCAT('Telefono: ', IFNULL(CAST(OLD.`Telefono` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Telefono` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Fax` <=> OLD.`Fax`, '', CONCAT('Fax: ', IFNULL(CAST(OLD.`Fax` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Fax` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`feregistro` <=> OLD.`feregistro`, '', CONCAT('feregistro: ', IFNULL(CAST(OLD.`feregistro` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`feregistro` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`txclaveadm` <=> OLD.`txclaveadm`, '', 'txclaveadm: (valor oculto); '),
            IF(NEW.`NoRecibo` <=> OLD.`NoRecibo`, '', CONCAT('NoRecibo: ', IFNULL(CAST(OLD.`NoRecibo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoRecibo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoContrato` <=> OLD.`NoContrato`, '', CONCAT('NoContrato: ', IFNULL(CAST(OLD.`NoContrato` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoContrato` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoActo` <=> OLD.`NoActo`, '', CONCAT('NoActo: ', IFNULL(CAST(OLD.`NoActo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoActo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CaDiasFab` <=> OLD.`CaDiasFab`, '', CONCAT('CaDiasFab: ', IFNULL(CAST(OLD.`CaDiasFab` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CaDiasFab` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CaDiasEngaste` <=> OLD.`CaDiasEngaste`, '', CONCAT('CaDiasEngaste: ', IFNULL(CAST(OLD.`CaDiasEngaste` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CaDiasEngaste` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MaFormRec` <=> OLD.`MaFormRec`, '', CONCAT('MaFormRec: ', IFNULL(CAST(OLD.`MaFormRec` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MaFormRec` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`PcOro18` <=> OLD.`PcOro18`, '', CONCAT('PcOro18: ', IFNULL(CAST(OLD.`PcOro18` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`PcOro18` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`PcOro14` <=> OLD.`PcOro14`, '', CONCAT('PcOro14: ', IFNULL(CAST(OLD.`PcOro14` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`PcOro14` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`PcOro10` <=> OLD.`PcOro10`, '', CONCAT('PcOro10: ', IFNULL(CAST(OLD.`PcOro10` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`PcOro10` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnMerma` <=> OLD.`MnMerma`, '', CONCAT('MnMerma: ', IFNULL(CAST(OLD.`MnMerma` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnMerma` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnCostOro` <=> OLD.`MnCostOro`, '', CONCAT('MnCostOro: ', IFNULL(CAST(OLD.`MnCostOro` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnCostOro` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Impuesto` <=> OLD.`Impuesto`, '', CONCAT('Impuesto: ', IFNULL(CAST(OLD.`Impuesto` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Impuesto` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnCostoMano` <=> OLD.`MnCostoMano`, '', CONCAT('MnCostoMano: ', IFNULL(CAST(OLD.`MnCostoMano` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnCostoMano` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`UbicacionLogo` <=> OLD.`UbicacionLogo`, '', CONCAT('UbicacionLogo: ', IFNULL(CAST(OLD.`UbicacionLogo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`UbicacionLogo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`UbicacionRpt` <=> OLD.`UbicacionRpt`, '', CONCAT('UbicacionRpt: ', IFNULL(CAST(OLD.`UbicacionRpt` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`UbicacionRpt` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TxMensaje1` <=> OLD.`TxMensaje1`, '', CONCAT('TxMensaje1: ', IFNULL(CAST(OLD.`TxMensaje1` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TxMensaje1` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TxMensaje2` <=> OLD.`TxMensaje2`, '', CONCAT('TxMensaje2: ', IFNULL(CAST(OLD.`TxMensaje2` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TxMensaje2` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TxMensaje3` <=> OLD.`TxMensaje3`, '', CONCAT('TxMensaje3: ', IFNULL(CAST(OLD.`TxMensaje3` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TxMensaje3` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`GeneraNoRecibo` <=> OLD.`GeneraNoRecibo`, '', CONCAT('GeneraNoRecibo: ', IFNULL(CAST(OLD.`GeneraNoRecibo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`GeneraNoRecibo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`GeneraNoContrato` <=> OLD.`GeneraNoContrato`, '', CONCAT('GeneraNoContrato: ', IFNULL(CAST(OLD.`GeneraNoContrato` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`GeneraNoContrato` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`GeneraNoActo` <=> OLD.`GeneraNoActo`, '', CONCAT('GeneraNoActo: ', IFNULL(CAST(OLD.`GeneraNoActo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`GeneraNoActo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`GeneraNoCierre` <=> OLD.`GeneraNoCierre`, '', CONCAT('GeneraNoCierre: ', IFNULL(CAST(OLD.`GeneraNoCierre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`GeneraNoCierre` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoCierre` <=> OLD.`NoCierre`, '', CONCAT('NoCierre: ', IFNULL(CAST(OLD.`NoCierre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoCierre` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'configuracion',
            'UPDATE',
            NEW.`Id`,
            NULL,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_configuracion_delete` $$
CREATE TRIGGER `trg_audit_configuracion_delete`
AFTER DELETE ON `configuracion`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'configuracion',
        'DELETE',
        OLD.`Id`,
        NULL,
        JSON_OBJECT('Id', OLD.`Id`, 'CoSucursal', OLD.`CoSucursal`, 'NbSucursal', OLD.`NbSucursal`, 'Producto', OLD.`Producto`, 'Nombre', OLD.`Nombre`, 'Rif', OLD.`Rif`, 'Direccion', OLD.`Direccion`, 'Telefono', OLD.`Telefono`, 'Fax', OLD.`Fax`, 'feregistro', OLD.`feregistro`, 'txclaveadm', '***', 'NoRecibo', OLD.`NoRecibo`, 'NoContrato', OLD.`NoContrato`, 'NoActo', OLD.`NoActo`, 'CaDiasFab', OLD.`CaDiasFab`, 'CaDiasEngaste', OLD.`CaDiasEngaste`, 'MaFormRec', OLD.`MaFormRec`, 'PcOro18', OLD.`PcOro18`, 'PcOro14', OLD.`PcOro14`, 'PcOro10', OLD.`PcOro10`, 'MnMerma', OLD.`MnMerma`, 'MnCostOro', OLD.`MnCostOro`, 'Impuesto', OLD.`Impuesto`, 'MnCostoMano', OLD.`MnCostoMano`, 'UbicacionLogo', OLD.`UbicacionLogo`, 'UbicacionRpt', OLD.`UbicacionRpt`, 'TxMensaje1', OLD.`TxMensaje1`, 'TxMensaje2', OLD.`TxMensaje2`, 'TxMensaje3', OLD.`TxMensaje3`, 'GeneraNoRecibo', OLD.`GeneraNoRecibo`, 'GeneraNoContrato', OLD.`GeneraNoContrato`, 'GeneraNoActo', OLD.`GeneraNoActo`, 'GeneraNoCierre', OLD.`GeneraNoCierre`, 'NoCierre', OLD.`NoCierre`),
        USER()
    );
END $$

-- -----------------------------------------------------------------
-- TABLA: especialidad  |  LLAVE: CodigoEsp  |  4 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_especialidad_insert` $$
CREATE TRIGGER `trg_audit_especialidad_insert`
AFTER INSERT ON `especialidad`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'especialidad',
        'INSERT',
        NEW.`CodigoEsp`,
        NEW.`CodUser`,
        JSON_OBJECT('CodigoEsp', NEW.`CodigoEsp`, 'Titulo', NEW.`Titulo`, 'Especialidad', NEW.`Especialidad`, 'CodUser', NEW.`CodUser`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_especialidad_update` $$
CREATE TRIGGER `trg_audit_especialidad_update`
AFTER UPDATE ON `especialidad`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`CodigoEsp` <=> OLD.`CodigoEsp`, '', CONCAT('CodigoEsp: ', IFNULL(CAST(OLD.`CodigoEsp` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodigoEsp` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Titulo` <=> OLD.`Titulo`, '', CONCAT('Titulo: ', IFNULL(CAST(OLD.`Titulo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Titulo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Especialidad` <=> OLD.`Especialidad`, '', CONCAT('Especialidad: ', IFNULL(CAST(OLD.`Especialidad` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Especialidad` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodUser` <=> OLD.`CodUser`, '', CONCAT('CodUser: ', IFNULL(CAST(OLD.`CodUser` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodUser` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'especialidad',
            'UPDATE',
            NEW.`CodigoEsp`,
            NEW.`CodUser`,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_especialidad_delete` $$
CREATE TRIGGER `trg_audit_especialidad_delete`
AFTER DELETE ON `especialidad`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'especialidad',
        'DELETE',
        OLD.`CodigoEsp`,
        OLD.`CodUser`,
        JSON_OBJECT('CodigoEsp', OLD.`CodigoEsp`, 'Titulo', OLD.`Titulo`, 'Especialidad', OLD.`Especialidad`, 'CodUser', OLD.`CodUser`),
        USER()
    );
END $$

-- -----------------------------------------------------------------
-- TABLA: instituciones  |  LLAVE: CodigoInst  |  5 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_instituciones_insert` $$
CREATE TRIGGER `trg_audit_instituciones_insert`
AFTER INSERT ON `instituciones`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'instituciones',
        'INSERT',
        NEW.`CodigoInst`,
        NEW.`CodUser`,
        JSON_OBJECT('CodigoInst', NEW.`CodigoInst`, 'siglas', NEW.`siglas`, 'nbinstitucion', NEW.`nbinstitucion`, 'tpinstitucion', NEW.`tpinstitucion`, 'CodUser', NEW.`CodUser`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_instituciones_update` $$
CREATE TRIGGER `trg_audit_instituciones_update`
AFTER UPDATE ON `instituciones`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`CodigoInst` <=> OLD.`CodigoInst`, '', CONCAT('CodigoInst: ', IFNULL(CAST(OLD.`CodigoInst` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodigoInst` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`siglas` <=> OLD.`siglas`, '', CONCAT('siglas: ', IFNULL(CAST(OLD.`siglas` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`siglas` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`nbinstitucion` <=> OLD.`nbinstitucion`, '', CONCAT('nbinstitucion: ', IFNULL(CAST(OLD.`nbinstitucion` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`nbinstitucion` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`tpinstitucion` <=> OLD.`tpinstitucion`, '', CONCAT('tpinstitucion: ', IFNULL(CAST(OLD.`tpinstitucion` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`tpinstitucion` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodUser` <=> OLD.`CodUser`, '', CONCAT('CodUser: ', IFNULL(CAST(OLD.`CodUser` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodUser` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'instituciones',
            'UPDATE',
            NEW.`CodigoInst`,
            NEW.`CodUser`,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_instituciones_delete` $$
CREATE TRIGGER `trg_audit_instituciones_delete`
AFTER DELETE ON `instituciones`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'instituciones',
        'DELETE',
        OLD.`CodigoInst`,
        OLD.`CodUser`,
        JSON_OBJECT('CodigoInst', OLD.`CodigoInst`, 'siglas', OLD.`siglas`, 'nbinstitucion', OLD.`nbinstitucion`, 'tpinstitucion', OLD.`tpinstitucion`, 'CodUser', OLD.`CodUser`),
        USER()
    );
END $$

-- -----------------------------------------------------------------
-- TABLA: lugaracto  |  LLAVE: CoLugar  |  6 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_lugaracto_insert` $$
CREATE TRIGGER `trg_audit_lugaracto_insert`
AFTER INSERT ON `lugaracto`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'lugaracto',
        'INSERT',
        NEW.`CoLugar`,
        NEW.`CodUser`,
        JSON_OBJECT('CoLugar', NEW.`CoLugar`, 'TxLugar', NEW.`TxLugar`, 'Capacidad', NEW.`Capacidad`, 'MaTipoLugar', NEW.`MaTipoLugar`, 'Activo', NEW.`Activo`, 'CodUser', NEW.`CodUser`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_lugaracto_update` $$
CREATE TRIGGER `trg_audit_lugaracto_update`
AFTER UPDATE ON `lugaracto`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`CoLugar` <=> OLD.`CoLugar`, '', CONCAT('CoLugar: ', IFNULL(CAST(OLD.`CoLugar` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CoLugar` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TxLugar` <=> OLD.`TxLugar`, '', CONCAT('TxLugar: ', IFNULL(CAST(OLD.`TxLugar` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TxLugar` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Capacidad` <=> OLD.`Capacidad`, '', CONCAT('Capacidad: ', IFNULL(CAST(OLD.`Capacidad` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Capacidad` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MaTipoLugar` <=> OLD.`MaTipoLugar`, '', CONCAT('MaTipoLugar: ', IFNULL(CAST(OLD.`MaTipoLugar` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MaTipoLugar` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Activo` <=> OLD.`Activo`, '', CONCAT('Activo: ', IFNULL(CAST(OLD.`Activo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Activo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodUser` <=> OLD.`CodUser`, '', CONCAT('CodUser: ', IFNULL(CAST(OLD.`CodUser` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodUser` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'lugaracto',
            'UPDATE',
            NEW.`CoLugar`,
            NEW.`CodUser`,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_lugaracto_delete` $$
CREATE TRIGGER `trg_audit_lugaracto_delete`
AFTER DELETE ON `lugaracto`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'lugaracto',
        'DELETE',
        OLD.`CoLugar`,
        OLD.`CodUser`,
        JSON_OBJECT('CoLugar', OLD.`CoLugar`, 'TxLugar', OLD.`TxLugar`, 'Capacidad', OLD.`Capacidad`, 'MaTipoLugar', OLD.`MaTipoLugar`, 'Activo', OLD.`Activo`, 'CodUser', OLD.`CodUser`),
        USER()
    );
END $$

-- -----------------------------------------------------------------
-- TABLA: metodopago  |  LLAVE: idMetodoPago  |  3 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_metodopago_insert` $$
CREATE TRIGGER `trg_audit_metodopago_insert`
AFTER INSERT ON `metodopago`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'metodopago',
        'INSERT',
        NEW.`idMetodoPago`,
        NULL,
        JSON_OBJECT('idMetodoPago', NEW.`idMetodoPago`, 'nombreMetodoPago', NEW.`nombreMetodoPago`, 'status', NEW.`status`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_metodopago_update` $$
CREATE TRIGGER `trg_audit_metodopago_update`
AFTER UPDATE ON `metodopago`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`idMetodoPago` <=> OLD.`idMetodoPago`, '', CONCAT('idMetodoPago: ', IFNULL(CAST(OLD.`idMetodoPago` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`idMetodoPago` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`nombreMetodoPago` <=> OLD.`nombreMetodoPago`, '', CONCAT('nombreMetodoPago: ', IFNULL(CAST(OLD.`nombreMetodoPago` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`nombreMetodoPago` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`status` <=> OLD.`status`, '', CONCAT('status: ', IFNULL(CAST(OLD.`status` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`status` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'metodopago',
            'UPDATE',
            NEW.`idMetodoPago`,
            NULL,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_metodopago_delete` $$
CREATE TRIGGER `trg_audit_metodopago_delete`
AFTER DELETE ON `metodopago`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'metodopago',
        'DELETE',
        OLD.`idMetodoPago`,
        NULL,
        JSON_OBJECT('idMetodoPago', OLD.`idMetodoPago`, 'nombreMetodoPago', OLD.`nombreMetodoPago`, 'status', OLD.`status`),
        USER()
    );
END $$

-- -----------------------------------------------------------------
-- TABLA: usuarios  |  LLAVE: CodUsuario  |  8 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_usuarios_insert` $$
CREATE TRIGGER `trg_audit_usuarios_insert`
AFTER INSERT ON `usuarios`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'usuarios',
        'INSERT',
        NEW.`CodUsuario`,
        NULL,
        JSON_OBJECT('CodUsuario', NEW.`CodUsuario`, 'Nombre', NEW.`Nombre`, 'Apellido', NEW.`Apellido`, 'Cedula', NEW.`Cedula`, 'Usuario', NEW.`Usuario`, 'Clave', '***', 'MaTipoUsr', NEW.`MaTipoUsr`, 'FechaReg', NEW.`FechaReg`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_usuarios_update` $$
CREATE TRIGGER `trg_audit_usuarios_update`
AFTER UPDATE ON `usuarios`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`CodUsuario` <=> OLD.`CodUsuario`, '', CONCAT('CodUsuario: ', IFNULL(CAST(OLD.`CodUsuario` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodUsuario` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Nombre` <=> OLD.`Nombre`, '', CONCAT('Nombre: ', IFNULL(CAST(OLD.`Nombre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Nombre` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Apellido` <=> OLD.`Apellido`, '', CONCAT('Apellido: ', IFNULL(CAST(OLD.`Apellido` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Apellido` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Cedula` <=> OLD.`Cedula`, '', CONCAT('Cedula: ', IFNULL(CAST(OLD.`Cedula` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Cedula` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Usuario` <=> OLD.`Usuario`, '', CONCAT('Usuario: ', IFNULL(CAST(OLD.`Usuario` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Usuario` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Clave` <=> OLD.`Clave`, '', 'Clave: (valor oculto); '),
            IF(NEW.`MaTipoUsr` <=> OLD.`MaTipoUsr`, '', CONCAT('MaTipoUsr: ', IFNULL(CAST(OLD.`MaTipoUsr` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MaTipoUsr` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`FechaReg` <=> OLD.`FechaReg`, '', CONCAT('FechaReg: ', IFNULL(CAST(OLD.`FechaReg` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`FechaReg` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'usuarios',
            'UPDATE',
            NEW.`CodUsuario`,
            NULL,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_usuarios_delete` $$
CREATE TRIGGER `trg_audit_usuarios_delete`
AFTER DELETE ON `usuarios`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'usuarios',
        'DELETE',
        OLD.`CodUsuario`,
        NULL,
        JSON_OBJECT('CodUsuario', OLD.`CodUsuario`, 'Nombre', OLD.`Nombre`, 'Apellido', OLD.`Apellido`, 'Cedula', OLD.`Cedula`, 'Usuario', OLD.`Usuario`, 'Clave', '***', 'MaTipoUsr', OLD.`MaTipoUsr`, 'FechaReg', OLD.`FechaReg`),
        USER()
    );
END $$

-- -----------------------------------------------------------------
-- TABLA: contratos  |  LLAVE: id  |  58 columnas
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_contratos_insert` $$
CREATE TRIGGER `trg_audit_contratos_insert`
AFTER INSERT ON `contratos`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'contratos',
        'INSERT',
        NEW.`id`,
        NEW.`CodUser`,
        JSON_OBJECT('id', NEW.`id`, 'NoContrato', NEW.`NoContrato`, 'nucedula', NEW.`nucedula`, 'titulo', NEW.`titulo`, 'especialidad', NEW.`especialidad`, 'siglas', NEW.`siglas`, 'feinicio', NEW.`feinicio`, 'modelo', NEW.`modelo`, 'kilate', NEW.`kilate`, 'medida', NEW.`medida`, 'cazirc', NEW.`cazirc`, 'tpzirc', NEW.`tpzirc`, 'peso', NEW.`peso`, 'mncontrato', NEW.`mncontrato`, 'mndescuento', NEW.`mndescuento`, 'mninicial', NEW.`mninicial`, 'mnpagado', NEW.`mnpagado`, 'mnsaldo', NEW.`mnsaldo`, 'InActivo', NEW.`InActivo`, 'MaEstado', NEW.`MaEstado`, 'FeSolici', NEW.`FeSolici`, 'Feinifab', NEW.`Feinifab`, 'FeFinFab', NEW.`FeFinFab`, 'FeIniEng', NEW.`FeIniEng`, 'FeFinEng', NEW.`FeFinEng`, 'FeFin', NEW.`FeFin`, 'nuordenfab', NEW.`nuordenfab`, 'txconcepto', NEW.`txconcepto`, 'MaTpCont', NEW.`MaTpCont`, 'inmedalla', NEW.`inmedalla`, 'inestuche', NEW.`inestuche`, 'incinta', NEW.`incinta`, 'inbotoninst', NEW.`inbotoninst`, 'inbotesp', NEW.`inbotesp`, 'indiploma', NEW.`indiploma`, 'inportadip', NEW.`inportadip`, 'inalbumesp', NEW.`inalbumesp`, 'inalbumsenc', NEW.`inalbumsenc`, 'inllavero', NEW.`inllavero`, 'inportanombre', NEW.`inportanombre`, 'infotografia', NEW.`infotografia`, 'intoga', NEW.`intoga`, 'invideo', NEW.`invideo`, 'indescuento', NEW.`indescuento`, 'Inotroreg', NEW.`Inotroreg`, 'inplaca', NEW.`inplaca`, 'cafotografia', NEW.`cafotografia`, 'TxOtroReg', NEW.`TxOtroReg`, 'TxPlaca', NEW.`TxPlaca`, 'TxDiploma', NEW.`TxDiploma`, 'Anulado', NEW.`Anulado`, 'MnCostoAnillo', NEW.`MnCostoAnillo`, 'CodUser', NEW.`CodUser`, 'CodSucursal', NEW.`CodSucursal`, 'Exonerado', NEW.`Exonerado`, 'TxObservacion', NEW.`TxObservacion`, 'NoCierre', NEW.`NoCierre`, 'FechaCierre', NEW.`FechaCierre`),
        USER()
    );
END $$
DROP TRIGGER IF EXISTS `trg_audit_contratos_update` $$
CREATE TRIGGER `trg_audit_contratos_update`
AFTER UPDATE ON `contratos`
FOR EACH ROW
BEGIN
    DECLARE v_cambios TEXT;
    SET v_cambios = CONCAT(
            IF(NEW.`id` <=> OLD.`id`, '', CONCAT('id: ', IFNULL(CAST(OLD.`id` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`id` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoContrato` <=> OLD.`NoContrato`, '', CONCAT('NoContrato: ', IFNULL(CAST(OLD.`NoContrato` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoContrato` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`nucedula` <=> OLD.`nucedula`, '', CONCAT('nucedula: ', IFNULL(CAST(OLD.`nucedula` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`nucedula` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`titulo` <=> OLD.`titulo`, '', CONCAT('titulo: ', IFNULL(CAST(OLD.`titulo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`titulo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`especialidad` <=> OLD.`especialidad`, '', CONCAT('especialidad: ', IFNULL(CAST(OLD.`especialidad` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`especialidad` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`siglas` <=> OLD.`siglas`, '', CONCAT('siglas: ', IFNULL(CAST(OLD.`siglas` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`siglas` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`feinicio` <=> OLD.`feinicio`, '', CONCAT('feinicio: ', IFNULL(CAST(OLD.`feinicio` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`feinicio` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`modelo` <=> OLD.`modelo`, '', CONCAT('modelo: ', IFNULL(CAST(OLD.`modelo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`modelo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`kilate` <=> OLD.`kilate`, '', CONCAT('kilate: ', IFNULL(CAST(OLD.`kilate` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`kilate` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`medida` <=> OLD.`medida`, '', CONCAT('medida: ', IFNULL(CAST(OLD.`medida` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`medida` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`cazirc` <=> OLD.`cazirc`, '', CONCAT('cazirc: ', IFNULL(CAST(OLD.`cazirc` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`cazirc` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`tpzirc` <=> OLD.`tpzirc`, '', CONCAT('tpzirc: ', IFNULL(CAST(OLD.`tpzirc` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`tpzirc` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`peso` <=> OLD.`peso`, '', CONCAT('peso: ', IFNULL(CAST(OLD.`peso` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`peso` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`mncontrato` <=> OLD.`mncontrato`, '', CONCAT('mncontrato: ', IFNULL(CAST(OLD.`mncontrato` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`mncontrato` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`mndescuento` <=> OLD.`mndescuento`, '', CONCAT('mndescuento: ', IFNULL(CAST(OLD.`mndescuento` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`mndescuento` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`mninicial` <=> OLD.`mninicial`, '', CONCAT('mninicial: ', IFNULL(CAST(OLD.`mninicial` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`mninicial` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`mnpagado` <=> OLD.`mnpagado`, '', CONCAT('mnpagado: ', IFNULL(CAST(OLD.`mnpagado` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`mnpagado` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`mnsaldo` <=> OLD.`mnsaldo`, '', CONCAT('mnsaldo: ', IFNULL(CAST(OLD.`mnsaldo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`mnsaldo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`InActivo` <=> OLD.`InActivo`, '', CONCAT('InActivo: ', IFNULL(CAST(OLD.`InActivo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`InActivo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MaEstado` <=> OLD.`MaEstado`, '', CONCAT('MaEstado: ', IFNULL(CAST(OLD.`MaEstado` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MaEstado` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`FeSolici` <=> OLD.`FeSolici`, '', CONCAT('FeSolici: ', IFNULL(CAST(OLD.`FeSolici` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`FeSolici` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Feinifab` <=> OLD.`Feinifab`, '', CONCAT('Feinifab: ', IFNULL(CAST(OLD.`Feinifab` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Feinifab` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`FeFinFab` <=> OLD.`FeFinFab`, '', CONCAT('FeFinFab: ', IFNULL(CAST(OLD.`FeFinFab` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`FeFinFab` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`FeIniEng` <=> OLD.`FeIniEng`, '', CONCAT('FeIniEng: ', IFNULL(CAST(OLD.`FeIniEng` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`FeIniEng` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`FeFinEng` <=> OLD.`FeFinEng`, '', CONCAT('FeFinEng: ', IFNULL(CAST(OLD.`FeFinEng` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`FeFinEng` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`FeFin` <=> OLD.`FeFin`, '', CONCAT('FeFin: ', IFNULL(CAST(OLD.`FeFin` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`FeFin` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`nuordenfab` <=> OLD.`nuordenfab`, '', CONCAT('nuordenfab: ', IFNULL(CAST(OLD.`nuordenfab` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`nuordenfab` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`txconcepto` <=> OLD.`txconcepto`, '', CONCAT('txconcepto: ', IFNULL(CAST(OLD.`txconcepto` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`txconcepto` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MaTpCont` <=> OLD.`MaTpCont`, '', CONCAT('MaTpCont: ', IFNULL(CAST(OLD.`MaTpCont` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MaTpCont` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`inmedalla` <=> OLD.`inmedalla`, '', CONCAT('inmedalla: ', IFNULL(CAST(OLD.`inmedalla` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`inmedalla` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`inestuche` <=> OLD.`inestuche`, '', CONCAT('inestuche: ', IFNULL(CAST(OLD.`inestuche` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`inestuche` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`incinta` <=> OLD.`incinta`, '', CONCAT('incinta: ', IFNULL(CAST(OLD.`incinta` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`incinta` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`inbotoninst` <=> OLD.`inbotoninst`, '', CONCAT('inbotoninst: ', IFNULL(CAST(OLD.`inbotoninst` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`inbotoninst` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`inbotesp` <=> OLD.`inbotesp`, '', CONCAT('inbotesp: ', IFNULL(CAST(OLD.`inbotesp` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`inbotesp` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`indiploma` <=> OLD.`indiploma`, '', CONCAT('indiploma: ', IFNULL(CAST(OLD.`indiploma` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`indiploma` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`inportadip` <=> OLD.`inportadip`, '', CONCAT('inportadip: ', IFNULL(CAST(OLD.`inportadip` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`inportadip` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`inalbumesp` <=> OLD.`inalbumesp`, '', CONCAT('inalbumesp: ', IFNULL(CAST(OLD.`inalbumesp` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`inalbumesp` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`inalbumsenc` <=> OLD.`inalbumsenc`, '', CONCAT('inalbumsenc: ', IFNULL(CAST(OLD.`inalbumsenc` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`inalbumsenc` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`inllavero` <=> OLD.`inllavero`, '', CONCAT('inllavero: ', IFNULL(CAST(OLD.`inllavero` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`inllavero` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`inportanombre` <=> OLD.`inportanombre`, '', CONCAT('inportanombre: ', IFNULL(CAST(OLD.`inportanombre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`inportanombre` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`infotografia` <=> OLD.`infotografia`, '', CONCAT('infotografia: ', IFNULL(CAST(OLD.`infotografia` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`infotografia` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`intoga` <=> OLD.`intoga`, '', CONCAT('intoga: ', IFNULL(CAST(OLD.`intoga` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`intoga` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`invideo` <=> OLD.`invideo`, '', CONCAT('invideo: ', IFNULL(CAST(OLD.`invideo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`invideo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`indescuento` <=> OLD.`indescuento`, '', CONCAT('indescuento: ', IFNULL(CAST(OLD.`indescuento` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`indescuento` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Inotroreg` <=> OLD.`Inotroreg`, '', CONCAT('Inotroreg: ', IFNULL(CAST(OLD.`Inotroreg` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Inotroreg` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`inplaca` <=> OLD.`inplaca`, '', CONCAT('inplaca: ', IFNULL(CAST(OLD.`inplaca` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`inplaca` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`cafotografia` <=> OLD.`cafotografia`, '', CONCAT('cafotografia: ', IFNULL(CAST(OLD.`cafotografia` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`cafotografia` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TxOtroReg` <=> OLD.`TxOtroReg`, '', CONCAT('TxOtroReg: ', IFNULL(CAST(OLD.`TxOtroReg` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TxOtroReg` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TxPlaca` <=> OLD.`TxPlaca`, '', CONCAT('TxPlaca: ', IFNULL(CAST(OLD.`TxPlaca` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TxPlaca` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TxDiploma` <=> OLD.`TxDiploma`, '', CONCAT('TxDiploma: ', IFNULL(CAST(OLD.`TxDiploma` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TxDiploma` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Anulado` <=> OLD.`Anulado`, '', CONCAT('Anulado: ', IFNULL(CAST(OLD.`Anulado` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Anulado` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`MnCostoAnillo` <=> OLD.`MnCostoAnillo`, '', CONCAT('MnCostoAnillo: ', IFNULL(CAST(OLD.`MnCostoAnillo` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`MnCostoAnillo` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodUser` <=> OLD.`CodUser`, '', CONCAT('CodUser: ', IFNULL(CAST(OLD.`CodUser` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodUser` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`CodSucursal` <=> OLD.`CodSucursal`, '', CONCAT('CodSucursal: ', IFNULL(CAST(OLD.`CodSucursal` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`CodSucursal` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`Exonerado` <=> OLD.`Exonerado`, '', CONCAT('Exonerado: ', IFNULL(CAST(OLD.`Exonerado` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`Exonerado` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`TxObservacion` <=> OLD.`TxObservacion`, '', CONCAT('TxObservacion: ', IFNULL(CAST(OLD.`TxObservacion` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`TxObservacion` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`NoCierre` <=> OLD.`NoCierre`, '', CONCAT('NoCierre: ', IFNULL(CAST(OLD.`NoCierre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`NoCierre` AS CHAR), 'NULL'), '; ')),
            IF(NEW.`FechaCierre` <=> OLD.`FechaCierre`, '', CONCAT('FechaCierre: ', IFNULL(CAST(OLD.`FechaCierre` AS CHAR), 'NULL'), ' -> ', IFNULL(CAST(NEW.`FechaCierre` AS CHAR), 'NULL'), '; '))
        );

    IF v_cambios <> '' THEN
        INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
        VALUES (
            'contratos',
            'UPDATE',
            NEW.`id`,
            NEW.`CodUser`,
            v_cambios,
            USER()
        );
    END IF;
END $$
DROP TRIGGER IF EXISTS `trg_audit_contratos_delete` $$
CREATE TRIGGER `trg_audit_contratos_delete`
AFTER DELETE ON `contratos`
FOR EACH ROW
BEGIN
    INSERT INTO `auditoria_general` (`tabla_afectada`, `accion`, `id_registro`, `CodUser`, `detalles`, `usuario_bd`)
    VALUES (
        'contratos',
        'DELETE',
        OLD.`id`,
        OLD.`CodUser`,
        JSON_OBJECT('id', OLD.`id`, 'NoContrato', OLD.`NoContrato`, 'nucedula', OLD.`nucedula`, 'titulo', OLD.`titulo`, 'especialidad', OLD.`especialidad`, 'siglas', OLD.`siglas`, 'feinicio', OLD.`feinicio`, 'modelo', OLD.`modelo`, 'kilate', OLD.`kilate`, 'medida', OLD.`medida`, 'cazirc', OLD.`cazirc`, 'tpzirc', OLD.`tpzirc`, 'peso', OLD.`peso`, 'mncontrato', OLD.`mncontrato`, 'mndescuento', OLD.`mndescuento`, 'mninicial', OLD.`mninicial`, 'mnpagado', OLD.`mnpagado`, 'mnsaldo', OLD.`mnsaldo`, 'InActivo', OLD.`InActivo`, 'MaEstado', OLD.`MaEstado`, 'FeSolici', OLD.`FeSolici`, 'Feinifab', OLD.`Feinifab`, 'FeFinFab', OLD.`FeFinFab`, 'FeIniEng', OLD.`FeIniEng`, 'FeFinEng', OLD.`FeFinEng`, 'FeFin', OLD.`FeFin`, 'nuordenfab', OLD.`nuordenfab`, 'txconcepto', OLD.`txconcepto`, 'MaTpCont', OLD.`MaTpCont`, 'inmedalla', OLD.`inmedalla`, 'inestuche', OLD.`inestuche`, 'incinta', OLD.`incinta`, 'inbotoninst', OLD.`inbotoninst`, 'inbotesp', OLD.`inbotesp`, 'indiploma', OLD.`indiploma`, 'inportadip', OLD.`inportadip`, 'inalbumesp', OLD.`inalbumesp`, 'inalbumsenc', OLD.`inalbumsenc`, 'inllavero', OLD.`inllavero`, 'inportanombre', OLD.`inportanombre`, 'infotografia', OLD.`infotografia`, 'intoga', OLD.`intoga`, 'invideo', OLD.`invideo`, 'indescuento', OLD.`indescuento`, 'Inotroreg', OLD.`Inotroreg`, 'inplaca', OLD.`inplaca`, 'cafotografia', OLD.`cafotografia`, 'TxOtroReg', OLD.`TxOtroReg`, 'TxPlaca', OLD.`TxPlaca`, 'TxDiploma', OLD.`TxDiploma`, 'Anulado', OLD.`Anulado`, 'MnCostoAnillo', OLD.`MnCostoAnillo`, 'CodUser', OLD.`CodUser`, 'CodSucursal', OLD.`CodSucursal`, 'Exonerado', OLD.`Exonerado`, 'TxObservacion', OLD.`TxObservacion`, 'NoCierre', OLD.`NoCierre`, 'FechaCierre', OLD.`FechaCierre`),
        USER()
    );
END $$

DELIMITER ;

-- Listo: 13 tablas monitoreadas = 39 triggers.
-- Verificar con: SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE();
-- Consultar con: SELECT * FROM auditoria_general ORDER BY fecha_hora DESC;