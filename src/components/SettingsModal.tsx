import { useState } from 'react';
import type { AppSettings } from '@/types';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [local, setLocal] = useState<AppSettings>({ ...settings });

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
        style={{
          width: 520,
          maxHeight: '80vh',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          color: '#e0e0e0',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: '#141414' }}
        >
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-gear" style={{ color: '#4fc1ff', fontSize: 14 }} />
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: '#666' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: 13 }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'thin' }}>

          <Section title="Editor">
            <ToggleRow
              label="Auto Save"
              description="Automatically save files after editing"
              checked={local.autoSave}
              onChange={(v) => update('autoSave', v)}
            />
            {local.autoSave && (
              <SliderRow
                label="Auto Save Delay"
                unit="ms"
                min={500}
                max={5000}
                step={250}
                value={local.autoSaveDelay}
                onChange={(v) => update('autoSaveDelay', v)}
              />
            )}
            <SliderRow
              label="Font Size"
              unit="px"
              min={10}
              max={24}
              step={1}
              value={local.editorFontSize}
              onChange={(v) => update('editorFontSize', v)}
            />
            <SliderRow
              label="Line Height"
              unit="px"
              min={16}
              max={32}
              step={1}
              value={local.lineHeight}
              onChange={(v) => update('lineHeight', v)}
            />
            <SelectRow
              label="Tab Size"
              value={String(local.editorTabSize)}
              options={[{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: '8', label: '8 spaces' }]}
              onChange={(v) => update('editorTabSize', Number(v))}
            />
            <ToggleRow
              label="Word Wrap"
              description="Wrap long lines in the editor"
              checked={local.wordWrap}
              onChange={(v) => update('wordWrap', v)}
            />
            <ToggleRow
              label="Minimap"
              description="Show code minimap on the right"
              checked={local.minimap}
              onChange={(v) => update('minimap', v)}
            />
          </Section>

          <Section title="Terminal">
            <SliderRow
              label="Font Size"
              unit="px"
              min={10}
              max={20}
              step={1}
              value={local.terminalFontSize}
              onChange={(v) => update('terminalFontSize', v)}
            />
          </Section>

        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid #2a2a2a', backgroundColor: '#141414' }}
        >
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm transition-colors"
            style={{ color: '#888', backgroundColor: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2a2a2a'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#888'; }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded text-sm font-semibold transition-colors"
            style={{ backgroundColor: '#4fc1ff', color: '#000' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#7dd3fc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4fc1ff'; }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div
        className="text-xs font-semibold uppercase mb-3"
        style={{ color: '#4fc1ff', letterSpacing: '0.1em' }}
      >
        {title}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
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
      <div>
        <div className="text-sm" style={{ color: '#e0e0e0' }}>{label}</div>
        {description && <div className="text-xs mt-0.5" style={{ color: '#666' }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative inline-flex flex-shrink-0 rounded-full transition-colors"
        style={{
          width: 36,
          height: 20,
          backgroundColor: checked ? '#4fc1ff' : '#333',
        }}
      >
        <span
          className="inline-block rounded-full transition-transform"
          style={{
            width: 14,
            height: 14,
            margin: 3,
            backgroundColor: '#fff',
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
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
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm" style={{ color: '#e0e0e0' }}>{label}</span>
        <span className="text-xs font-mono" style={{ color: '#4fc1ff' }}>{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: '#4fc1ff', height: 4 }}
      />
      <div className="flex justify-between text-xs mt-0.5" style={{ color: '#555' }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
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
      <span className="text-sm" style={{ color: '#e0e0e0' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded px-2 py-1 text-sm"
        style={{
          backgroundColor: '#2a2a2a',
          color: '#e0e0e0',
          border: '1px solid #444',
          outline: 'none',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
