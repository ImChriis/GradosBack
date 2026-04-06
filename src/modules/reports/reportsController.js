const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const db = require('../../config/db');

exports.actPlacesPdf = async (req, res) => {
    // 1. Configuración del documento
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true 
    });

    // 2. Cabeceras de respuesta para el navegador
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=reporte-lugares.pdf');
    doc.pipe(res);

    // Ruta del logo (Asegúrate de que el archivo exista en esta ruta)
    const logoPath = path.join(__dirname, 'logo.png'); 

    // --- FUNCIÓN PARA ENCABEZADO REPETIBLE ---
    let addHeader = (doc, logoPath) => {
        try {
            doc.image(logoPath, 50, 40, { width: 140 });
        } catch (error) {
            doc.fontSize(10).font('Helvetica-Bold').text("GRADOS DE VENEZUELA C.A.", 50, 50);
        }

        doc.fontSize(10).font('Helvetica')
            .text("Grado`s de Venezuela, C.A.", 350, 45, { align: 'right' })
            .text("J-30591547-4", 350, 58, { align: 'right' });

        // Líneas dobles envolviendo el título
        doc.moveTo(50, 100).lineTo(545, 100).lineWidth(0.5).stroke(); 
        
        doc.fontSize(13)
            .font('Helvetica-Bold')
            .text("Reporte de Lugares de Acto", 50, 110, { align: 'center' });
            
        doc.moveTo(50, 130).lineTo(545, 130).lineWidth(0.5).stroke(); 
    };

    // --- FUNCIÓN PARA PIE DE PÁGINA ---
    let drawFooter = (doc, yPos) => {
        // Línea antes del footer
        doc.moveTo(50, yPos + 10).lineTo(545, yPos + 10).lineWidth(0.5).stroke();
        
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#000000')
            .text("Para Mayor Información Visite www.gradosdevenezuela.com", 50, yPos + 25, { align: 'center' })
            .text("o escribanos a los correos info@gradosdevenezuela.com", 50, yPos + 40, { align: 'center' });
    };

    // Primera página
    addHeader(doc, logoPath);

    try {
        // Consulta a la base de datos
        const [lugares] = await db.query("SELECT CoLugar, TxLugar, Capacidad, MaTipoLugar FROM lugaracto WHERE Activo = 1 ORDER BY CoLugar ASC");

        let currentY = 160;
        const rowHeight = 25;
        const colWidths = {
            codigo: 60,
            nombre: 250,
            capacidad: 100,
            tipo: 85
        };

        // --- CABECERA DE TABLA (Fondo blanco, texto centrado) ---
        doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold');
        
        let headX = 50;
        const headers = ["CODIGO", "NOMBRE DEL LUGAR DE ACTOS", "CAPACIDAD", "TIPO"];
        
        headers.forEach((h, i) => {
            const keys = ['codigo', 'nombre', 'capacidad', 'tipo'];
            const w = colWidths[keys[i]];
            
            // Dibujar recuadro de la celda (borde negro)
            doc.rect(headX, currentY, w, rowHeight).lineWidth(0.5).stroke();
            // Texto centrado
            doc.text(h, headX, currentY + 8, { width: w, align: 'center' });
            headX += w;
        });

        doc.font('Helvetica').fontSize(9);
        currentY += rowHeight;

        // --- FILAS DE DATOS ---
        lugares.forEach((lugar, index) => {
            // Control de salto de página
            if (currentY > 720) {
                doc.addPage();
                addHeader(doc, logoPath);
                currentY = 160;
                doc.font('Helvetica').fontSize(9);
            }

            const esPar = (index + 1) % 2 === 0;

            // 1. Dibujar Fondo si es par (Amarillo)
            if (esPar) {
                doc.fillColor('#FFFFE0').rect(50, currentY, 495, rowHeight).fill();
            }

            // 2. Dibujar Bordes y Texto (Encima del fondo)
            doc.fillColor('#000000'); // Volver a negro para el contenido
            let rowX = 50;
            
            // Código
            doc.rect(rowX, currentY, colWidths.codigo, rowHeight).lineWidth(0.5).stroke();
            doc.text(lugar.CoLugar.toString(), rowX, currentY + 8, { width: colWidths.codigo, align: 'center' });
            rowX += colWidths.codigo;

            // Nombre
            doc.rect(rowX, currentY, colWidths.nombre, rowHeight).lineWidth(0.5).stroke();
            doc.text(lugar.TxLugar || '', rowX + 5, currentY + 8, { width: colWidths.nombre - 10, lineBreak: false });
            rowX += colWidths.nombre;

            // Capacidad
            doc.rect(rowX, currentY, colWidths.capacidad, rowHeight).lineWidth(0.5).stroke();
            doc.text(lugar.Capacidad ? lugar.Capacidad.toString() : '0', rowX, currentY + 8, { width: colWidths.capacidad, align: 'center' });
            rowX += colWidths.capacidad;

            // Tipo
            doc.rect(rowX, currentY, colWidths.tipo, rowHeight).lineWidth(0.5).stroke();
            const tipoLabel = lugar.MaTipoLugar == 1 ? 'Teatro Techado' : 'Salón / Otros';
            doc.text(tipoLabel, rowX, currentY + 8, { width: colWidths.tipo, align: 'center' });

            currentY += rowHeight;
        });

        // Dibujar el pie de página justo debajo de la última fila
        drawFooter(doc, currentY);

    } catch (dbError) {
        console.error("Error en reporte:", dbError);
        doc.fillColor('red').text("Error al cargar datos de la base de datos.", 50, 200);
    }

    // Finalizar
    doc.end();
};

exports.actPlacesExcel = async (req, res) => {
    try {
        const [lugares] = await db.query("SELECT CoLugar, TxLugar, Capacidad, MaTipoLugar FROM lugaracto WHERE Activo = 1 ORDER BY CoLugar ASC");

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte de Lugares');

        // 1. LOGO
        // const logoPath = path.join(__dirname, '../../../assets/img/logo.jpg');
        // const logoId = workbook.addImage({
        //     filename: logoPath,
        //     extension: 'jpeg',
        // });
        
        // worksheet.addImage(logoId, {
        //     tl: { col: 0.1, row: 0.5 },
        //     ext: { width: 140, height: 50 }
        // });

        // 2. INFO EMPRESA
        const infoCell = worksheet.getCell('D2');
        infoCell.value = "Grado`s de Venezuela, C.A.\nJ-30591547-4";
        infoCell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        infoCell.font = { name: 'Arial', size: 10 };

        // 3. TÍTULO CON LÍNEAS (Rango A a D)
        ['A', 'B', 'C', 'D'].forEach(col => {
            worksheet.getCell(`${col}5`).border = { bottom: { style: 'thin' } };
        });

        worksheet.mergeCells('A6:D6');
        const titleCell = worksheet.getCell('A6');
        titleCell.value = "Reporte de Lugares de Acto";
        titleCell.font = { name: 'Arial', bold: true, size: 13 };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        ['A', 'B', 'C', 'D'].forEach(col => {
            worksheet.getCell(`${col}6`).border = { bottom: { style: 'thin' } };
        });

        // 4. CABECERA DE TABLA (Fila 8)
        const headerRowNumber = 8;
        worksheet.columns = [
            { key: 'codigo', width: 12 },
            { key: 'nombre', width: 45 },
            { key: 'capacidad', width: 15 },
            { key: 'tipo', width: 22 }
        ];

        const headerRow = worksheet.getRow(headerRowNumber);
        headerRow.values = ["CODIGO", "NOMBRE DEL LUGAR DE ACTOS", "CAPACIDAD", "TIPO"];
        
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, size: 10 };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // 5. DATOS
        let currentRow = headerRowNumber + 1;
        lugares.forEach((lugar, index) => {
            const tipoLabel = lugar.MaTipoLugar == 1 ? 'Teatro Techado' : 'Salón / Otros';
            const row = worksheet.addRow([lugar.CoLugar, lugar.TxLugar, lugar.Capacidad || 0, tipoLabel]);

            const esPar = (index + 1) % 2 === 0;
            row.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 ? 'left' : 'center' };
                if (esPar) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFE0' } };
                }
            });
            currentRow++;
        });

        // 6. CIERRE DE TABLA Y LÍNEA DE FOOTER (Sin casillas extra)
        // Aplicar borde inferior a la última fila de datos
        const lastDataRow = currentRow - 1;
        ['A', 'B', 'C', 'D'].forEach(col => {
            const cell = worksheet.getCell(`${col} ${lastDataRow}`);
            cell.border = { ...cell.border, bottom: { style: 'thin' } };
        });

        // LÍNEA DEL FOOTER: Solo una casilla después de la tabla
        const lineSeparatorRow = currentRow; // currentRow ya es la fila vacía después de los datos
        ['A', 'B', 'C', 'D'].forEach(col => {
            worksheet.getCell(`${col}${lineSeparatorRow}`).border = { bottom: { style: 'thin' } };
        });

        // 7. TEXTO DEL FOOTER (Inmediatamente debajo de la línea)
        const footerStart = lineSeparatorRow + 1;
        worksheet.mergeCells(`A${footerStart}:D${footerStart}`);
        worksheet.mergeCells(`A${footerStart + 1}:D${footerStart + 1}`);

        const f1 = worksheet.getCell(`A${footerStart}`);
        const f2 = worksheet.getCell(`A${footerStart + 1}`);

        f1.value = "Para Mayor Información Visite www.gradosdevenezuela.com";
        f2.value = "o escribanos a los correos info@gradosdevenezuela.com";

        [f1, f2].forEach(cell => {
            cell.alignment = { horizontal: 'center' };
            cell.font = { name: 'Arial', size: 10 };
        });

        // 8. ENVÍO
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=reporte-lugares.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).send("Error al generar Excel");
    }
};