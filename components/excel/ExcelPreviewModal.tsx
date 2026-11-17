'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  X,
  Search,
  Maximize2,
  Minimize2,
  Table,
} from 'lucide-react';
import { ExcelWorkbookPreviewData, ExcelCellData } from '@/lib/excel/preview';
import { downloadWorkbook } from '@/lib/excel/export';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface ExcelPreviewModalProps {
  data: ExcelWorkbookPreviewData | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

export default function ExcelPreviewModal({
  data,
  isOpen,
  onClose,
  onDownload,
}: ExcelPreviewModalProps) {
  const { locale, t } = useLanguage();
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Reset active sheet & search when opening new workbook
  useEffect(() => {
    if (isOpen) {
      setActiveSheetIndex(0);
      setSearchQuery('');
    }
  }, [isOpen, data?.filename]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const activeSheet = useMemo(() => {
    if (!data || !data.sheets || data.sheets.length === 0) return null;
    return data.sheets[activeSheetIndex] || data.sheets[0];
  }, [data, activeSheetIndex]);

  // Filter rows based on live search query
  const filteredRows = useMemo(() => {
    if (!activeSheet) return [];
    if (!searchQuery.trim()) return activeSheet.rows;

    const q = searchQuery.toLowerCase().trim();
    return activeSheet.rows.filter((row, idx) => {
      // Always keep header row (row index 0)
      if (idx === 0) return true;
      return row.some((cell) => cell.value && cell.value.toLowerCase().includes(q));
    });
  }, [activeSheet, searchQuery]);

  const handleDownloadExcel = async () => {
    if (!data) return;
    setIsDownloading(true);
    try {
      if (onDownload) {
        onDownload();
      } else if (data.wb) {
        await downloadWorkbook(data.wb, data.filename);
      }
    } catch (err) {
      console.error('Failed to download from preview:', err);
      alert('Failed to download Excel file.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`flex flex-col rounded-3xl border border-[#DDE2DE] dark:border-white/10 bg-white dark:bg-[#161D18] shadow-2xl transition-all ${
          isFullscreen
            ? 'h-[98vh] w-[99vw]'
            : 'h-[90vh] w-full max-w-6xl'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#E2E8E4] dark:border-white/8 px-5 py-3.5 gap-3">
          {/* File Metadata */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#5B7966]/15 dark:bg-[#A7D7B5]/15 text-[#5B7966] dark:text-[#A7D7B5]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="truncate text-sm font-bold text-[#18221B] dark:text-[#F2F5F3]">
                  {data.filename}
                </h3>
                <span className="shrink-0 rounded-full bg-[#5B7966]/15 dark:bg-[#A7D7B5]/15 px-2 py-0.5 text-[10px] font-bold text-[#5B7966] dark:text-[#A7D7B5] whitespace-nowrap">
                  Excel Preview
                </span>
              </div>
              <p className="text-[11px] text-[#6B7770] dark:text-[#8F9992]">
                {data.totalSheets} Sheets • {data.totalRows} Total Rows • .xlsx
              </p>
            </div>
          </div>

          {/* Actions & Search */}
          <div className="flex items-center space-x-2">
            {/* Live Search */}
            <div className="relative w-40 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7770] dark:text-[#8F9992]" />
              <input
                type="text"
                placeholder="Search sheet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-1.5 pl-8 pr-3 text-base sm:text-xs text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7770] dark:text-[#8F9992] hover:text-[#18221B] dark:hover:text-[#F2F5F3]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={isDownloading}
              className="flex items-center space-x-1.5 rounded-xl bg-[#5B7966] dark:bg-[#A7D7B5] px-3.5 py-1.5 text-xs font-bold text-white dark:text-[#0D110F] shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 cursor-pointer"
              title="Download Original Excel (.xlsx)"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {isDownloading ? 'Saving...' : 'Download'}
              </span>
            </button>

            {/* Toggle Fullscreen */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="rounded-xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] p-1.5 text-[#6B7770] dark:text-[#8F9992] hover:text-[#18221B] dark:hover:text-[#F2F5F3] hover:border-[#5B7966]/40 dark:hover:border-white/20 transition-all cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-[#6B7770] dark:text-[#8F9992] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#18221B] dark:hover:text-[#F2F5F3] transition-colors cursor-pointer"
              title="Close Preview (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Sheet Tabs Bar (Excel Style) */}
        <div className="flex shrink-0 items-center overflow-x-auto border-b border-[#E2E8E4] dark:border-white/8 bg-[#F6F7F5] dark:bg-[#1A211D] px-4 py-2">
          <div className="flex items-center space-x-1.5">
            {data.sheets.map((sheet, idx) => {
              const isActive = idx === activeSheetIndex;
              return (
                <button
                  key={sheet.id || idx}
                  type="button"
                  onClick={() => {
                    setActiveSheetIndex(idx);
                    setSearchQuery('');
                  }}
                  className={`flex shrink-0 items-center space-x-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-[#161C18] text-[#5B7966] dark:text-[#A7D7B5] ring-1 ring-[#5B7966]/30 dark:ring-[#A7D7B5]/30 shadow-xs'
                      : 'text-[#6B7770] dark:text-[#8F9992] hover:text-[#18221B] dark:hover:text-[#F2F5F3] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Table className={`h-3.5 w-3.5 ${isActive ? 'text-[#5B7966] dark:text-[#A7D7B5]' : 'text-[#6B7770] dark:text-[#8F9992]'}`} />
                  <span>{sheet.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono tabular-nums whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-[#5B7966]/20 dark:bg-[#A7D7B5]/20 text-[#5B7966] dark:text-[#A7D7B5]'
                        : 'bg-black/5 dark:bg-white/5 text-[#6B7770] dark:text-[#8F9992]'
                    }`}
                  >
                    {sheet.rowCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Spreadsheet Table Body */}
        <div className="flex-1 overflow-auto bg-[#EFEFED] dark:bg-[#0D110F] p-2 sm:p-4">
          {activeSheet && filteredRows.length > 0 ? (
            <div className="inline-block min-w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-white dark:bg-[#161C18] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  {/* Column Letters (Excel A, B, C...) */}
                  <thead>
                    <tr className="bg-[#F6F7F5] dark:bg-[#1A211D] text-[#6B7770] dark:text-[#8F9992] select-none">
                      {/* Row index header */}
                      <th className="sticky left-0 z-20 w-12 border-b border-r border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] px-2 py-1.5 text-center text-[10px] font-mono">
                        #
                      </th>
                      {activeSheet.headers.map((colLetter, cIdx) => (
                        <th
                          key={cIdx}
                          className="border-b border-r border-[#DDE2DE] dark:border-white/10 px-3 py-1 text-center text-[10px] font-semibold text-[#6B7770] dark:text-[#8F9992]"
                        >
                          {colLetter}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map((row, rIdx) => {
                      const isHeaderRow = rIdx === 0;

                      return (
                        <tr
                          key={rIdx}
                          className={`transition-colors ${
                            isHeaderRow
                              ? 'bg-[#F6F7F5] dark:bg-[#1A211D] font-bold text-[#18221B] dark:text-[#F2F5F3]'
                              : rIdx % 2 === 0
                              ? 'bg-white dark:bg-[#161C18] hover:bg-black/5 dark:hover:bg-white/5'
                              : 'bg-[#FAFAFA] dark:bg-[#141916] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {/* Row Number Index */}
                          <td className="sticky left-0 z-10 border-b border-r border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] px-2 py-2 text-center text-[10px] font-mono text-[#6B7770] dark:text-[#8F9992] select-none">
                            {rIdx + 1}
                          </td>

                          {/* Data Cells */}
                          {row.map((cell, cIdx) => {
                            return (
                              <td
                                key={cIdx}
                                className={`border-b border-r border-[#E2E8E4] dark:border-white/5 px-3 py-2 text-xs ${
                                  cell.align === 'right'
                                    ? 'text-right'
                                    : cell.align === 'center'
                                    ? 'text-center'
                                    : 'text-left'
                                } ${cell.isBold ? 'font-bold' : ''}`}
                              >
                                {cell.type === 'badge' ? (
                                  <span
                                    className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                      cell.badgeVariant === 'income'
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                        : cell.badgeVariant === 'expense'
                                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                        : cell.badgeVariant === 'transfer'
                                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    {cell.value}
                                  </span>
                                ) : cell.type === 'currency' ? (
                                  <span
                                    className={`font-mono tabular-nums font-semibold ${
                                      cell.rawValue < 0
                                        ? 'text-rose-500 dark:text-rose-400'
                                        : 'text-[#18221B] dark:text-[#F2F5F3]'
                                    }`}
                                  >
                                    {cell.value}
                                  </span>
                                ) : (
                                  <span className="text-[#6B7770] dark:text-[#8F9992]">
                                    {cell.value || '-'}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#DDE2DE] dark:border-white/10 bg-white dark:bg-[#161C18] p-8 text-center">
              <Search className="h-8 w-8 text-[#6B7770] dark:text-[#8F9992] mb-2" />
              <p className="text-xs font-semibold text-[#6B7770] dark:text-[#8F9992]">
                No data matching search &quot;{searchQuery}&quot;
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-3 text-xs text-[#5B7966] dark:text-[#A7D7B5] hover:underline cursor-pointer"
              >
                Clear search filter
              </button>
            </div>
          )}
        </div>

        {/* Footer Status Bar (Excel style) */}
        <div className="flex items-center justify-between border-t border-[#E2E8E4] dark:border-white/8 px-5 py-2.5 text-[11px] text-[#6B7770] dark:text-[#8F9992] bg-white dark:bg-[#161C18] rounded-b-3xl">
          <div className="flex items-center space-x-3">
            <span>
              Sheet: <strong className="text-[#18221B] dark:text-[#F2F5F3]">{activeSheet?.name}</strong>
            </span>
            <span>•</span>
            <span className="font-mono tabular-nums">
              Showing {filteredRows.length} of {activeSheet?.rowCount || 0} rows
            </span>
            {searchQuery && (
              <>
                <span>•</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Filter: &quot;{searchQuery}&quot;
                </span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <span className="hidden sm:inline text-[#6B7770] dark:text-[#8F9992]">
              Navigate sheets using tabs above
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] px-3 py-1 text-xs font-semibold text-[#18221B] dark:text-[#F2F5F3] hover:border-[#5B7966]/40 dark:hover:border-white/20 transition-all cursor-pointer"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
