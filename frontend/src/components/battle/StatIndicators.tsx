import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '../icons/StatIcons';

/**
 * StatIndicators - Shows current stat stage levels for a Pokémon.
 * Renders compact SVG icons with arrows indicating buff/debuff magnitude.
 */

export type StatKey = 'attack' | 'defense' | 'spAttack' | 'spDefense';

interface StatIndicatorsProps {
  statStages: {
    attack: number;
    defense: number;
    spAttack: number;
    spDefense: number;
  };
  position?: 'side-left' | 'side-right' | 'inline';
}

interface StatConfig {
  label: string;
  icon: string;
  color: string;
}

const STAT_CONFIG: Record<StatKey, StatConfig> = {
  attack: { label: 'Atk', icon: '\u2694\uFE0F', color: '#ff6666' },
  defense: { label: 'Def', icon: '\uD83D\uDEE1\uFE0F', color: '#66aaff' },
  spAttack: { label: 'SpA', icon: '\u2728\u2694\uFE0F', color: '#bb66ff' },
  spDefense: { label: 'SpD', icon: '\u2728\uD83D\uDEE1\uFE0F', color: '#66eeff' },
};

function renderArrows(stage: number, color: string): React.ReactNode[] {
  if (stage === 0) return [];
  const Arrow = stage > 0 ? ArrowUpIcon : ArrowDownIcon;
  return [<Arrow key="a" size={7} color={color} />];
}

const StatIndicators: React.FC<StatIndicatorsProps> = ({
  statStages,
  position = 'inline',
}) => {
  const entries = (Object.keys(STAT_CONFIG) as StatKey[]).map(stat => ({
    stat,
    stage: statStages[stat] || 0,
    config: STAT_CONFIG[stat],
  }));

  // Filter to only non-zero stages OR always show (up to design)
  const nonZeroEntries = entries.filter(e => e.stage !== 0);

  if (nonZeroEntries.length === 0) return null;

  return (
    <div className={`stat-indicators-container ${position}`}>
      {nonZeroEntries.map(({ stat, stage, config }) => {
        const isBuff = stage > 0;
        const className = [
          'stat-indicator-item',
          isBuff ? 'stat-indicator-buff' : 'stat-indicator-debuff',
          `stat-indicator-${stat}`,
        ].join(' ');

        return (
          <div key={stat} className={className} title={`${config.label}: ${stage > 0 ? '+' : ''}${stage}`}>
            <span className="stat-indicator-icon">{config.icon}</span>
            <span className="stat-indicator-arrows">
              {renderArrows(stage, config.color)}
            </span>
            <span className="stat-indicator-value">{stage > 0 ? `+${stage}` : stage}</span>
          </div>
        );
      })}
    </div>
  );
};

export default StatIndicators;
export { StatIndicators };
