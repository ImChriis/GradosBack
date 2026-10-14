-- =================================================================
--  SISTEMA DE AUDITORIA - Base de datos: `grados`
--  Motor: MySQL 5.7+ / MariaDB 10.x / TiDB Cloud
--
--  Contenido:
--    1) Tabla central: auditoria_general
--    2) Indices sobre la bitacora
--
--  IMPORTANTE:
--    * TiDB Cloud NO soporta triggers, por eso la auditoria la
--      escribe la aplicacion (Node.js) y NO la base de datos.
--      Ver: src/modules/audit/auditService.js
--    * Por eso este script solo crea la TABLA. Los triggers que se
--      usaban antes quedan archivados en auditoria_legacy_triggers.sql
--      por si en el futuro se migra a una BD que si los soporte
--      (MariaDB / MySQL) y se quiere volver al esquema de BD.
--    * Si vuelves a los triggers, DESACTIVA las llamadas de
--      auditService en los controllers o tendras doble registro.
--
--  CodUser: codigo de la persona que hizo el cambio (columna CodUser
--  de cada tabla). Tablas sin esa columna (bancos, configuracion,
--  metodopago, usuarios) quedan con CodUser = NULL y conservan
--  usuario_bd (usuario de la BD) como unico rastro.
--  La clave y txclaveadm NUNCA se guardan en claro.
--
--  IMPORTANTE: ejecutar con seleccionada la base `grados`
--  El script es idempotente: puede ejecutarse mas de una vez.
-- =================================================================

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
) ENGINE = InnoDB;

-- Upgrade idempotente: agrega la columna CodUser si no existe
-- (si vienes de una version anterior que tenia "cod_user", ejecuta primero:
--  ALTER TABLE `auditoria_general` CHANGE COLUMN `cod_user` `CodUser` INT NULL; )
ALTER TABLE `auditoria_general` ADD COLUMN IF NOT EXISTS `CodUser` INT NULL AFTER `id_registro`;
