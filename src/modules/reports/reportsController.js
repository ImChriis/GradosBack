const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const db = require('../../config/db');

exports.specialitiesPdf = async (req, res) => {
    const { usuarioReporte } = req.params;

    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 20, left: 50, right: 50 },
        bufferPages: true 
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=reporte-especialidades.pdf');
    doc.pipe(res);

    const logoPath = path.join(__dirname, 'logo.png');

    const addHeader = (doc, logoPath, usuario) => {
        try {
            doc.image(logoPath, 50, 35, { width: 65 });
        } catch (error) {
            console.log("Error logo");
        }

        doc.fontSize(9).font('Helvetica-Bold')
            .text("Grado`s de Venezuela, C.A.", 130, 40)
            .font('Helvetica').text("J-30591547-4", 130, 52);

        const fechaActual = new Date().toLocaleDateString('es-VE');
        const horaActual = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });

        doc.fontSize(8).font('Helvetica')
            .text(`Fecha: ${fechaActual}`, 350, 40, { align: 'right' })
            .text(`Hora: ${horaActual}`, 350, 50, { align: 'right' })
            .text(`Usuario: ${usuario}`, 350, 60, { align: 'right' });

        doc.moveTo(50, 85).lineTo(545, 85).lineWidth(0.5).stroke();
        doc.fontSize(12).font('Helvetica-Bold').text("Reporte de Especialidades", 50, 95, { align: 'center' });
        doc.moveTo(50, 115).lineTo(545, 115).lineWidth(0.5).stroke();
    };

    const drawTableHeader = (doc, y) => {
        // Anchos ajustados: Código (70), Título (212), Especialidad (213) = 495 total
        const colWidths = { cod: 70, tit: 212, esp: 213 };
        const rowHeight = 20;
        doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
        let headX = 50;
        const headers = ["CÓDIGO", "TÍTULO", "ESPECIALIDAD"];
        
        headers.forEach((h, i) => {
            const w = Object.values(colWidths)[i];
            doc.rect(headX, y, w, rowHeight).stroke();
            doc.text(h, headX, y + 5, { width: w, align: 'center' });
            headX += w;
        });
        return y + rowHeight;
    };

    addHeader(doc, logoPath, usuarioReporte);

    try {
        const [rows] = await db.query("SELECT CodigoEsp, Titulo, Especialidad FROM especialidad ORDER BY CodigoEsp ASC");

        let currentY = 130; 
        const rowHeight = 20;
        const colWidths = { cod: 70, tit: 212, esp: 213 };

        currentY = drawTableHeader(doc, currentY);
        doc.font('Helvetica').fontSize(8);

        rows.forEach((item, index) => {
            if (index > 0 && index % 22 === 0) {
                doc.addPage();
                addHeader(doc, logoPath, usuarioReporte);
                currentY = 130;
                currentY = drawTableHeader(doc, currentY);
                doc.font('Helvetica').fontSize(8);
            }

            if ((index + 1) % 2 === 0) {
                doc.fillColor('#FFFFE0').rect(50, currentY, 495, rowHeight).fill();
            }

            doc.fillColor('#000000');
            let rX = 50;
            const dataArr = [item.CodigoEsp, item.Titulo, item.Especialidad];
            const keys = Object.keys(colWidths);

            dataArr.forEach((val, i) => {
                const w = colWidths[keys[i]];
                doc.rect(rX, currentY, w, rowHeight).stroke();
                const isTextCol = (i === 1 || i === 2);
                doc.text(val?.toString() || '', rX + (isTextCol ? 5 : 0), currentY + 6, { 
                    width: isTextCol ? w - 10 : w, 
                    align: isTextCol ? 'left' : 'center',
                    lineBreak: false 
                });
                rX += w;
            });
            currentY += rowHeight;
        });

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < (range.start + range.count); i++) {
            doc.switchToPage(i);
            const isLastPage = (i === (range.start + range.count - 1));
            let footerBaseY = isLastPage ? Math.min(currentY + 15, 610) : 610; 

            doc.moveTo(50, footerBaseY).lineTo(545, footerBaseY).lineWidth(0.5).stroke();
            doc.fontSize(9).font('Helvetica').fillColor('#000000');
            doc.text("Para Mayor Información Visite nuestro instagram @gradosdevzla", 50, footerBaseY + 10, { align: 'center', width: 495 });
            doc.text("o escribanos a los correos info.gradosdevzla@gmail.com", 50, footerBaseY + 22, { align: 'center', width: 495 });

            doc.fontSize(8).font('Helvetica-Bold')
                .text(`Página ${i + 1} / ${range.count}`, 50, 785, { align: 'right', width: 495 });
        }

    } catch (err) {
        console.error(err);
    }
    doc.end();
};

exports.specialitiesExcel = async (req, res) => {
    try {
        const { usuarioReporte } = req.params;
        const [rows] = await db.query("SELECT CodigoEsp, Titulo, Especialidad FROM especialidad ORDER BY CodigoEsp ASC");

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte Especialidades');

        const logoPath = path.join(__dirname, 'logo.png');
        const logoId = workbook.addImage({ filename: logoPath, extension: 'png' });
        worksheet.addImage(logoId, {
            tl: { col: 0.1, row: 1.2 },
            ext: { width: 60, height: 40 }
        });
        worksheet.getRow(2).height = 50;

        const empresaCell = worksheet.getCell('B2');
        empresaCell.value = "Grado`s de Venezuela, C.A.\nJ-30591547-4";
        empresaCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        empresaCell.font = { name: 'Arial', bold: true, size: 9 };

        const fechaActual = new Date().toLocaleDateString('es-VE');
        const horaActual = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
        const metaCell = worksheet.getCell('C2'); // Movido a C porque ya no hay D
        metaCell.value = `Fecha: ${fechaActual}\nHora: ${horaActual}\nUsuario: ${usuarioReporte}`;
        metaCell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        metaCell.font = { name: 'Arial', size: 8 };

        ['A', 'B', 'C'].forEach(col => worksheet.getCell(`${col}5`).border = { bottom: { style: 'thin' } });
        worksheet.mergeCells('A6:C6');
        const tCell = worksheet.getCell('A6');
        tCell.value = "Reporte de Especialidades";
        tCell.font = { bold: true, size: 13 };
        tCell.alignment = { horizontal: 'center' };
        ['A', 'B', 'C'].forEach(col => worksheet.getCell(`${col}6`).border = { bottom: { style: 'thin' } });

        worksheet.columns = [
            { key: 'cod', width: 15 },
            { key: 'tit', width: 45 },
            { key: 'esp', width: 45 }
        ];

        const hRow = worksheet.getRow(8);
        hRow.values = ["CÓDIGO", "TÍTULO", "ESPECIALIDAD"];
        hRow.eachCell(c => {
            c.font = { bold: true };
            c.alignment = { horizontal: 'center' };
            c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
        });

        rows.forEach((item, index) => {
            const row = worksheet.addRow([item.CodigoEsp, item.Titulo, item.Especialidad]);
            const esPar = (index + 1) % 2 === 0;
            row.eachCell((cell, colNum) => {
                cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
                cell.alignment = { horizontal: colNum === 1 ? 'center' : 'left', vertical: 'middle' };
                if (esPar) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0' } };
            });
        });

        const lastRowNumber = worksheet.lastRow.number;
        const lineRow = lastRowNumber + 2;

        ['A', 'B', 'C'].forEach(col => {
            worksheet.getCell(`${col}${lineRow}`).border = { bottom: { style: 'thin' } };
        });
        
        const rowF1 = lineRow + 1;
        worksheet.mergeCells(`A${rowF1}:C${rowF1}`);
        const f1 = worksheet.getCell(`A${rowF1}`);
        f1.value = "Para Mayor Información Visite nuestro instagram @gradosdevzla";
        f1.alignment = { horizontal: 'center' };
        f1.font = { name: 'Arial', size: 9 };

        const rowF2 = lineRow + 2;
        worksheet.mergeCells(`A${rowF2}:C${rowF2}`);
        const f2 = worksheet.getCell(`A${rowF2}`);
        f2.value = "o escribanos a los correos info.gradosdevzla@gmail.com";
        f2.alignment = { horizontal: 'center' };
        f2.font = { name: 'Arial', size: 9 };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=reporte-especialidades.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).send("Error");
    }
};

exports.institutionsPdf = async (req, res) => {
    const { usuarioReporte } = req.params;

    const doc = new PDFDocument({
        size: 'A4',
        // Reducimos el margen inferior para que no dispare saltos automáticos
        margins: { top: 40, bottom: 20, left: 50, right: 50 },
        bufferPages: true 
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=reporte-instituciones.pdf');
    doc.pipe(res);

    const logoPath = path.join(__dirname, 'logo.png');

    const addHeader = (doc, logoPath, usuario) => {
        try {
            doc.image(logoPath, 50, 35, { width: 65 });
        } catch (error) {
            console.log("Error logo");
        }

        doc.fontSize(9).font('Helvetica-Bold')
            .text("Grado`s de Venezuela, C.A.", 130, 40)
            .font('Helvetica').text("J-30591547-4", 130, 52);

        const fechaActual = new Date().toLocaleDateString('es-VE');
        const horaActual = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });

        doc.fontSize(8).font('Helvetica')
            .text(`Fecha: ${fechaActual}`, 350, 40, { align: 'right' })
            .text(`Hora: ${horaActual}`, 350, 50, { align: 'right' })
            .text(`Usuario: ${usuario}`, 350, 60, { align: 'right' });

        doc.moveTo(50, 85).lineTo(545, 85).lineWidth(0.5).stroke();
        doc.fontSize(12).font('Helvetica-Bold').text("Reporte de Instituciones", 50, 95, { align: 'center' });
        doc.moveTo(50, 115).lineTo(545, 115).lineWidth(0.5).stroke();
    };

    const drawTableHeader = (doc, y) => {
        const colWidths = { cod: 60, sig: 80, nom: 270, tip: 85 };
        const rowHeight = 20;
        doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
        let headX = 50;
        const headers = ["CÓDIGO", "SIGLAS", "NOMBRE INSTITUCIÓN", "TIPO"];
        
        headers.forEach((h, i) => {
            const w = Object.values(colWidths)[i];
            doc.rect(headX, y, w, rowHeight).stroke();
            doc.text(h, headX, y + 5, { width: w, align: 'center' });
            headX += w;
        });
        return y + rowHeight;
    };

    addHeader(doc, logoPath, usuarioReporte);

    try {
        const [rows] = await db.query("SELECT CodigoInst, siglas, nbinstitucion, tpinstitucion FROM instituciones ORDER BY CodigoInst ASC");

        let currentY = 130; 
        const rowHeight = 20;
        const colWidths = { cod: 60, sig: 80, nom: 270, tip: 85 };

        currentY = drawTableHeader(doc, currentY);
        doc.font('Helvetica').fontSize(8);

        rows.forEach((inst, index) => {
            // Control manual estricto: máximo 22 filas por página
            if (index > 0 && index % 22 === 0) {
                doc.addPage();
                addHeader(doc, logoPath, usuarioReporte);
                currentY = 130;
                currentY = drawTableHeader(doc, currentY);
                doc.font('Helvetica').fontSize(8);
            }

            if ((index + 1) % 2 === 0) {
                doc.fillColor('#FFFFE0').rect(50, currentY, 495, rowHeight).fill();
            }

            doc.fillColor('#000000');
            let rX = 50;
            
            const dataArr = [inst.CodigoInst, inst.siglas, inst.nbinstitucion, inst.tpinstitucion];
            const keys = Object.keys(colWidths);

            dataArr.forEach((val, i) => {
                const w = colWidths[keys[i]];
                doc.rect(rX, currentY, w, rowHeight).stroke();
                doc.text(val?.toString() || '', rX + (i === 2 ? 5 : 0), currentY + 6, { 
                    width: i === 2 ? w - 10 : w, 
                    align: i === 2 ? 'left' : 'center',
                    lineBreak: false 
                });
                rX += w;
            });

            currentY += rowHeight;
        });

        // --- ESTAMPADO FINAL (FOOTER FIJO) ---
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < (range.start + range.count); i++) {
            doc.switchToPage(i);
            
            // Definimos la base del footer bien abajo (A4 tiene ~841 de alto)
            const footerBaseY = 610; 

            // 1. Línea negra
            doc.moveTo(50, footerBaseY).lineTo(545, footerBaseY).lineWidth(0.5).stroke();
            
            // 2. Texto centrado (Dos líneas)
            doc.fontSize(9).font('Helvetica').fillColor('#000000');
            doc.text("Para Mayor Información Visite nuestro instagram @gradosdevzla", 50, footerBaseY + 10, { 
                align: 'center', 
                width: 495 
            });
            doc.text("o escribanos a los correos info.gradosdevzla@gmail.com", 50, footerBaseY + 22, { 
                align: 'center', 
                width: 495 
            });

            // 3. Numeración abajo a la derecha (independiente)
            doc.fontSize(8).font('Helvetica-Bold')
                .text(`Página ${i + 1} / ${range.count}`, 50, footerBaseY + 200, { 
                    align: 'right', 
                    width: 495 
                });
        }

    } catch (err) {
        console.error(err);
    }
    doc.end();
};

exports.institutionsExcel = async (req, res) => {
    try {
        const { usuarioReporte } = req.params;
        const [rows] = await db.query("SELECT CodigoInst, siglas, nbinstitucion, tpinstitucion FROM instituciones ORDER BY CodigoInst ASC");

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte Instituciones');

        // 1. Logo centrado en área A2
        const logoPath = path.join(__dirname, 'logo.png');
        const logoId = workbook.addImage({ filename: logoPath, extension: 'png' });
        worksheet.addImage(logoId, {
            tl: { col: 0.2, row: 1.2 },
            ext: { width: 60, height: 40 },
            editAs: 'oneCell'
        });
        worksheet.getRow(2).height = 50;

        // 2. Info Empresa
        const empresaCell = worksheet.getCell('B2');
        empresaCell.value = "Grado`s de Venezuela, C.A.\nJ-30591547-4";
        empresaCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        empresaCell.font = { name: 'Arial', bold: true, size: 9 };

        // 3. Metadatos
        const fechaActual = new Date().toLocaleDateString('es-VE');
        const horaActual = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
        const metaCell = worksheet.getCell('D2');
        metaCell.value = `Fecha: ${fechaActual}\nHora: ${horaActual}\nUsuario: ${usuarioReporte}`;
        metaCell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        metaCell.font = { name: 'Arial', size: 8 };

        // 4. Título con borde inferior
        ['A', 'B', 'C', 'D'].forEach(col => worksheet.getCell(`${col}5`).border = { bottom: { style: 'thin' } });
        worksheet.mergeCells('A6:D6');
        const tCell = worksheet.getCell('A6');
        tCell.value = "Reporte de Instituciones";
        tCell.font = { bold: true, size: 13 };
        tCell.alignment = { horizontal: 'center' };
        ['A', 'B', 'C', 'D'].forEach(col => worksheet.getCell(`${col}6`).border = { bottom: { style: 'thin' } });

        // 5. Configuración Columnas
        worksheet.columns = [
            { key: 'cod', width: 12 },
            { key: 'sig', width: 15 },
            { key: 'nom', width: 50 },
            { key: 'tip', width: 20 }
        ];

        // 6. Cabeceras
        const hRow = worksheet.getRow(8);
        hRow.values = ["CÓDIGO", "SIGLAS", "NOMBRE INSTITUCIÓN", "TIPO"];
        hRow.eachCell(c => {
            c.font = { bold: true, color: { argb: '000000' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } }; // Cabecera negra para contraste
            c.alignment = { horizontal: 'center' };
            c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
        });

        // 7. Datos
        rows.forEach((inst, index) => {
            const row = worksheet.addRow([inst.CodigoInst, inst.siglas, inst.nbinstitucion, inst.tpinstitucion]);
            const esPar = (index + 1) % 2 === 0;
            row.eachCell((cell, colNum) => {
                cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
                cell.alignment = { horizontal: colNum === 3 ? 'left' : 'center', vertical: 'middle' };
                // Efecto cebra
                if (esPar) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0' } };
                }
            });
        });

        // 8. Footer (Línea + 2 filas de texto)
        const lastRowNumber = worksheet.lastRow.number;
        const lineRow = lastRowNumber + 2;

        // Línea divisoria
        ['A', 'B', 'C', 'D'].forEach(col => {
            worksheet.getCell(`${col}${lineRow}`).border = { bottom: { style: 'thin' } };
        });
        
        // Fila 1: Instagram
        const rowF1 = lineRow + 1;
        worksheet.mergeCells(`A${rowF1}:D${rowF1}`);
        const f1 = worksheet.getCell(`A${rowF1}`);
        f1.value = "Para Mayor Información Visite nuestro instagram @gradosdevzla";
        f1.alignment = { horizontal: 'center' };
        f1.font = { name: 'Arial', size: 9 };

        // Fila 2: Correo
        const rowF2 = lineRow + 2;
        worksheet.mergeCells(`A${rowF2}:D${rowF2}`);
        const f2 = worksheet.getCell(`A${rowF2}`);
        f2.value = "o escribanos a los correos info.gradosdevzla@gmail.com";
        f2.alignment = { horizontal: 'center' };
        f2.font = { name: 'Arial', size: 9 };

        // Configuración de descarga
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=reporte-instituciones.xlsx');
        
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).send("Error al generar el Excel");
    }
};

exports.actPlacesPdf = async (req, res) => {
    const { usuarioReporte } = req.params;

    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 20, left: 50, right: 50 },
        bufferPages: true 
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=reporte-lugares.pdf');
    doc.pipe(res);

    const logoPath = path.join(__dirname, 'logo.png'); 

    const addHeader = (doc, logoPath, usuario) => {
        try {
            doc.image(logoPath, 50, 35, { width: 65 });
        } catch (error) {
            console.log("Error logo");
        }

        doc.fontSize(9).font('Helvetica-Bold')
            .text("Grado`s de Venezuela, C.A.", 130, 40)
            .font('Helvetica').text("J-30591547-4", 130, 52);

        const fechaActual = new Date().toLocaleDateString('es-VE');
        const horaActual = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });

        doc.fontSize(8).font('Helvetica')
            .text(`Fecha: ${fechaActual}`, 350, 40, { align: 'right' })
            .text(`Hora: ${horaActual}`, 350, 50, { align: 'right' })
            .text(`Usuario: ${usuario}`, 350, 60, { align: 'right' });

        doc.moveTo(50, 85).lineTo(545, 85).lineWidth(0.5).stroke();
        doc.fontSize(12).font('Helvetica-Bold').text("Reporte de Lugares de Acto", 50, 95, { align: 'center' });
        doc.moveTo(50, 115).lineTo(545, 115).lineWidth(0.5).stroke();
    };

    const drawTableHeader = (doc, y) => {
        const colWidths = { codigo: 60, nombre: 250, capacidad: 100, tipo: 85 };
        const rowHeight = 20;
        doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
        let headX = 50;
        const headers = ["CODIGO", "NOMBRE DEL LUGAR DE ACTOS", "CAPACIDAD", "TIPO"];
        
        headers.forEach((h, i) => {
            const keys = ['codigo', 'nombre', 'capacidad', 'tipo'];
            const w = colWidths[keys[i]];
            doc.rect(headX, y, w, rowHeight).stroke();
            doc.text(h, headX, y + 5, { width: w, align: 'center' });
            headX += w;
        });
        return y + rowHeight;
    };

    addHeader(doc, logoPath, usuarioReporte);

    try {
        const [lugares] = await db.query("SELECT CoLugar, TxLugar, Capacidad, MaTipoLugar FROM lugaracto WHERE Activo = 1 ORDER BY CoLugar ASC");

        let currentY = 130; 
        const rowHeight = 20;
        const colWidths = { codigo: 60, nombre: 250, capacidad: 100, tipo: 85 };

        currentY = drawTableHeader(doc, currentY);
        doc.font('Helvetica').fontSize(8);

        lugares.forEach((lugar, index) => {
            // Máximo 25 filas para asegurar que el footer dinámico no rompa la página
            if (index > 0 && index % 25 === 0) {
                doc.addPage();
                addHeader(doc, logoPath, usuarioReporte);
                currentY = 130;
                currentY = drawTableHeader(doc, currentY);
                doc.font('Helvetica').fontSize(8);
            }

            if ((index + 1) % 2 === 0) {
                doc.fillColor('#FFFFE0').rect(50, currentY, 495, rowHeight).fill();
            }

            doc.fillColor('#000000');
            let rowX = 50;
            
            doc.rect(rowX, currentY, colWidths.codigo, rowHeight).stroke();
            doc.text(lugar.CoLugar.toString(), rowX, currentY + 6, { width: colWidths.codigo, align: 'center' });
            rowX += colWidths.codigo;

            doc.rect(rowX, currentY, colWidths.nombre, rowHeight).stroke();
            doc.text(lugar.TxLugar || '', rowX + 5, currentY + 6, { width: colWidths.nombre - 10, lineBreak: false });
            rowX += colWidths.nombre;

            doc.rect(rowX, currentY, colWidths.capacidad, rowHeight).stroke();
            doc.text(lugar.Capacidad?.toString() || '0', rowX, currentY + 6, { width: colWidths.capacidad, align: 'center' });
            rowX += colWidths.capacidad;

            doc.rect(rowX, currentY, colWidths.tipo, rowHeight).stroke();
            const tipoLabel = lugar.MaTipoLugar == 1 ? 'Teatro Techado' : 'Salón / Otros';
            doc.text(tipoLabel, rowX, currentY + 6, { width: colWidths.tipo, align: 'center' });

            currentY += rowHeight;
        });

        // --- ESTAMPADO FINAL (ADAPTATIVO) ---
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < (range.start + range.count); i++) {
            doc.switchToPage(i);
            
            // Si es la última página, lo pega a la tabla. Si no, lo deja abajo.
            const isLastPage = (i === (range.start + range.count - 1));
            let footerBaseY = isLastPage ? currentY + 15 : 750;

            // Limite de seguridad para que no se salga de la hoja si la tabla es muy larga
            if (footerBaseY > 760) footerBaseY = 760;

            // 1. Línea negra
            doc.moveTo(50, footerBaseY).lineTo(545, footerBaseY).lineWidth(0.5).stroke();
            
            // 2. Texto centrado
            doc.fontSize(9).font('Helvetica').fillColor('#000000');
            doc.text("Para Mayor Información Visite nuestro instagram @gradosdevzla", 50, footerBaseY + 10, { 
                align: 'center', 
                width: 495 
            });
            doc.text("o escribanos a los correos info.gradosdevzla@gmail.com", 50, footerBaseY + 22, { 
                align: 'center', 
                width: 495 
            });

            // 3. Numeración (Fija al final para que no baile)
            doc.fontSize(8).font('Helvetica-Bold')
                .text(`Página ${i + 1} / ${range.count}`, 50, 785, { 
                    align: 'right', 
                    width: 495 
                });
        }

    } catch (err) {
        console.error(err);
    }
    doc.end();
};

exports.actPlacesExcel = async (req, res) => {
    try {
        // Recibir el usuario desde el body
        const { usuarioReporte } = req.params;

        const [lugares] = await db.query("SELECT CoLugar, TxLugar, Capacidad, MaTipoLugar FROM lugaracto WHERE Activo = 1 ORDER BY CoLugar ASC");

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte de Lugares de Acto');

        // 1. LOGO (Ubicado a la izquierda)
        const logoPath = path.join(__dirname, 'logo.png');
        const logoId = workbook.addImage({
            filename: logoPath,
            extension: 'png',
        });
        
        worksheet.addImage(logoId, {
            tl: { col: 0.2, row: 1.2 },
            ext: { width: 60, height: 40 },
            editAs: 'onCell'
        });

        worksheet.getRow(2).height = 50;

        // 2. INFO EMPRESA (Al lado del logo)
        const empresaCell = worksheet.getCell('B2');
        empresaCell.value = "Grado`s de Venezuela, C.A.\nJ-30591547-4";
        empresaCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        empresaCell.font = { name: 'Arial', bold: true, size: 9 };

        // 3. METADATOS (Fecha, Hora, Usuario a la derecha)
        const fechaActual = new Date().toLocaleDateString('es-VE');
        const horaActual = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });

        const metaCell = worksheet.getCell('D2');
        metaCell.value = `Fecha: ${fechaActual}\nHora: ${horaActual}\nUsuario: ${usuarioReporte}`;
        metaCell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        metaCell.font = { name: 'Arial', size: 8 };
        worksheet.getRow(2).height = 45; // Ajustar altura para que quepan las 3 líneas

        // 4. TÍTULO CON LÍNEAS (Rango A a D)
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

        // 5. CABECERA DE TABLA (Fila 8)
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

        // 6. DATOS
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

        // 7. CIERRE DE TABLA Y LÍNEA DE FOOTER
        const lastDataRow = currentRow - 1;
        ['A', 'B', 'C', 'D'].forEach(col => {
            const cell = worksheet.getCell(`${col}${lastDataRow}`);
            cell.border = { ...cell.border, bottom: { style: 'thin' } };
        });

        // Espacio de una fila y línea separadora
        const lineSeparatorRow = currentRow + 1; 
        ['A', 'B', 'C', 'D'].forEach(col => {
            worksheet.getCell(`${col}${lineSeparatorRow}`).border = { bottom: { style: 'thin' } };
        });

        // 8. TEXTO DEL FOOTER
        const footerStart = lineSeparatorRow + 1;
        worksheet.mergeCells(`A${footerStart}:D${footerStart}`);
        worksheet.mergeCells(`A${footerStart + 1}:D${footerStart + 1}`);

        const f1 = worksheet.getCell(`A${footerStart}`);
        const f2 = worksheet.getCell(`A${footerStart + 1}`);

        f1.value = "Para Mayor Información Visite nuestro instagram @gradosdevzla";
        f2.value = "o escribanos a los correos info.gradosdevzla@gmail.com";

        [f1, f2].forEach(cell => {
            cell.alignment = { horizontal: 'center' };
            cell.font = { name: 'Arial', size: 10 };
        });

        // 9. ENVÍO
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=reporte-lugares.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).send("Error al generar Excel");
    }
};

exports.getClientsPdf = async (req, res) => {
    
}