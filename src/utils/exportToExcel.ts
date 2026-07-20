import ExcelJS from 'exceljs';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface ExcelHeaderInfo {
  branchName?: string;
  branchId?: string | number;
  address?: string;
  phone?: string;
  reportTitle?: string;
  dateRange?: string;
}

export async function exportToExcel(
  rows: (string | number | boolean | null | undefined)[][],
  filename: string,
  sheetName: string = 'Report',
  headerInfo?: ExcelHeaderInfo
) {
  if (!rows || rows.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  // 1. Prepend Store / Branch Header metadata at the top if provided
  if (headerInfo) {
    if (headerInfo.reportTitle) {
      const r = worksheet.addRow([headerInfo.reportTitle.toUpperCase()]);
      r.getCell(1).font = { bold: true, name: 'Calibri', size: 14, color: { argb: 'FF1E293B' } };
    }
    if (headerInfo.branchName) {
      const r = worksheet.addRow([`Branch Name: ${headerInfo.branchName}`]);
      r.getCell(1).font = { bold: true, name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
    }
    if (headerInfo.branchId !== undefined && headerInfo.branchId !== null) {
      const r = worksheet.addRow([`Branch ID: ${headerInfo.branchId}`]);
      r.getCell(1).font = { bold: true, name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
    }
    if (headerInfo.address) {
      const r = worksheet.addRow([`Address: ${headerInfo.address}`]);
      r.getCell(1).font = { bold: true, name: 'Calibri', size: 11, color: { argb: 'FF334155' } };
    }
    if (headerInfo.phone) {
      const r = worksheet.addRow([`Phone: ${headerInfo.phone}`]);
      r.getCell(1).font = { bold: true, name: 'Calibri', size: 11, color: { argb: 'FF334155' } };
    }
    if (headerInfo.dateRange) {
      const r = worksheet.addRow([`Date Range: ${headerInfo.dateRange}`]);
      r.getCell(1).font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF64748B' } };
    }

    // Blank line separator before table
    worksheet.addRow([]);
  }

  // Explicit thin border for table cells
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };

  // Populate table data rows and format table cells
  rows.forEach((rowData) => {
    const row = worksheet.addRow(rowData);
    const firstVal = String(rowData[0] || '').trim().toUpperCase();
    const isSectionHeader = firstVal.startsWith('BRANCH:') || firstVal.startsWith('STORE:');
    const isTotal = firstVal.includes('TOTAL');
    const isTableColumnHeader = firstVal === 'BILL NUMBER' || firstVal === 'INVOICE NO' || firstVal === 'DATE';
    const isEmptyRow = rowData.length === 0 || rowData.every(v => v === '' || v === null || v === undefined);

    if (isEmptyRow) {
      return;
    }

    row.eachCell({ includeEmpty: true }, (cell) => {
      if (isSectionHeader) {
        cell.font = { bold: true, name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFCBD5E1' } // Slate subheader background
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (isTableColumnHeader) {
        cell.border = thinBorder;
        cell.font = { bold: true, name: 'Calibri', size: 11 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' } // Light slate table header fill
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (isTotal) {
        cell.border = thinBorder;
        cell.font = { bold: true, name: 'Calibri', size: 11 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' } // Light totals fill
        };
      } else {
        cell.border = thinBorder;
        cell.font = { name: 'Calibri', size: 11 };
      }
    });
  });

  // Calculate auto column widths
  worksheet.columns.forEach((column) => {
    let maxLen = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      if (cell.value !== null && cell.value !== undefined) {
        const len = String(cell.value).length;
        if (len > maxLen) maxLen = len;
      }
    });
    column.width = Math.min(maxLen + 4, 60);
  });

  // Write workbook to Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  // Android APK Native File Saving & Sharing Handler
  if (Capacitor.getPlatform() === 'android') {
    try {
      // Convert buffer array to base64 string
      const bytes = new Uint8Array(buffer as ArrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      // Save file to Android Cache directory
      const savedFile = await Filesystem.writeFile({
        path: finalFilename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      // Trigger native Android Share/Save picker
      await Share.share({
        title: finalFilename,
        text: `Exported Report: ${finalFilename}`,
        url: savedFile.uri,
        dialogTitle: 'Save or Open Excel Report'
      });
      return;
    } catch (err) {
      console.error('Android native export error, falling back to browser download:', err);
    }
  }

  // Web Browser & Electron Desktop fallback download
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  a.click();
  URL.revokeObjectURL(url);
}
