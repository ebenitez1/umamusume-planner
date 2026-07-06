import { useEffect } from 'react';
import type { OptimizerResult } from '../../types';

interface ExplainBuildModalProps {
  explain: OptimizerResult['explain'];
  onClose: () => void;
}

interface SectionProps {
  title: string;
  className: string;
  items: string[];
  emptyText: string;
}

function Section({ title, className, items, emptyText }: SectionProps) {
  return (
    <div className={`explain-section ${className}`}>
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="explain-empty">{emptyText}</p>
      ) : (
        <ul>
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Explain Build modal: consistency strengths, risks, and optimizer warnings
 * from the last optimizer run. Closes on Escape and on backdrop click.
 */
export function ExplainBuildModal({ explain, onClose }: ExplainBuildModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Explain build">
        <div className="modal-head">
          <h2>Explain Build</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <Section
          title="Consistency Strengths"
          className="strengths"
          items={explain.strengths}
          emptyText="No standout strengths — try raising aptitudes or adding higher-consistency skills."
        />
        <Section
          title="Risks"
          className="risks"
          items={explain.risks}
          emptyText="No notable risks detected in this build."
        />
        <Section
          title="Optimizer Warnings"
          className="warnings"
          items={explain.warnings}
          emptyText="No warnings — every candidate skill is usable in this race."
        />
      </div>
    </div>
  );
}
