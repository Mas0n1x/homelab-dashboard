/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 *
 * Formular-Editoren für die Bot-Inhalte. Die Nachrichten liegen in der
 * Bot-Konfiguration als JSON — hier werden sie in echte Felder aufgeteilt
 * (Titel, Beschreibung, Emoji, Farbe, Footer …) statt als roher JSON-Block
 * angezeigt. Der JSON-Modus bleibt pro Karte als Notausgang erhalten und
 * greift automatisch, wenn der gespeicherte Wert kein gültiges JSON ist.
 */
'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ChevronDown, ChevronUp, Plus, Trash2, Smile, Braces, LayoutList,
  AlertTriangle, Eye,
} from 'lucide-react';

/* ─────────────────────────── Grundbausteine ─────────────────────────── */

const EMOJI_CHOICES = [
  '✅', '❌', '❓', '❗', '📜', '📩', '📧', '🔧',
  '🐛', '💡', '⚙️', '🛠️', '🖥️', '💻', '📱', '🤖',
  '🎨', '🌐', '🌍', '🔗', '🛒', '💰', '💳', '🏷️',
  '📦', '🚀', '⭐', '🔥', '💚', '💙', '💜', '🧡',
  '🖨️', '🐙', '🏛️', '👋', '🎉', '🎁', '📊', '📋',
  '📝', '📌', '🔔', '🔒', '🛡️', '⚡', '⏰', '🎮',
];

const INPUT_CLS =
  'w-full px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08] text-sm text-white/85 outline-none focus:border-accent/40 transition-colors';

function Lbl({ children }: { children: ReactNode }) {
  return <span className="text-[12px] text-white/45 mb-1.5 block">{children}</span>;
}

function TextField({ label, value, onChange, placeholder, mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <Lbl>{label}</Lbl>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${INPUT_CLS} ${mono ? 'font-mono text-[12px]' : ''}`}
      />
    </label>
  );
}

function AreaField({ label, value, onChange, placeholder, rows = 4, hint, textareaRef }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  rows?: number; hint?: ReactNode; textareaRef?: React.RefObject<HTMLTextAreaElement>;
}) {
  return (
    <label className="block min-w-0">
      <Lbl>{label}</Lbl>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`${INPUT_CLS} leading-relaxed resize-y`}
      />
      {hint && <span className="text-[11px] text-white/30 mt-1 block">{hint}</span>}
    </label>
  );
}

/** Farbe als Schwatch + Hex-Feld — Discord färbt damit den Rand des Containers. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#5865f2';
  return (
    <label className="block min-w-0">
      <Lbl>{label}</Lbl>
      <div className="flex items-center gap-2">
        <span className="relative w-9 h-9 rounded-xl border border-white/[0.12] overflow-hidden flex-shrink-0" style={{ background: hex }}>
          <input
            type="color"
            value={hex}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={label}
          />
        </span>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#00ff88"
          className={`${INPUT_CLS} font-mono text-[12px]`}
        />
      </div>
    </label>
  );
}

/** Emoji-Feld mit Auswahlliste — Emojis brauchen eine eigene Schriftart, sonst
 *  fallen sie in der Mono-Schrift auf leere Kästchen zurück. */
export function EmojiField({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-w-0">
      {label && <Lbl>{label}</Lbl>}
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="🙂"
          className="w-14 px-2 py-2 rounded-xl bg-black/25 border border-white/[0.08] text-center text-[17px] leading-none font-emoji text-white/90 outline-none focus:border-accent/40 transition-colors"
        />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          title="Emoji wählen"
          className="px-2.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/45 hover:text-white/80 hover:bg-white/[0.09] transition-colors"
        >
          <Smile className="w-4 h-4" />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 p-2 w-[264px] rounded-2xl bg-[#0a0a18] border border-white/[0.12] shadow-2xl grid grid-cols-8 gap-1">
            {EMOJI_CHOICES.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => { onChange(e); setOpen(false); }}
                className="w-7 h-7 rounded-lg hover:bg-white/[0.1] text-[16px] leading-none font-emoji transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Fügt einen Platzhalter an der Cursor-Position ein (Fallback: am Ende). */
function insertAtCursor(
  ref: React.RefObject<HTMLTextAreaElement> | undefined,
  text: string,
  token: string,
  onChange: (v: string) => void,
) {
  const el = ref?.current;
  if (!el) { onChange(text + token); return; }
  const start = el.selectionStart ?? text.length;
  const end = el.selectionEnd ?? start;
  onChange(text.slice(0, start) + token + text.slice(end));
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos, pos);
  });
}

/** Klickbare Platzhalter-Leiste unter einem Textfeld. */
export function PlaceholderChips({ tokens, value, onChange, textareaRef, label = 'Platzhalter einfügen:' }: {
  tokens: string[];
  value: string;
  onChange: (v: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  label?: string;
}) {
  if (!tokens.length) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      <span className="text-[11px] text-white/30 mr-1">{label}</span>
      {tokens.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => insertAtCursor(textareaRef, value, t, onChange)}
          className="px-2 py-0.5 rounded-lg bg-accent/10 border border-accent/20 text-[11px] font-mono text-accent-light/90 hover:bg-accent/20 transition-colors"
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function IconBtn({ onClick, title, icon: Icon, disabled, danger }: {
  onClick: () => void; title: string; icon: any; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors disabled:opacity-25 disabled:cursor-default ${
        danger
          ? 'bg-red-500/[0.08] border-red-500/20 text-red-300/70 hover:text-red-300 hover:bg-red-500/[0.16]'
          : 'bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/80 hover:bg-white/[0.09]'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] bg-white/[0.04] border border-dashed border-white/[0.14] text-white/50 hover:text-white/85 hover:bg-white/[0.07] transition-colors w-full justify-center"
    >
      <Plus className="w-4 h-4" /> {label}
    </button>
  );
}

/** Rahmen für einen Eintrag einer Liste — Nummer links, Werkzeuge rechts. */
function ItemFrame({ index, count, badge, onMove, onRemove, children }: {
  index: number; count: number; badge?: ReactNode;
  onMove: (dir: -1 | 1) => void; onRemove: () => void; children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-lg bg-white/[0.05] text-[11px] text-white/40 flex items-center justify-center flex-shrink-0 tabular-nums">
            {index + 1}
          </span>
          {badge && <span className="text-[12px] text-white/45 truncate">{badge}</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <IconBtn onClick={() => onMove(-1)} title="Nach oben" icon={ChevronUp} disabled={index === 0} />
          <IconBtn onClick={() => onMove(1)} title="Nach unten" icon={ChevronDown} disabled={index === count - 1} />
          <IconBtn onClick={onRemove} title="Entfernen" icon={Trash2} danger />
        </div>
      </div>
      {children}
    </div>
  );
}

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/* ─────────────────────────── Karten-Hülle ─────────────────────────── */

function ModeSwitch({ mode, setMode, locked }: {
  mode: 'form' | 'json'; setMode: (m: 'form' | 'json') => void; locked?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-black/25 border border-white/[0.08]">
      {([['form', 'Formular', LayoutList], ['json', 'JSON', Braces]] as const).map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => setMode(id)}
          disabled={locked && id === 'form'}
          title={locked && id === 'form' ? 'Erst gültiges JSON herstellen' : label}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-[12px] transition-colors disabled:opacity-30 ${
            mode === id ? 'bg-white/[0.09] text-white/90' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Icon className="w-3.5 h-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

function JsonArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      spellCheck={false}
      rows={10}
      placeholder="JSON-Inhalt"
      className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/[0.08] font-mono text-[12px] leading-relaxed text-white/80 outline-none focus:border-accent/40 resize-y"
    />
  );
}

/**
 * Gemeinsame Hülle: Titel, Aktion (z. B. „Posten"), Umschalter Formular/JSON.
 * `render` bekommt die geparsten Daten und schreibt sie zurück.
 */
function StructuredCard<T>({ title, subtitle, action, value, onChange, empty, children, render, preview }: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  empty: () => T;
  children?: ReactNode;
  render: (data: T, write: (next: T) => void) => ReactNode;
  preview?: (data: T) => ReactNode;
}) {
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [showPreview, setShowPreview] = useState(false);

  const parsed = useMemo(() => {
    if (!value || !value.trim()) return { ok: true, data: empty() };
    try {
      const p = JSON.parse(value);
      return { ok: true, data: p as T };
    } catch {
      return { ok: false, data: empty() };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const write = (next: T) => onChange(JSON.stringify(next, null, 2));
  const asJson = mode === 'json' || !parsed.ok;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white/75">{title}</h3>
          {subtitle && <p className="text-[12px] text-white/35 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {action}
          {preview && !asJson && (
            <button
              type="button"
              onClick={() => setShowPreview(p => !p)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] border transition-colors ${
                showPreview
                  ? 'bg-accent/15 border-accent/25 text-accent-light'
                  : 'bg-white/[0.04] border-white/[0.08] text-white/45 hover:text-white/80'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Vorschau
            </button>
          )}
          <ModeSwitch mode={asJson ? 'json' : 'form'} setMode={setMode} locked={!parsed.ok} />
        </div>
      </div>

      {!parsed.ok && (
        <div className="flex items-start gap-2 px-3 py-2.5 mb-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-[12px] text-amber-200/80">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" />
          <span>Der gespeicherte Wert ist kein gültiges JSON — bitte hier korrigieren, danach steht das Formular wieder zur Verfügung.</span>
        </div>
      )}

      {asJson ? (
        <JsonArea value={value} onChange={onChange} />
      ) : (
        <div className="space-y-4">
          {children}
          {render(parsed.data, write)}
          {preview && showPreview && (
            <div className="pt-1">
              <div className="text-[11px] text-white/30 mb-2">So sieht es in Discord aus (vereinfacht):</div>
              {preview(parsed.data)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Vorschau ─────────────────────────── */

/** Markdown-Häppchen, die der Bot tatsächlich nutzt: **fett** und {Platzhalter}. */
function inline(text: string): ReactNode[] {
  const parts = String(text ?? '').split(/(\*\*[^*]+\*\*|\{[a-zA-Z]+\})/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="text-white">{p.slice(2, -2)}</strong>;
    if (/^\{[a-zA-Z]+\}$/.test(p)) return <span key={i} className="px-1 rounded bg-accent/15 text-accent-light">{p}</span>;
    return <span key={i}>{p}</span>;
  });
}

function multiline(text?: string): ReactNode {
  return String(text ?? '').split('\n').map((line, i) => (
    <span key={i} className="block">{line ? inline(line) : ' '}</span>
  ));
}

function DiscordCard({ color, children }: { color?: string; children: ReactNode }) {
  const bar = /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#5865f2';
  return (
    <div className="rounded-xl overflow-hidden bg-[#111117] border border-white/[0.07] flex">
      <span className="w-1 flex-shrink-0" style={{ background: bar }} />
      <div className="p-4 min-w-0 flex-1 font-emoji text-[13px] leading-relaxed text-white/70">{children}</div>
    </div>
  );
}

/* ─────────────────────────── Willkommen / Verabschiedung ─────────────────────────── */

type EmbedMsg = { title?: string; description?: string; color?: string; footer?: string };

export function EmbedMessageEditor({ title, subtitle, action, value, onChange, placeholders, withFooter, footerLabel, headerEmoji }: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholders?: string[];
  withFooter?: boolean;
  footerLabel?: string;
  headerEmoji?: string;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <StructuredCard<EmbedMsg>
      title={title}
      subtitle={subtitle}
      action={action}
      value={value}
      onChange={onChange}
      empty={() => ({})}
      render={(data, write) => {
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-4">
              <TextField label="Titel" value={data.title || ''} onChange={v => write({ ...data, title: v })} placeholder="Willkommen!" />
              <ColorField label="Farbe" value={data.color || ''} onChange={v => write({ ...data, color: v })} />
            </div>
            <AreaField
              label="Beschreibung"
              value={data.description || ''}
              onChange={v => write({ ...data, description: v })}
              rows={5}
              textareaRef={areaRef}
              placeholder="Text der Nachricht — **fett** ist erlaubt."
            />
            {placeholders && placeholders.length > 0 && (
              <PlaceholderChips
                tokens={placeholders}
                value={data.description || ''}
                onChange={v => write({ ...data, description: v })}
                textareaRef={areaRef}
              />
            )}
            {withFooter && (
              <TextField
                label={footerLabel || 'Fußzeile'}
                value={data.footer || ''}
                onChange={v => write({ ...data, footer: v })}
                placeholder="Du bist unser {memberCount}. Mitglied!"
              />
            )}
          </>
        );
      }}
      preview={data => (
        <DiscordCard color={data.color}>
          <div className="text-[15px] font-semibold text-white mb-1.5">
            {headerEmoji ? `${headerEmoji} ` : ''}{data.title || '(kein Titel)'}
          </div>
          <div>{multiline(data.description)}</div>
          {withFooter && data.footer && (
            <div className="text-[11px] text-white/35 mt-2 pt-2 border-t border-white/[0.06]">{inline(data.footer)}</div>
          )}
        </DiscordCard>
      )}
    />
  );
}

/* ─────────────────────────── Regeln ─────────────────────────── */

type RulesSection = { title?: string; rules?: string[] };
type RulesMsg = { title?: string; color?: string; footer?: string; sections?: RulesSection[] };

export function RulesMessageEditor({ title, action, value, onChange }: {
  title: string; action?: ReactNode; value: string; onChange: (v: string) => void;
}) {
  return (
    <StructuredCard<RulesMsg>
      title={title}
      subtitle="Jeder Abschnitt wird zu einem eigenen Block. Eine Regel pro Zeile."
      action={action}
      value={value}
      onChange={onChange}
      empty={() => ({ sections: [] })}
      render={(data, write) => {
        const sections = data.sections || [];
        const setSections = (next: RulesSection[]) => write({ ...data, sections: next });
        const total = sections.reduce((n, s) => n + (s.rules?.length || 0), 0);
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-4">
              <TextField label="Titel" value={data.title || ''} onChange={v => write({ ...data, title: v })} placeholder="📜 Serverregeln" />
              <ColorField label="Farbe" value={data.color || ''} onChange={v => write({ ...data, color: v })} />
            </div>
            <TextField
              label="Text der Akzeptieren-Nachricht (Fußzeile)"
              value={data.footer || ''}
              onChange={v => write({ ...data, footer: v })}
              placeholder="Reagiere mit ✅ um die Regeln zu akzeptieren!"
            />
            <div className="flex items-center justify-between pt-1">
              <span className="text-[12px] text-white/40">
                {sections.length} {sections.length === 1 ? 'Abschnitt' : 'Abschnitte'} · {total} {total === 1 ? 'Regel' : 'Regeln'}
              </span>
            </div>
            <div className="space-y-3">
              {sections.map((s, i) => (
                <ItemFrame
                  key={i}
                  index={i}
                  count={sections.length}
                  badge={`${s.rules?.length || 0} ${(s.rules?.length || 0) === 1 ? 'Regel' : 'Regeln'}`}
                  onMove={dir => setSections(move(sections, i, dir))}
                  onRemove={() => setSections(sections.filter((_, k) => k !== i))}
                >
                  <div className="space-y-3">
                    <TextField
                      label="Abschnitts-Titel"
                      value={s.title || ''}
                      onChange={v => setSections(sections.map((x, k) => (k === i ? { ...x, title: v } : x)))}
                      placeholder="§1 Allgemeines"
                    />
                    <AreaField
                      label="Regeln"
                      value={(s.rules || []).join('\n')}
                      onChange={v => setSections(sections.map((x, k) => (k === i ? { ...x, rules: v.split('\n') } : x)))}
                      rows={Math.min(12, Math.max(3, (s.rules?.length || 1) + 1))}
                      hint="Eine Regel pro Zeile — der Bot setzt die Aufzählungsstriche selbst."
                    />
                  </div>
                </ItemFrame>
              ))}
              <AddBtn onClick={() => setSections([...sections, { title: '', rules: [''] }])} label="Abschnitt hinzufügen" />
            </div>
          </>
        );
      }}
      preview={data => (
        <DiscordCard color={data.color}>
          <div className="text-[15px] font-semibold text-white mb-2">{data.title || '(kein Titel)'}</div>
          {(data.sections || []).slice(0, 3).map((s, i) => (
            <div key={i} className="mb-2">
              <div className="text-white/85 font-medium">{s.title}</div>
              {(s.rules || []).filter(Boolean).slice(0, 4).map((r, k) => (
                <div key={k} className="pl-1">— {inline(r)}</div>
              ))}
              {(s.rules || []).filter(Boolean).length > 4 && <div className="text-white/25 pl-1">…</div>}
            </div>
          ))}
          {(data.sections || []).length > 3 && <div className="text-white/25">… {(data.sections || []).length - 3} weitere Abschnitte</div>}
          {data.footer && (
            <div className="text-[12px] text-white/45 mt-2 pt-2 border-t border-white/[0.06]">✅ {inline(data.footer)}</div>
          )}
        </DiscordCard>
      )}
    />
  );
}

/* ─────────────────────────── Produkte ─────────────────────────── */

type Product = { emoji?: string; name?: string; price?: string; color?: string; description?: string; features?: string };

export function ProductsMessageEditor({ title, action, value, onChange }: {
  title: string; action?: ReactNode; value: string; onChange: (v: string) => void;
}) {
  return (
    <StructuredCard<Product[]>
      title={title}
      subtitle="Jedes Produkt wird als eigene Nachricht mit eigener Farbe gepostet."
      action={action}
      value={value}
      onChange={onChange}
      empty={() => []}
      render={(data, write) => {
        const list = Array.isArray(data) ? data : [];
        const patch = (i: number, p: Partial<Product>) => write(list.map((x, k) => (k === i ? { ...x, ...p } : x)));
        return (
          <div className="space-y-3">
            {list.map((p, i) => (
              <ItemFrame
                key={i}
                index={i}
                count={list.length}
                badge={<span className="font-emoji">{p.emoji} {p.name || 'Ohne Namen'}</span>}
                onMove={dir => write(move(list, i, dir))}
                onRemove={() => write(list.filter((_, k) => k !== i))}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap sm:flex-nowrap items-end gap-3">
                    <EmojiField label="Emoji" value={p.emoji || ''} onChange={v => patch(i, { emoji: v })} />
                    <div className="flex-1 min-w-[160px]">
                      <TextField label="Name" value={p.name || ''} onChange={v => patch(i, { name: v })} placeholder="Web-Entwicklung" />
                    </div>
                    <div className="w-full sm:w-32">
                      <TextField label="Preis" value={p.price || ''} onChange={v => patch(i, { price: v })} placeholder="ab 499 €" />
                    </div>
                    <div className="w-full sm:w-52">
                      <ColorField label="Farbe" value={p.color || ''} onChange={v => patch(i, { color: v })} />
                    </div>
                  </div>
                  <AreaField label="Beschreibung" value={p.description || ''} onChange={v => patch(i, { description: v })} rows={3} />
                  <div>
                    <AreaField
                      label="Leistungen"
                      value={p.features || ''}
                      onChange={v => patch(i, { features: v })}
                      rows={4}
                      hint="Eine Leistung pro Zeile."
                    />
                    <button
                      type="button"
                      onClick={() => patch(i, {
                        features: (p.features || '')
                          .split('\n')
                          .map(l => (l.trim() ? (/^(➜|-|•)\s*/.test(l.trim()) ? l.trim().replace(/^(➜|-|•)\s*/, '➜ ') : `➜ ${l.trim()}`) : l))
                          .join('\n'),
                      })}
                      className="mt-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/45 hover:text-white/80 transition-colors font-emoji"
                    >
                      ➜ vor jede Zeile setzen
                    </button>
                  </div>
                </div>
              </ItemFrame>
            ))}
            <AddBtn onClick={() => write([...list, { emoji: '📦', name: '', price: '', color: '#00ff88', description: '', features: '' }])} label="Produkt hinzufügen" />
          </div>
        );
      }}
      preview={data => (
        <div className="space-y-2">
          {(Array.isArray(data) ? data : []).slice(0, 2).map((p, i) => (
            <DiscordCard key={i} color={p.color}>
              <div className="text-[15px] font-semibold text-white mb-1 font-emoji">{p.emoji} {p.name}</div>
              <div>{multiline(p.description)}</div>
              {p.features && <div className="mt-2 text-white/60">{multiline(p.features)}</div>}
              {p.price && <div className="mt-2 text-white/80">💰 <strong className="text-white">Preis:</strong> {p.price}</div>}
            </DiscordCard>
          ))}
          {(Array.isArray(data) ? data : []).length > 2 && (
            <div className="text-[11px] text-white/25">… {(data as Product[]).length - 2} weitere Produkte</div>
          )}
        </div>
      )}
    />
  );
}

/* ─────────────────────────── Social / Links ─────────────────────────── */

type SocialLink = { emoji?: string; name?: string; url?: string; description?: string };
type SocialMsg = { title?: string; description?: string; links?: SocialLink[] };

export function SocialMessageEditor({ title, action, value, onChange }: {
  title: string; action?: ReactNode; value: string; onChange: (v: string) => void;
}) {
  return (
    <StructuredCard<SocialMsg>
      title={title}
      subtitle="Links mit https:// bekommen einen Öffnen-Button, alles andere landet in der Fußzeile."
      action={action}
      value={value}
      onChange={onChange}
      empty={() => ({ links: [] })}
      render={(data, write) => {
        const links = data.links || [];
        const setLinks = (next: SocialLink[]) => write({ ...data, links: next });
        const patch = (i: number, p: Partial<SocialLink>) => setLinks(links.map((x, k) => (k === i ? { ...x, ...p } : x)));
        return (
          <>
            <TextField label="Titel" value={data.title || ''} onChange={v => write({ ...data, title: v })} placeholder="🌐 Meine Kanäle" />
            <AreaField label="Einleitung" value={data.description || ''} onChange={v => write({ ...data, description: v })} rows={2} />
            <div className="space-y-3">
              {links.map((l, i) => (
                <ItemFrame
                  key={i}
                  index={i}
                  count={links.length}
                  badge={<span className="font-emoji">{l.emoji} {l.name || 'Ohne Namen'}</span>}
                  onMove={dir => setLinks(move(links, i, dir))}
                  onRemove={() => setLinks(links.filter((_, k) => k !== i))}
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap sm:flex-nowrap items-end gap-3">
                      <EmojiField label="Emoji" value={l.emoji || ''} onChange={v => patch(i, { emoji: v })} />
                      <div className="flex-1 min-w-[150px]">
                        <TextField label="Name" value={l.name || ''} onChange={v => patch(i, { name: v })} placeholder="Portfolio" />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <TextField label="Adresse" value={l.url || ''} onChange={v => patch(i, { url: v })} placeholder="https://mas0n1x.online" mono />
                      </div>
                    </div>
                    <TextField label="Beschreibung" value={l.description || ''} onChange={v => patch(i, { description: v })} />
                  </div>
                </ItemFrame>
              ))}
              <AddBtn onClick={() => setLinks([...links, { emoji: '🔗', name: '', url: '', description: '' }])} label="Link hinzufügen" />
            </div>
          </>
        );
      }}
      preview={data => (
        <DiscordCard color="#00d4ff">
          <div className="text-[15px] font-semibold text-white font-emoji">{data.title || '(kein Titel)'}</div>
          {data.description && <div className="text-[11px] text-white/35 mb-2">{inline(data.description)}</div>}
          <div className="space-y-1.5 mt-2">
            {(data.links || []).slice(0, 5).map((l, i) => (
              <div key={i} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-emoji text-white/85">{l.emoji || '🔗'} <strong className="text-white">{l.name}</strong></div>
                  {l.description && <div className="text-[11px] text-white/35 truncate">{l.description}</div>}
                </div>
                {/^https?:\/\//i.test(l.url || '') && (
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.08] text-[11px] text-white/60 flex-shrink-0">Öffnen</span>
                )}
              </div>
            ))}
            {(data.links || []).length > 5 && <div className="text-white/25">… {(data.links || []).length - 5} weitere</div>}
          </div>
        </DiscordCard>
      )}
    />
  );
}

/* ─────────────────────────── Ticket-Kategorien ─────────────────────────── */

type TicketCategory = { name?: string; emoji?: string; description?: string };

export function TicketCategoriesEditor({ title, action, value, onChange }: {
  title: string; action?: ReactNode; value: string; onChange: (v: string) => void;
}) {
  return (
    <StructuredCard<TicketCategory[]>
      title={title}
      subtitle="Erscheinen im Ticket-Panel als Auswahl."
      action={action}
      value={value}
      onChange={onChange}
      empty={() => []}
      render={(data, write) => {
        const list = Array.isArray(data) ? data : [];
        const patch = (i: number, p: Partial<TicketCategory>) => write(list.map((x, k) => (k === i ? { ...x, ...p } : x)));
        return (
          <div className="space-y-3">
            {list.map((c, i) => (
              <ItemFrame
                key={i}
                index={i}
                count={list.length}
                badge={<span className="font-emoji">{c.emoji} {c.name || 'Ohne Namen'}</span>}
                onMove={dir => write(move(list, i, dir))}
                onRemove={() => write(list.filter((_, k) => k !== i))}
              >
                <div className="flex flex-wrap sm:flex-nowrap items-end gap-3">
                  <EmojiField label="Emoji" value={c.emoji || ''} onChange={v => patch(i, { emoji: v })} />
                  <div className="flex-1 min-w-[150px]">
                    <TextField label="Name" value={c.name || ''} onChange={v => patch(i, { name: v })} placeholder="Allgemeine Frage" />
                  </div>
                  <div className="flex-[2] min-w-[200px]">
                    <TextField label="Beschreibung" value={c.description || ''} onChange={v => patch(i, { description: v })} placeholder="Allgemeine Fragen zum Server" />
                  </div>
                </div>
              </ItemFrame>
            ))}
            <AddBtn onClick={() => write([...list, { emoji: '❓', name: '', description: '' }])} label="Kategorie hinzufügen" />
          </div>
        );
      }}
      preview={data => (
        <DiscordCard color="#00ff88">
          <div className="text-[15px] font-semibold text-white mb-2">🎫 Support-Ticket erstellen</div>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(data) ? data : []).map((c, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg bg-white/[0.07] border border-white/[0.08] text-[12px] text-white/75 font-emoji">
                {c.emoji} {c.name || '—'}
              </span>
            ))}
          </div>
        </DiscordCard>
      )}
    />
  );
}
