const db = require('../../config/db');

exports.getSettings = async (req, res) => {
    try{
        const sql = 'SELECT * FROM configuracion';
        const [rows] = await db.query(sql);
        res.json(rows[0]);
    } catch (error){
        console.error('Error fetching settings: ', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.updateSettings = async (req, res) => {
    const { id } = req.params;
    
    // Desestructuramos todos los campos que vienen del formulario de Angular
    const {
        CoSucursal, NbSucursal, Producto, Nombre, Rif, 
        Direccion, Telefono, Fax, txclaveadm, NoRecibo, 
        NoContrato, NoActo, CaDiasFab, CaDiasEngaste, MaFormRec, 
        PcOro18, PcOro14, PcOro10, MnMerma, MnCostOro, 
        Impuesto, MnCostoMano, UbicacionLogo, UbicacionRpt, 
        TxMensaje1, TxMensaje2, TxMensaje3, 
        GeneraNoRecibo, GeneraNoContrato, GeneraNoActo, GeneraNoCierre, NoCierre
    } = req.body;

    try {
        const sql = `
            UPDATE Configuracion SET 
                CoSucursal = ?, NbSucursal = ?, Producto = ?, Nombre = ?, Rif = ?, 
                Direccion = ?, Telefono = ?, Fax = ?, txclaveadm = ?, NoRecibo = ?, 
                NoContrato = ?, NoActo = ?, CaDiasFab = ?, CaDiasEngaste = ?, MaFormRec = ?, 
                PcOro18 = ?, PcOro14 = ?, PcOro10 = ?, MnMerma = ?, MnCostOro = ?, 
                Impuesto = ?, MnCostoMano = ?, UbicacionLogo = ?, UbicacionRpt = ?, 
                TxMensaje1 = ?, TxMensaje2 = ?, TxMensaje3 = ?, 
                GeneraNoRecibo = ?, GeneraNoContrato = ?, GeneraNoActo = ?, GeneraNoCierre = ?, NoCierre = ?
            WHERE Id = ?`;

        const [result] = await db.query(sql, [
            CoSucursal, NbSucursal, Producto, Nombre, Rif, 
            Direccion, Telefono, Fax, txclaveadm, NoRecibo, 
            NoContrato, NoActo, CaDiasFab, CaDiasEngaste, MaFormRec, 
            PcOro18, PcOro14, PcOro10, MnMerma, MnCostOro, 
            Impuesto, MnCostoMano, UbicacionLogo, UbicacionRpt, 
            TxMensaje1, TxMensaje2, TxMensaje3, 
            GeneraNoRecibo ? 'S' : 'N', // Mapeo de boolean a char(1) si usas S/N
            GeneraNoContrato ? 'S' : 'N',
            GeneraNoActo ? 'S' : 'N',
            GeneraNoCierre ? 'S' : 'N',
            NoCierre,
            id // El ID de la URL para el WHERE
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'error',
                message: `No se encontró la configuración con ID: ${id}`
            });
        }

        res.json({ 
            status: 'success', 
            message: 'Configuración actualizada correctamente' 
        });

    } catch (error) {
        console.error("Error al actualizar configuración:", error);
        res.status(500).json({ 
            status: 'error', 
            message: "Error interno del servidor",
            details: error.message 
        });
    }
};