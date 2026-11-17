import ExcelJS from 'exceljs';
import { formatRupiah } from '../calculations';

export interface ExcelCellData {
  value: string;
  rawValue: any;
  type: 'text' | 'number' | 'currency' | 'badge';
  badgeVariant?: 'income' | 'expense' | 'transfer' | 'success' | 'warning' | 'info';
  align: 'left' | 'center' | 'right';
  isBold?: boolean;
}

export interface ExcelSheetData {
  id: string;
  name: string;
  rowCount: number;
  colCount: number;
  headers: string[];
  rows: ExcelCellData[][];
}

export interface ExcelWorkbookPreviewData {
  filename: string;
  sheets: ExcelSheetData[];
  totalSheets: number;
  totalRows: number;
  wb?: ExcelJS.Workbook;
}

/**
 * Clean extract primitive text / value from any ExcelJS cell
 */
function extractCellValue(cell: ExcelJS.Cell): { text: string; raw: any } {
  const val = cell.value;
  if (val === null || val === undefined) {
    return { text: '', raw: null };
  }

  // Handle formula objects e.g. { formula: 'SUM(A1:A5)', result: 50000 }
  if (typeof val === 'object' && 'result' in val) {
    const res = (val as any).result;
    return { text: res !== null && res !== undefined ? String(res) : '', raw: res };
  }

  // Handle RichText objects e.g. { richText: [...] }
  if (typeof val === 'object' && 'richText' in val) {
    const text = (val as any).richText.map((t: any) => t.text || '').join('');
    return { text, raw: text };
  }

  // Handle Date objects
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    return { text: dateStr, raw: val };
  }

  // Handle Hyperlink objects e.g. { text: 'Link', hyperlink: '...' }
  if (typeof val === 'object' && 'text' in val) {
    return { text: String((val as any).text), raw: val };
  }

  return { text: String(val).trim(), raw: val };
}

/**
 * Format cell data with visual metadata for rich spreadsheet rendering
 */
function formatCellData(cell: ExcelJS.Cell, colIndex: number, isHeaderRow: boolean): ExcelCellData {
  const { text, raw } = extractCellValue(cell);
  const isBold = Boolean(cell.font?.bold || isHeaderRow);
  const numFmt = cell.numFmt || '';

  // Header styling
  if (isHeaderRow) {
    return {
      value: text,
      rawValue: raw,
      type: 'text',
      align: 'center',
      isBold: true,
    };
  }

  // Badges recognition
  const upper = text.toUpperCase();
  if (upper === 'INCOME' || upper === 'PEMASUKAN' || upper === 'LUNAS' || upper === 'AKTIF') {
    return {
      value: text,
      rawValue: raw,
      type: 'badge',
      badgeVariant: 'income',
      align: 'center',
      isBold: true,
    };
  }
  if (upper === 'EXPENSE' || upper === 'PENGELUARAN' || upper === 'NONAKTIF') {
    return {
      value: text,
      rawValue: raw,
      type: 'badge',
      badgeVariant: 'expense',
      align: 'center',
      isBold: true,
    };
  }
  if (upper === 'TRANSFER' || upper === 'MUTASI') {
    return {
      value: text,
      rawValue: raw,
      type: 'badge',
      badgeVariant: 'transfer',
      align: 'center',
      isBold: true,
    };
  }
  if (upper === 'BELUM LUNAS' || upper === 'SEBAGIAN') {
    return {
      value: text,
      rawValue: raw,
      type: 'badge',
      badgeVariant: 'warning',
      align: 'center',
      isBold: true,
    };
  }

  // Number / Currency detection
  const isCurrencyFmt =
    numFmt.toLowerCase().includes('rp') ||
    numFmt.toLowerCase().includes('$') ||
    numFmt.includes('#,##0');

  if (typeof raw === 'number') {
    if (isCurrencyFmt || Math.abs(raw) >= 1000) {
      return {
        value: formatRupiah(raw),
        rawValue: raw,
        type: 'currency',
        align: 'right',
        isBold,
      };
    }
    return {
      value: raw.toLocaleString('id-ID'),
      rawValue: raw,
      type: 'number',
      align: 'right',
      isBold,
    };
  }

  // If text is purely numeric with currency pattern
  const numericOnly = Number(text.replace(/[^0-9.-]/g, ''));
  if (text.startsWith('Rp') && !isNaN(numericOnly)) {
    return {
      value: formatRupiah(numericOnly),
      rawValue: numericOnly,
      type: 'currency',
      align: 'right',
      isBold,
    };
  }

  // Dates (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return {
      value: text,
      rawValue: raw,
      type: 'text',
      align: 'center',
      isBold,
    };
  }

  return {
    value: text,
    rawValue: raw,
    type: 'text',
    align: cell.alignment?.horizontal ? (cell.alignment.horizontal as any) : 'left',
    isBold,
  };
}

/**
 * Convert an ExcelJS Workbook into clean, serializable preview data
 */
export function convertWorkbookToPreviewData(
  wb: ExcelJS.Workbook,
  filename: string = 'Laporan.xlsx'
): ExcelWorkbookPreviewData {
  const sheets: ExcelSheetData[] = [];
  let grandTotalRows = 0;

  wb.eachSheet((ws, sheetId) => {
    const rawRows: ExcelJS.Row[] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      rawRows.push(row);
    });

    if (rawRows.length === 0) return;

    // Determine max column index
    let maxCols = 0;
    rawRows.forEach((row) => {
      if (row.actualCellCount > maxCols) {
        maxCols = Math.max(maxCols, row.cellCount);
      }
    });
    maxCols = Math.max(maxCols, 1);

    // Determine visible column indices (skip hidden columns e.g. technical UUIDs)
    const visibleCols: number[] = [];
    for (let c = 1; c <= maxCols; c++) {
      if (!ws.getColumn(c).hidden) {
        visibleCols.push(c);
      }
    }
    const colsToUse = visibleCols.length > 0 ? visibleCols : Array.from({ length: maxCols }, (_, i) => i + 1);

    // Format all rows
    const formattedRows: ExcelCellData[][] = [];
    rawRows.forEach((row, rowIndex) => {
      const isHeader = rowIndex === 0;
      const rowCells: ExcelCellData[] = [];
      colsToUse.forEach((c) => {
        const cell = row.getCell(c);
        rowCells.push(formatCellData(cell, c, isHeader));
      });

      // Skip row if completely empty
      const isCompletelyEmpty = rowCells.every((cell) => !cell.value || cell.value === '');
      if (!isCompletelyEmpty) {
        formattedRows.push(rowCells);
      }
    });

    // Build column headers (e.g. A, B, C...)
    const columnHeaders: string[] = [];
    for (let c = 0; c < colsToUse.length; c++) {
      let label = '';
      let n = c;
      while (n >= 0) {
        label = String.fromCharCode((n % 26) + 65) + label;
        n = Math.floor(n / 26) - 1;
      }
      columnHeaders.push(label);
    }

    grandTotalRows += formattedRows.length;

    sheets.push({
      id: String(sheetId),
      name: ws.name,
      rowCount: formattedRows.length,
      colCount: maxCols,
      headers: columnHeaders,
      rows: formattedRows,
    });
  });

  return {
    filename,
    sheets,
    totalSheets: sheets.length,
    totalRows: grandTotalRows,
    wb,
  };
}

/**
 * Load an uploaded file directly into preview data
 */
export async function convertExcelFileToPreviewData(file: File): Promise<ExcelWorkbookPreviewData> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return convertWorkbookToPreviewData(wb, file.name);
}
