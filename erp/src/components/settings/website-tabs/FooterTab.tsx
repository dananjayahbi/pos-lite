'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { WebsiteConfigData, FooterColumn, FooterColumnLink } from '@/types/website.types';

interface FooterTabProps {
  config: WebsiteConfigData;
  onChange: (updates: Partial<WebsiteConfigData>) => void;
}

export function FooterTab({ config, onChange }: FooterTabProps) {
  const footerColumns: FooterColumn[] = config.footerColumns ?? [];

  const updateFooterAbout = (footerAbout: string) => {
    onChange({ footerAbout });
  };

  const addColumn = () => {
    onChange({
      footerColumns: [...footerColumns, { title: 'New Column', links: [] }],
    });
  };

  const updateColumn = (colIndex: number, updates: Partial<FooterColumn>) => {
    const updated = footerColumns.map((col, i) =>
      i === colIndex ? { ...col, ...updates } : col
    );
    onChange({ footerColumns: updated });
  };

  const removeColumn = (colIndex: number) => {
    onChange({ footerColumns: footerColumns.filter((_, i) => i !== colIndex) });
  };

  const addLink = (colIndex: number) => {
    const col = footerColumns[colIndex];
    if (!col) return;
    updateColumn(colIndex, {
      links: [...col.links, { label: 'New Link', href: '#' }],
    });
  };

  const updateLink = (
    colIndex: number,
    linkIndex: number,
    updates: Partial<FooterColumnLink>,
  ) => {
    const col = footerColumns[colIndex];
    if (!col) return;
    const updatedLinks = col.links.map((link, i) =>
      i === linkIndex ? { ...link, ...updates } : link
    );
    updateColumn(colIndex, { links: updatedLinks });
  };

  const removeLink = (colIndex: number, linkIndex: number) => {
    const col = footerColumns[colIndex];
    if (!col) return;
    updateColumn(colIndex, {
      links: col.links.filter((_, i) => i !== linkIndex),
    });
  };

  return (
    <div className="space-y-6">
      {/* About text */}
      <div>
        <h3 className="text-sm font-semibold text-espresso mb-3">About Us Text</h3>
        <Textarea
          value={config.footerAbout ?? ''}
          onChange={(e) => updateFooterAbout(e.target.value)}
          placeholder="Brief description about the business that appears in the footer..."
          rows={3}
        />
      </div>

      {/* Footer columns */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-espresso">Footer Columns</h3>
        <Button variant="outline" size="sm" onClick={addColumn}>
          <Plus className="h-4 w-4 mr-1" /> Add Column
        </Button>
      </div>

      <p className="text-xs text-sand">
        The footer has 3 columns. Column 3 is always &quot;About Us&quot;. Add up to 2 custom columns here.
      </p>

      <div className="space-y-4">
        {footerColumns.map((col, colIndex) => (
          <div
            key={colIndex}
            className="border border-mist rounded-lg p-4 bg-white space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-sand cursor-grab" />
                <Input
                  value={col.title}
                  onChange={(e) => updateColumn(colIndex, { title: e.target.value })}
                  className="h-8 text-sm font-medium w-40"
                  placeholder="Column Title"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeColumn(colIndex)}
                className="text-terracotta"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 pl-6">
              {col.links.map((link, linkIndex) => (
                <div key={linkIndex} className="flex items-center gap-2">
                  <Input
                    value={link.label}
                    onChange={(e) =>
                      updateLink(colIndex, linkIndex, { label: e.target.value })
                    }
                    className="h-7 text-sm flex-1"
                    placeholder="Link Label"
                  />
                  <Input
                    value={link.href}
                    onChange={(e) =>
                      updateLink(colIndex, linkIndex, { href: e.target.value })
                    }
                    className="h-7 text-sm flex-1"
                    placeholder="/url"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLink(colIndex, linkIndex)}
                    className="text-terracotta h-7 w-7"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addLink(colIndex)}
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Link
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
