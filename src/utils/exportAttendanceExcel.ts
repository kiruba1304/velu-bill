import ExcelJS from 'exceljs';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface AttendanceBranchInfo {
  name?: string;
  id?: string | number;
  address?: string;
  phone?: string;
}

export async function exportAttendanceExcel(
  allUsers: any[],
  monthlyRecords: any[],
  selectedMonth: number,
  selectedYear: number,
  branchInfo?: AttendanceBranchInfo,
  holidays: any[] = [],
  searchTerm: string = ''
) {
  const monthName = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('default', { month: 'long' });
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const filename = `Attendance_Report_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`;

  // Filter users matching branch and search criteria
  const filteredUsers = allUsers.filter(u => {
    if (u.role === 'super_admin') return false;
    if (branchInfo?.id !== undefined && branchInfo?.id !== 0 && u.branchId !== branchInfo.id) {
      return false;
    }
    return (u.name || '').toLowerCase().includes((searchTerm || '').toLowerCase());
  });

  const workbook = new ExcelJS.Workbook();

  // Thin border definition
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
  };

  // -------------------------------------------------------------
  // SHEET 1: MONTHLY MATRIX OVERVIEW
  // -------------------------------------------------------------
  const matrixSheet = workbook.addWorksheet('Monthly Overview', {
    views: [{ showGridLines: true }]
  });

  // 1. Report Title Header Block
  const titleRow = matrixSheet.addRow(['MONTHLY ATTENDANCE OVERVIEW REPORT']);
  titleRow.getCell(1).font = { bold: true, name: 'Calibri', size: 16, color: { argb: 'FF1E293B' } };
  matrixSheet.mergeCells(1, 1, 1, Math.min(daysInMonth + 4, 10));

  if (branchInfo?.name) {
    const branchRow = matrixSheet.addRow([`Branch: ${branchInfo.name}${branchInfo.id ? ` (ID: ${branchInfo.id})` : ''}`]);
    branchRow.getCell(1).font = { bold: true, name: 'Calibri', size: 11, color: { argb: 'FF334155' } };
  }

  if (branchInfo?.address || branchInfo?.phone) {
    const contactText = [branchInfo.address, branchInfo.phone ? `Phone: ${branchInfo.phone}` : ''].filter(Boolean).join(' | ');
    const contactRow = matrixSheet.addRow([contactText]);
    contactRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
  }

  const periodRow = matrixSheet.addRow([`Period: ${monthName} ${selectedYear} | Total Days: ${daysInMonth} | Generated: ${new Date().toLocaleString()}`]);
  periodRow.getCell(1).font = { italic: true, name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };

  matrixSheet.addRow([]); // Empty spacing row

  // 2. Executive KPI Summary Block
  let totalPresentOverall = 0;
  let totalAbsentOverall = 0;
  let totalLeaveOverall = 0;
  let totalHalfOverall = 0;

  filteredUsers.forEach(u => {
    const userRecs = monthlyRecords.filter(r => r.userId === u.id);
    userRecs.forEach(r => {
      if (r.status === 'present') totalPresentOverall++;
      else if (r.status === 'absent') totalAbsentOverall++;
      else if (r.status === 'leave') totalLeaveOverall++;
      else if (r.status === 'half_day') totalHalfOverall++;
    });
  });

  const grandTotalMarked = totalPresentOverall + totalAbsentOverall + totalLeaveOverall + totalHalfOverall;
  const overallAttendancePct = grandTotalMarked > 0 
    ? Math.round(((totalPresentOverall + totalHalfOverall * 0.5) / grandTotalMarked) * 100) 
    : 0;

  const kpiRow1 = matrixSheet.addRow(['EXECUTIVE SUMMARY']);
  kpiRow1.getCell(1).font = { bold: true, name: 'Calibri', size: 11, color: { argb: 'FF1E293B' } };

  const summaryHeaders = ['Total Employees', 'Total Present Days', 'Total Absent Days', 'Total Leaves', 'Total Half Days', 'Overall Attendance %'];
  const summaryValues = [filteredUsers.length, totalPresentOverall, totalAbsentOverall, totalLeaveOverall, totalHalfOverall, `${overallAttendancePct}%`];

  const sumHeaderRow = matrixSheet.addRow(summaryHeaders);
  sumHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, name: 'Calibri', size: 10, color: { argb: 'FF475569' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const sumValRow = matrixSheet.addRow(summaryValues);
  sumValRow.eachCell((cell, colIndex) => {
    cell.font = { bold: true, name: 'Calibri', size: 12, color: { argb: colIndex === 6 ? 'FF0D9488' : 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  matrixSheet.addRow([]); // Empty spacing row

  // 3. Main Matrix Grid Header
  const dayHeaderTitles: string[] = ['S.No', 'Employee Name', 'Role'];
  const dayOfWeekAbbrs = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(selectedYear, selectedMonth - 1, day);
    const dayOfWeek = dayOfWeekAbbrs[dt.getDay()];
    dayHeaderTitles.push(`${day}\n(${dayOfWeek})`);
  }

  dayHeaderTitles.push('P', 'A', 'L', 'HD', 'Worked Days', 'Attendance %');

  const matrixHeaderRow = matrixSheet.addRow(dayHeaderTitles);
  matrixHeaderRow.height = 28;

  matrixHeaderRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, name: 'Calibri', size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colNumber <= 3 ? 'FF1E293B' : colNumber > 3 + daysInMonth ? 'FF0F172A' : 'FF334155' }
    };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  // Track daily present / absent counts for bottom summary
  const dailyPresentCounts = new Array(daysInMonth).fill(0);
  const dailyAbsentCounts = new Array(daysInMonth).fill(0);

  // 4. Populate Employee Data Rows
  filteredUsers.forEach((user, index) => {
    const userRecs = monthlyRecords.filter(r => r.userId === user.id);
    const rowValues: any[] = [index + 1, user.name, user.role || 'Employee'];

    let pCount = 0;
    let aCount = 0;
    let lCount = 0;
    let hdCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const rec = userRecs.find(r => r.date === dateStr);
      const dt = new Date(selectedYear, selectedMonth - 1, day);
      const isSunday = dt.getDay() === 0;
      const isHoliday = holidays.some(h => h.date === dateStr);

      if (rec) {
        if (rec.status === 'present') {
          rowValues.push('P');
          pCount++;
          dailyPresentCounts[day - 1]++;
        } else if (rec.status === 'absent') {
          rowValues.push('A');
          aCount++;
          dailyAbsentCounts[day - 1]++;
        } else if (rec.status === 'leave') {
          rowValues.push('L');
          lCount++;
        } else if (rec.status === 'half_day') {
          rowValues.push('HD');
          hdCount++;
          dailyPresentCounts[day - 1] += 0.5;
        } else {
          rowValues.push('-');
        }
      } else if (isHoliday) {
        rowValues.push('H');
      } else if (isSunday) {
        rowValues.push('OFF');
      } else {
        rowValues.push('-');
      }
    }

    const totalWorked = pCount + hdCount * 0.5;
    const totalDaysRecorded = pCount + aCount + lCount + hdCount;
    const attPct = totalDaysRecorded > 0 ? Math.round((totalWorked / totalDaysRecorded) * 100) : 0;

    rowValues.push(pCount, aCount, lCount, hdCount, totalWorked, `${attPct}%`);

    const dataRow = matrixSheet.addRow(rowValues);
    dataRow.height = 20;

    dataRow.eachCell((cell, colIndex) => {
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 10 };

      if (colIndex === 1) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIndex === 2 || colIndex === 3) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        if (colIndex === 2) cell.font = { bold: true, name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      } else if (colIndex > 3 && colIndex <= 3 + daysInMonth) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        const val = String(cell.value || '');
        if (val === 'P') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Light emerald
          cell.font = { bold: true, color: { argb: 'FF166534' } };
        } else if (val === 'A') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Light red
          cell.font = { bold: true, color: { argb: 'FF991B1B' } };
        } else if (val === 'L') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } }; // Light purple
          cell.font = { bold: true, color: { argb: 'FF6B21A8' } };
        } else if (val === 'HD') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Light amber
          cell.font = { bold: true, color: { argb: 'FF92400E' } };
        } else if (val === 'H') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } }; // Light yellow
          cell.font = { bold: true, color: { argb: 'FF854D0E' } };
        } else if (val === 'OFF') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Light slate
          cell.font = { color: { argb: 'FF64748B' } };
        } else {
          cell.font = { color: { argb: 'FF94A3B8' } };
        }
      } else {
        // Summary columns (P, A, L, HD, Worked Days, Att %)
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { bold: true, name: 'Calibri', size: 10 };
        if (colIndex === 4 + daysInMonth) cell.font = { bold: true, color: { argb: 'FF166534' } };
        else if (colIndex === 5 + daysInMonth) cell.font = { bold: true, color: { argb: 'FF991B1B' } };
        else if (colIndex === 6 + daysInMonth) cell.font = { bold: true, color: { argb: 'FF6B21A8' } };
        else if (colIndex === 7 + daysInMonth) cell.font = { bold: true, color: { argb: 'FF92400E' } };
        else if (colIndex === 9 + daysInMonth) cell.font = { bold: true, color: { argb: 'FF0D9488' } };
      }
    });
  });

  // 5. Matrix Bottom Total Row (Daily Present Counts)
  const totalPresentRowValues: any[] = ['-', 'DAILY PRESENT COUNT', 'Total Present'];
  dailyPresentCounts.forEach(cnt => totalPresentRowValues.push(cnt));
  totalPresentRowValues.push(totalPresentOverall, '-', '-', totalHalfOverall, '-', '-');

  const totalPresentRow = matrixSheet.addRow(totalPresentRowValues);
  totalPresentRow.height = 22;
  totalPresentRow.eachCell((cell, colIdx) => {
    cell.border = thinBorder;
    cell.font = { bold: true, name: 'Calibri', size: 10, color: { argb: 'FF166534' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
    cell.alignment = { horizontal: colIdx === 2 ? 'left' : 'center', vertical: 'middle' };
  });

  // Calculate auto column widths for Sheet 1
  matrixSheet.columns.forEach((column, colIdx) => {
    if (colIdx === 1) column.width = 6;
    else if (colIdx === 2) column.width = 24;
    else if (colIdx === 3) column.width = 14;
    else if (colIdx > 3 && colIdx <= 3 + daysInMonth) column.width = 7;
    else column.width = 12;
  });

  // -------------------------------------------------------------
  // SHEET 2: DETAILED TIMINGS & NOTES LOG
  // -------------------------------------------------------------
  const logSheet = workbook.addWorksheet('Daily Timings Log', {
    views: [{ showGridLines: true }]
  });

  // Title Row for Sheet 2
  const logTitleRow = logSheet.addRow([`DETAILED ATTENDANCE LOGS - ${monthName.toUpperCase()} ${selectedYear}`]);
  logTitleRow.getCell(1).font = { bold: true, name: 'Calibri', size: 14, color: { argb: 'FF1E293B' } };
  logSheet.addRow([]);

  // Table Headers
  const logHeaders = ['Date', 'Day', 'Employee Name', 'Role', 'Status', 'Check-In Time', 'Check-Out Time', 'Notes'];
  const logHeaderRow = logSheet.addRow(logHeaders);
  logHeaderRow.height = 24;

  logHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, name: 'Calibri', size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Sort monthly records by date ascending then user name
  const sortedRecords = [...monthlyRecords].filter(r => {
    const userObj = filteredUsers.find(u => u.id === r.userId);
    return !!userObj;
  }).sort((a, b) => a.date.localeCompare(b.date));

  sortedRecords.forEach(rec => {
    const userObj = filteredUsers.find(u => u.id === rec.userId);
    if (!userObj) return;

    const dateObj = new Date(rec.date);
    const dayOfWeek = isNaN(dateObj.getTime()) ? '' : dayOfWeekAbbrs[dateObj.getDay()];
    const statusLabel = rec.status === 'present' ? 'Present' : rec.status === 'absent' ? 'Absent' : rec.status === 'leave' ? 'Leave' : rec.status === 'half_day' ? 'Half Day' : rec.status;

    const logRow = logSheet.addRow([
      rec.date,
      dayOfWeek,
      userObj.name,
      userObj.role || 'Employee',
      statusLabel,
      rec.checkInTime || '--:--',
      rec.checkOutTime || '--:--',
      rec.notes || '-'
    ]);

    logRow.eachCell((cell, colIndex) => {
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 10 };
      if (colIndex === 1 || colIndex === 2 || colIndex === 6 || colIndex === 7) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIndex === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { bold: true, name: 'Calibri', size: 10 };
        if (rec.status === 'present') cell.font = { bold: true, color: { argb: 'FF166534' } };
        else if (rec.status === 'absent') cell.font = { bold: true, color: { argb: 'FF991B1B' } };
        else if (rec.status === 'leave') cell.font = { bold: true, color: { argb: 'FF6B21A8' } };
        else if (rec.status === 'half_day') cell.font = { bold: true, color: { argb: 'FF92400E' } };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  // Calculate auto column widths for Sheet 2
  logSheet.columns.forEach((column) => {
    let maxLen = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      if (cell.value !== null && cell.value !== undefined) {
        const len = String(cell.value).length;
        if (len > maxLen) maxLen = len;
      }
    });
    column.width = Math.min(maxLen + 4, 50);
  });

  // -------------------------------------------------------------
  // SAVE / DOWNLOAD FILE
  // -------------------------------------------------------------
  const buffer = await workbook.xlsx.writeBuffer();

  // Android platform handler
  if (Capacitor.getPlatform() === 'android') {
    try {
      const bytes = new Uint8Array(buffer as ArrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      await Share.share({
        title: filename,
        text: `Attendance Overview Report: ${filename}`,
        url: savedFile.uri,
        dialogTitle: 'Save or Open Attendance Excel Report'
      });
      return;
    } catch (err) {
      console.error('Android export error, falling back to browser download:', err);
    }
  }

  // Web Browser & Electron Desktop download
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
