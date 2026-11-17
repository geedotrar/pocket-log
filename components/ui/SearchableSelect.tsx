'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  color?: string | null;
  icon?: React.ReactNode;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allOption?: { value: string; label: string };
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  matchTriggerWidth?: boolean;
  showSublabelInTrigger?: boolean;
  maxHeight?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  allOption,
  emptyMessage = 'No results found',
  className = '',
  disabled = false,
  size = 'md',
  align = 'left',
  matchTriggerWidth = false,
  showSublabelInTrigger = true,
  maxHeight = 'max-h-52',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Selected option lookup
  const selectedOption = useMemo(() => {
    if (allOption && value === allOption.value) {
      return { value: allOption.value, label: allOption.label };
    }
    return options.find((opt) => opt.value === value);
  }, [options, value, allOption]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list: SearchableSelectOption[] = [];

    if (allOption) {
      if (!q || allOption.label.toLowerCase().includes(q)) {
        list.push({ value: allOption.value, label: allOption.label });
      }
    }

    const matched = options.filter((opt) => {
      if (!q) return true;
      const labelMatch = opt.label.toLowerCase().includes(q);
      const sublabelMatch = opt.sublabel?.toLowerCase().includes(q);
      return labelMatch || sublabelMatch;
    });

    return [...list, ...matched];
  }, [options, searchQuery, allOption]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
        }
      }}
      className={`relative min-w-0 ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between border text-left transition-colors focus:outline-none ${
          size === 'sm'
            ? 'rounded-xl py-1.5 px-3 min-h-[34px] text-xs'
            : 'rounded-2xl py-2.5 px-3.5 min-h-[42px] text-xs'
        } ${
          isOpen
            ? 'border-[#5B7966] ring-1 ring-[#5B7966] dark:border-[#A7D7B5] dark:ring-[#A7D7B5]'
            : 'border-black/[0.06] hover:border-black/15 dark:border-white/10 dark:hover:border-white/20'
        } bg-[#F6F7F5] dark:bg-[#1A211D] ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center space-x-2 min-w-0 flex-1 pr-1.5">
          {selectedOption?.color && (
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          {selectedOption?.icon && (
            <span className="shrink-0 text-[#76847A] dark:text-[#8F9992]">{selectedOption.icon}</span>
          )}
          <span
            title={selectedOption ? selectedOption.label : placeholder}
            className={`text-xs truncate min-w-0 flex-1 ${
              selectedOption
                ? 'font-semibold text-[#18221B] dark:text-[#F2F5F3]'
                : 'text-[#76847A] dark:text-[#8F9992]'
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {showSublabelInTrigger && selectedOption && 'sublabel' in selectedOption && selectedOption.sublabel && (
            <span className="text-[10px] text-[#76847A] dark:text-[#8F9992] tabular-nums shrink-0 ml-1">
              ({selectedOption.sublabel})
            </span>
          )}
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#76847A] dark:text-[#8F9992] transition-transform duration-150 ml-1 ${
            isOpen ? 'rotate-180 text-[#5B7966] dark:text-[#A7D7B5]' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-50 rounded-2xl border border-black/[0.08] bg-white dark:border-white/10 dark:bg-[#161D18] p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-100 ${maxHeight} flex flex-col ${
            matchTriggerWidth
              ? 'w-full left-0 right-0 min-w-full max-w-full'
              : align === 'right'
              ? 'right-0 min-w-full sm:min-w-[220px] max-w-[min(calc(100vw-2rem),360px)]'
              : 'left-0 min-w-full sm:min-w-[220px] max-w-[min(calc(100vw-2rem),360px)]'
          }`}
        >
          {/* Search Field */}
          <div className="relative mb-2 shrink-0">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#76847A] dark:text-[#8F9992]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredOptions.length > 0) {
                    handleSelect(filteredOptions[0].value);
                  }
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-black/[0.06] bg-[#F6F7F5] py-2 pl-8 pr-7 text-base sm:text-xs text-[#18221B] placeholder-[#8E9B92] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:placeholder-[#8F9992] dark:focus:border-[#A7D7B5]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#76847A] hover:text-[#18221B] dark:text-[#8F9992] dark:hover:text-[#F2F5F3]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto space-y-1 flex-1 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#76847A] dark:text-[#8F9992]">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 min-h-[36px] text-xs transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[#5B7966]/10 text-[#5B7966] dark:bg-[#A7D7B5]/15 dark:text-[#A7D7B5] font-semibold'
                        : 'text-[#18221B] hover:bg-black/5 dark:text-[#F2F5F3] dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1 pr-2">
                      {opt.color && (
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: opt.color }}
                        />
                      )}
                      {opt.icon && (
                        <span className="shrink-0 text-[#76847A] dark:text-[#8F9992]">{opt.icon}</span>
                      )}
                      <span className="truncate min-w-0 flex-1 text-xs" title={opt.label}>
                        {opt.label}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0 ml-1">
                      {opt.sublabel && (
                        <span
                          className={`text-[10px] tabular-nums ${
                            isSelected
                              ? 'text-[#5B7966]/80 dark:text-[#A7D7B5]/80'
                              : 'text-[#76847A] dark:text-[#8F9992]'
                          }`}
                        >
                          {opt.sublabel}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-[#5B7966] dark:text-[#A7D7B5] shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
