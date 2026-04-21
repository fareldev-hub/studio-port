import { useState } from 'react';
import type { AppSettings } from '@/types';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [local, setLocal] = useState<AppSettings>({ ...settings });
  const [activeSection, setActiveSection] = useState<string>('editor');

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  const sections = [
    { id: 'editor', label: 'Editor', icon: 'fa-solid fa-code' },
    { id: 'terminal', label: 'Terminal', icon: 'fa-solid fa-terminal' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex rounded-xl overflow-hidden"
        style={{
          width: 700,
          height: 520,
          maxHeight: '90vh',
          backgroundColor: '#1e1e1e',
          border: '1px solid #2d2d2d',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Sidebar */}
        <div
          className="flex flex-col w-48 flex-shrink-0"
          style={{
            backgroundColor: '#181818',
            borderRight: '1px solid #2d2d2d',
          }}
        >
          <div className="px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: 'rgba(79,193,255,0.15)',
                }}
              >
                <i className="fa-solid fa-gear" style={{ color: '#4fc1ff', fontSize: 14 }} />
              </div>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#e8e8e8',
                  letterSpacing: '-0.01em',
                }}
              >
                Settings
              </span>
            </div>
          </div>

          <nav className="flex-1 px-2 py-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 mb-0.5"
                style={{
                  backgroundColor: activeSection === section.id ? 'rgba(79,193,255,0.12)' : 'transparent',
                  color: activeSection === section.id ? '#4fc1ff' : '#888',
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== section.id) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.color = '#bbb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== section.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#888';
                  }
                }}
              >
                <i className={section.icon} style={{ fontSize: 13, width: 18, textAlign: 'center' }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{section.label}</span>
                {activeSection === section.id && (
                  <div className="ml-auto" style={{ width: 3, height: 16, backgroundColor: '#4fc1ff', borderRadius: 2 }} />
                )}
              </button>
            ))}
          </nav>

          <div
            className="px-4 py-3 text-xs"
            style={{ color: '#555', borderTop: '1px solid #252525' }}
          >
            v1.0.0
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid #2a2a2a' }}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#e8e8e8',
              }}
            >
              {sections.find((s) => s.id === activeSection)?.label}
            </span>
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-lg transition-all duration-200"
              style={{
                width: 28,
                height: 28,
                color: '#666',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#666';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize: 14 }} />
            </button>
          </div>

          {/* Body */}
          <div
            className="flex-1 overflow-y-auto px-6 py-5"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}
          >
            {activeSection === 'editor' && (
              <div className="flex flex-col gap-5">
                <Card>
                  <ToggleRow
                    label="Auto Save"
                    description="Automatically save files after editing"
                    checked={local.autoSave}
                    onChange={(v) => update('autoSave', v)}
                  />
                  {local.autoSave && (
                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid #2a2a2a' }}>
                      <SliderRow
                        label="Auto Save Delay"
                        unit="ms"
                        min={500}
                        max={5000}
                        step={250}
                        value={local.autoSaveDelay}
                        onChange={(v) => update('autoSaveDelay', v)}
                      />
                    </div>
                  )}
                </Card>

                <Card>
                  <SliderRow
                    label="Font Size"
                    unit="px"
                    min={10}
                    max={24}
                    step={1}
                    value={local.editorFontSize}
                    onChange={(v) => update('editorFontSize', v)}
                  />
                </Card>

                <Card>
                  <SliderRow
                    label="Line Height"
                    unit="px"
                    min={16}
                    max={32}
                    step={1}
                    value={local.lineHeight}
                    onChange={(v) => update('lineHeight', v)}
                  />
                </Card>

                <Card>
                  <SelectRow
                    label="Tab Size"
                    value={String(local.editorTabSize)}
                    options={[
                      { value: '2', label: '2 spaces' },
                      { value: '4', label: '4 spaces' },
                      { value: '8', label: '8 spaces' },
                    ]}
                    onChange={(v) => update('editorTabSize', Number(v))}
                  />
                </Card>

                <Card>
                  <ToggleRow
                    label="Word Wrap"
                    description="Wrap long lines in the editor"
                    checked={local.wordWrap}
                    onChange={(v) => update('wordWrap', v)}
                  />
                </Card>

                <Card>
                  <ToggleRow
                    label="Minimap"
                    description="Show code minimap on the right side"
                    checked={local.minimap}
                    onChange={(v) => update('minimap', v)}
                  />
                </Card>
              </div>
            )}

            {activeSection === 'terminal' && (
              <div className="flex flex-col gap-5">
                <Card>
                  <SliderRow
                    label="Font Size"
                    unit="px"
                    min={10}
                    max={20}
                    step={1}
                    value={local.terminalFontSize}
                    onChange={(v) => update('terminalFontSize', v)}
                  />
                </Card>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-2.5 px-6 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid #2a2a2a', backgroundColor: '#1a1a1a' }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                color: '#999',
                backgroundColor: 'transparent',
                border: '1px solid #333',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = '#ddd';
                e.currentTarget.style.borderColor = '#444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#999';
                e.currentTarget.style.borderColor = '#333';
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: '#4fc1ff',
                color: '#0a0a0a',
                boxShadow: '0 2px 8px rgba(79,193,255,0.25)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#6bccff';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,193,255,0.35)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#4fc1ff';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(79,193,255,0.25)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5 transition-all duration-200"
      style={{
        backgroundColor: '#252525',
        border: '1px solid #2e2e2e',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#3a3a3a';
        e.currentTarget.style.backgroundColor = '#282828';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#2e2e2e';
        e.currentTarget.style.backgroundColor = '#252525';
      }}
    >
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="pr-4">
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#e0e0e0',
            lineHeight: 1.4,
          }}
        >
          {label}
        </div>
        {description && (
          <div
            className="mt-1"
            style={{
              fontSize: 12,
              color: '#777',
              lineHeight: 1.5,
            }}
          >
            {description}
          </div>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative inline-flex flex-shrink-0 rounded-full transition-all duration-300 ease-out"
        style={{
          width: 40,
          height: 22,
          backgroundColor: checked ? '#4fc1ff' : '#3a3a3a',
          boxShadow: checked ? '0 0 12px rgba(79,193,255,0.3)' : 'none',
        }}
      >
        <span
          className="inline-block rounded-full transition-all duration-300 ease-out"
          style={{
            width: 16,
            height: 16,
            margin: 3,
            backgroundColor: '#fff',
            transform: checked ? 'translateX(18px)' : 'translateX(0)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  );
}

function SliderRow({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#e0e0e0',
          }}
        >
          {label}
        </span>
        <span
          className="font-mono px-2 py-0.5 rounded-md text-xs font-semibold"
          style={{
            color: '#4fc1ff',
            backgroundColor: 'rgba(79,193,255,0.12)',
          }}
        >
          {value}{unit}
        </span>
      </div>
      <div className="relative flex items-center" style={{ height: 20 }}>
        <div
          className="absolute w-full rounded-full"
          style={{
            height: 4,
            backgroundColor: '#333',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            height: 4,
            width: `${percentage}%`,
            backgroundColor: '#4fc1ff',
            boxShadow: '0 0 8px rgba(79,193,255,0.3)',
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer"
          style={{ height: 20, zIndex: 10 }}
        />
        <div
          className="absolute rounded-full transition-all duration-150"
          style={{
            width: 14,
            height: 14,
            backgroundColor: '#4fc1ff',
            left: `calc(${percentage}% - 7px)`,
            boxShadow: '0 0 10px rgba(79,193,255,0.5), 0 2px 4px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }}
        />
      </div>
      <div className="flex justify-between mt-2">
        <span style={{ fontSize: 11, color: '#555' }}>{min}{unit}</span>
        <span style={{ fontSize: 11, color: '#555' }}>{max}{unit}</span>
      </div>
    </div>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: '#e0e0e0',
        }}
      >
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm cursor-pointer transition-all duration-200 appearance-none"
          style={{
            backgroundColor: '#2a2a2a',
            color: '#e0e0e0',
            border: '1px solid #3a3a3a',
            outline: 'none',
            minWidth: 140,
            paddingRight: 32,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#4fc1ff';
            e.currentTarget.style.backgroundColor = '#2e2e2e';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#3a3a3a';
            e.currentTarget.style.backgroundColor = '#2a2a2a';
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#4fc1ff';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(79,193,255,0.15)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#3a3a3a';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} style={{ backgroundColor: '#2a2a2a', color: '#e0e0e0' }}>
              {o.label}
            </option>
          ))}
        </select>
        <i
          className="fa-solid fa-chevron-down absolute pointer-events-none"
          style={{
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 10,
            color: '#666',
          }}
        />
      </div>
    </div>
  );
}