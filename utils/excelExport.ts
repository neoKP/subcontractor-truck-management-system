/**
 * Professional Excel Export Utilities
 * Based on xlsx skill guidelines
 */

import * as XLSX from 'xlsx';

// Color coding standards (xlsx skill)
const COLORS = {
  HEADER_BG: 'FF0F172A',      // Slate 900
  HEADER_TEXT: 'FFFFFFFF',    // White
  INPUT_TEXT: 'FF0000FF',     // Blue - for inputs
  FORMULA_TEXT: 'FF000000',   // Black - for formulas
  CURRENCY_POSITIVE: 'FF10B981', // Emerald
  CURRENCY_NEGATIVE: 'FFF43F5E', // Rose
  BORDER: 'FFE2E8F0',         // Slate 200
  ALT_ROW: 'FFF8FAFC',        // Slate 50
};

interface ExportColumn {
  key: string;
  header: string;
  width?: number;
  type?: 'text' | 'number' | 'currency' | 'date' | 'percentage';
}

interface ExportOptions {
  filename: string;
  sheetName: string;
  title?: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
  includeTimestamp?: boolean;
  includeSummary?: boolean;
}

/**
 * Format number as Thai currency
 */
const formatCurrency = (value: number): string => {
  if (value === 0) return '-';
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Format date to Thai locale
 */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Create professional Excel export with formatting
 */
export const createProfessionalExcel = (options: ExportOptions): void => {
  const {
    filename,
    sheetName,
    title,
    subtitle,
    columns,
    data,
    includeTimestamp = true,
    includeSummary = true
  } = options;

  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Prepare rows
  const rows: any[][] = [];
  let currentRow = 0;

  // Add title if provided
  if (title) {
    rows.push([title]);
    currentRow++;
  }

  // Add subtitle if provided
  if (subtitle) {
    rows.push([subtitle]);
    currentRow++;
  }

  // Add timestamp
  if (includeTimestamp) {
    const now = new Date();
    rows.push([`Generated: ${now.toLocaleString('th-TH')}`]);
    currentRow++;
  }

  // Add empty row before data
  if (title || subtitle || includeTimestamp) {
    rows.push([]);
    currentRow++;
  }

  // Add headers
  const headerRow = columns.map(col => col.header);
  rows.push(headerRow);
  const headerRowIndex = currentRow;
  currentRow++;

  // Add data rows
  data.forEach((item, idx) => {
    const row = columns.map(col => {
      const value = item[col.key];
      
      switch (col.type) {
        case 'currency':
          return typeof value === 'number' ? value : (parseFloat(value) || 0);
        case 'date':
          return formatDate(value);
        case 'percentage':
          return typeof value === 'number' ? `${value.toFixed(1)}%` : value;
        case 'number':
          return typeof value === 'number' ? value : (parseFloat(value) || 0);
        default:
          return value ?? '-';
      }
    });
    rows.push(row);
  });

  // Add summary row if requested
  if (includeSummary && data.length > 0) {
    rows.push([]); // Empty row
    
    const summaryRow = columns.map((col, idx) => {
      if (idx === 0) return 'TOTAL';
      if (col.type === 'currency' || col.type === 'number') {
        const sum = data.reduce((acc, item) => {
          const val = item[col.key];
          return acc + (typeof val === 'number' ? val : (parseFloat(val) || 0));
        }, 0);
        return sum;
      }
      return '';
    });
    rows.push(summaryRow);
  }

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  const colWidths = columns.map(col => ({ wch: col.width || 15 }));
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate filename with date
  const dateStr = new Date().toISOString().split('T')[0];
  const finalFilename = `${filename}_${dateStr}.xlsx`;

  // Write file
  XLSX.writeFile(wb, finalFilename);
};

/**
 * Export billing data with professional formatting
 */
export const exportBillingReport = (
  jobs: any[],
  dateRange: { start: string; end: string }
): void => {
  const columns: ExportColumn[] = [
    { key: 'billingDate', header: 'Billing Date', width: 15, type: 'date' },
    { key: 'billingDocNo', header: 'Doc No', width: 15, type: 'text' },
    { key: 'jobId', header: 'Job ID', width: 18, type: 'text' },
    { key: 'subcontractor', header: 'Subcontractor', width: 25, type: 'text' },
    { key: 'origin', header: 'Origin', width: 20, type: 'text' },
    { key: 'destination', header: 'Destination', width: 20, type: 'text' },
    { key: 'cost', header: 'Base Cost (฿)', width: 15, type: 'currency' },
    { key: 'extraCharge', header: 'Extra (฿)', width: 12, type: 'currency' },
    { key: 'total', header: 'Total (฿)', width: 15, type: 'currency' },
  ];

  const data = jobs.map(j => ({
    billingDate: j.billingDate || j.dateOfService,
    billingDocNo: j.billingDocNo || '-',
    jobId: j.id,
    subcontractor: j.subcontractor || '-',
    origin: j.origin,
    destination: j.destination,
    cost: j.cost || 0,
    extraCharge: j.extraCharge || 0,
    total: (j.cost || 0) + (j.extraCharge || 0)
  }));

  createProfessionalExcel({
    filename: `Billing_Report_${dateRange.start}_to_${dateRange.end}`,
    sheetName: 'Billing History',
    title: 'BILLING REPORT',
    subtitle: `Period: ${dateRange.start} to ${dateRange.end}`,
    columns,
    data,
    includeTimestamp: true,
    includeSummary: true
  });
};

/**
 * Export profit analysis with professional formatting
 */
export const exportProfitAnalysis = (
  jobs: any[],
  period: string
): void => {
  const columns: ExportColumn[] = [
    { key: 'dateOfService', header: 'Service Date', width: 15, type: 'date' },
    { key: 'id', header: 'Job ID', width: 18, type: 'text' },
    { key: 'subcontractor', header: 'Subcontractor', width: 25, type: 'text' },
    { key: 'route', header: 'Route', width: 35, type: 'text' },
    { key: 'truckType', header: 'Truck Type', width: 15, type: 'text' },
    { key: 'revenue', header: 'Revenue (฿)', width: 15, type: 'currency' },
    { key: 'cost', header: 'Cost (฿)', width: 15, type: 'currency' },
    { key: 'profit', header: 'Profit (฿)', width: 15, type: 'currency' },
    { key: 'margin', header: 'Margin', width: 10, type: 'percentage' },
  ];

  const data = jobs.map(j => {
    const revenue = (j.sellingPrice || 0) + (j.extraCharge || 0);
    const cost = j.cost || 0;
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      dateOfService: j.dateOfService,
      id: j.id,
      subcontractor: j.subcontractor || '-',
      route: `${j.origin} → ${j.destination}`,
      truckType: j.truckType,
      revenue,
      cost,
      profit,
      margin
    };
  });

  createProfessionalExcel({
    filename: `Profit_Analysis_${period}`,
    sheetName: 'Profit Analysis',
    title: 'PROFIT ANALYSIS REPORT',
    subtitle: `Period: ${period}`,
    columns,
    data,
    includeTimestamp: true,
    includeSummary: true
  });
};

/**
 * Export accounting report with professional formatting
 */
export const exportAccountingReport = (
  jobs: any[],
  period: string,
  reportType: 'summary' | 'detailed' = 'detailed'
): void => {
  const columns: ExportColumn[] = [
    { key: 'dateOfService', header: 'Service Date', width: 15, type: 'date' },
    { key: 'id', header: 'Job ID', width: 18, type: 'text' },
    { key: 'status', header: 'Status', width: 15, type: 'text' },
    { key: 'accountingStatus', header: 'Accounting Status', width: 18, type: 'text' },
    { key: 'subcontractor', header: 'Subcontractor', width: 25, type: 'text' },
    { key: 'route', header: 'Route', width: 35, type: 'text' },
    { key: 'cost', header: 'Cost (฿)', width: 15, type: 'currency' },
    { key: 'sellingPrice', header: 'Selling Price (฿)', width: 15, type: 'currency' },
    { key: 'extraCharge', header: 'Extra (฿)', width: 12, type: 'currency' },
  ];

  const data = jobs.map(j => ({
    dateOfService: j.dateOfService,
    id: j.id,
    status: j.status,
    accountingStatus: j.accountingStatus || 'Pending',
    subcontractor: j.subcontractor || '-',
    route: `${j.origin} → ${j.destination}`,
    cost: j.cost || 0,
    sellingPrice: j.sellingPrice || 0,
    extraCharge: j.extraCharge || 0
  }));

  createProfessionalExcel({
    filename: `Accounting_Report_${period}`,
    sheetName: 'Accounting Report',
    title: 'ACCOUNTING REPORT',
    subtitle: `Period: ${period} | Type: ${reportType.toUpperCase()}`,
    columns,
    data,
    includeTimestamp: true,
    includeSummary: true
  });
};

export default {
  createProfessionalExcel,
  exportBillingReport,
  exportProfitAnalysis,
  exportAccountingReport
};
