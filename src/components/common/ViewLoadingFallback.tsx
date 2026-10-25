import React from 'react';

export interface ViewLoadingFallbackProps {
  label?: string;
}

export const ViewLoadingFallback: React.FC<ViewLoadingFallbackProps> = ({
  label = 'Loading view content...',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="max-w-7xl mx-auto px-4 py-8 animate-pulse space-y-6"
    >
      <div className="flex items-center justify-between pb-4 border-b border-[#E6DFD5]">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-[#E6DFD5] rounded-md" />
          <div className="h-4 w-72 bg-[#EFECE6] rounded-md" />
        </div>
        <div className="h-9 w-28 bg-[#E6DFD5] rounded-md" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="h-28 bg-[#FFFFFF] border border-[#E6DFD5] rounded-xl p-5 space-y-3 shadow-xs">
          <div className="h-4 w-24 bg-[#EFECE6] rounded-sm" />
          <div className="h-8 w-36 bg-[#E6DFD5] rounded-sm" />
        </div>
        <div className="h-28 bg-[#FFFFFF] border border-[#E6DFD5] rounded-xl p-5 space-y-3 shadow-xs">
          <div className="h-4 w-24 bg-[#EFECE6] rounded-sm" />
          <div className="h-8 w-36 bg-[#E6DFD5] rounded-sm" />
        </div>
        <div className="h-28 bg-[#FFFFFF] border border-[#E6DFD5] rounded-xl p-5 space-y-3 shadow-xs">
          <div className="h-4 w-24 bg-[#EFECE6] rounded-sm" />
          <div className="h-8 w-36 bg-[#E6DFD5] rounded-sm" />
        </div>
      </div>

      <div className="h-64 bg-[#FFFFFF] border border-[#E6DFD5] rounded-xl p-6 shadow-xs space-y-4">
        <div className="h-5 w-40 bg-[#E6DFD5] rounded-sm" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-[#FAF8F5] rounded-sm" />
          <div className="h-4 w-5/6 bg-[#FAF8F5] rounded-sm" />
          <div className="h-4 w-4/6 bg-[#FAF8F5] rounded-sm" />
        </div>
      </div>

      <span className="sr-only">{label}</span>
    </div>
  );
};
