import React, { useEffect, useState } from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '../icons/StatIcons';

/**
 * Stat Change Animation - Floating particles shown when a Pokémon's stat changes.
 * Buffs float upward with glow; debuffs float downward with shake.
 * Auto-removes after ~1.5s via animationend event.
 */

export type StatKey = 'attack' | 'defense' | 'spAttack' | 'spDefense';

export interface StatChangeItem {
  stat: StatKey;
  change: number;
  totalStage: number;
  isBuff: boolean;
}

interface StatChangeAnimationProps {
  statChanges: StatChangeItem[];
  position: 'player' | 'enemy';
  onComplete?: () => void;
}

interface StatIconConfig {
  icon: string;
  color: string;
}

const STAT_ICON_CONFIG: Record<StatKey, StatIconConfig> = {
  attack: { icon: '\u2694\uFE0F', color: '#ff4444' },
  defense: { icon: '\uD83D\uDEE1\uFE0F', color: '#4488ff' },
  spAttack: { icon: '\u2728\u2694\uFE0F', color: '#aa44ff' },
  spDefense: { icon: '\u2728\uD83D\uDEE1\uFE0F', color: '#44ddff' },
};

const STAT_COLORS: Record<StatKey, string> = {
  attack: '#ff4444',
  defense: '#4488ff',
  spAttack: '#aa44ff',
  spDefense: '#44ddff',
};

function getArrowIndicator(stage: number, isBuff: boolean, color: string): React.ReactNode {
  if (stage === 0) return null;
  const Arrow = isBuff ? ArrowUpIcon : ArrowDownIcon;
  return <Arrow size={14} color={color} />;
}

function StatChangeParticle({ stat, isBuff, delay }: { stat: StatKey; isBuff: boolean; delay: number }) {
  const color = STAT_COLORS[stat];
  const angle = isBuff ? -30 - Math.random() * 120 : 30 + Math.random() * 120;
  const distance = 30 + Math.random() * 40;

  return (
    <div
      className={`stat-change-particle ${isBuff ? 'buff-particle' : 'debuff-particle'}`}
      style={{
        left: `${50 + (Math.random() - 0.5) * 60}%`,
        top: '50%',
        animationDelay: `${delay}ms`,
        '--particle-angle': `${angle}deg`,
        '--particle-distance': `${distance}px`,
        backgroundColor: color,
      } as React.CSSProperties}
    />
  );
}

const StatChangeAnimation: React.FC<StatChangeAnimationProps> = ({
  statChanges,
  position,
  onComplete,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (statChanges.length === 0) {
      setVisible(false);
      onComplete?.();
      return;
    }

    // Auto-remove after animation duration
    const maxMagnitude = Math.max(...statChanges.map(sc => Math.abs(sc.change)), 1);
    const duration = maxMagnitude >= 3 ? 1200 : 800;
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, duration + 500); // +500ms for fade out

    return () => clearTimeout(timer);
  }, [statChanges, onComplete]);

  if (!visible || statChanges.length === 0) return null;

  const hasBuff = statChanges.some(sc => sc.isBuff);
  const hasDebuff = statChanges.some(sc => !sc.isBuff);
  const hasMagnitude3Plus = statChanges.some(sc => Math.abs(sc.change) >= 3);

  return (
    <div
      className={`stat-change-animation ${position} ${hasBuff ? 'has-buff' : ''} ${hasDebuff ? 'has-debuff' : ''} ${hasMagnitude3Plus ? 'magnitude-strong' : ''}`}
    >
        {statChanges.map((sc, idx) => {
        const config = STAT_ICON_CONFIG[sc.stat];
        const arrowColor = sc.isBuff ? '#60CFFF' : '#FF6040';

        return (
          <div
            key={`${sc.stat}-${idx}`}
            className={`stat-change-item ${sc.isBuff ? 'stat-buff' : 'stat-debuff'}`}
            style={{
              animationDelay: `${idx * 100}ms`,
              '--stat-color': STAT_COLORS[sc.stat],
              '--glow-color': sc.isBuff ? STAT_COLORS[sc.stat] : 'transparent',
            } as React.CSSProperties}
          >
            {/* Stat Icon */}
            <span className="stat-change-icon">{config.icon}</span>
            {/* Arrow indicator (SVG) */}
            <span className={`stat-change-arrow ${sc.isBuff ? 'arrow-buff' : 'arrow-debuff'}`}>
              {getArrowIndicator(sc.totalStage, sc.isBuff, arrowColor)}
            </span>
            {/* Direction sign */}
            <span className="stat-change-sign">
              {sc.isBuff ? '+' : ''}{sc.change}
            </span>
          </div>
        );
      })}

      {/* Floating particles */}
      {statChanges.map((sc, idx) =>
        Array.from({ length: sc.isBuff ? 5 : 4 }).map((_, pIdx) => (
          <StatChangeParticle
            key={`p-${idx}-${pIdx}`}
            stat={sc.stat}
            isBuff={sc.isBuff}
            delay={idx * 100 + pIdx * 80}
          />
        ))
      )}

      {/* Glow overlay for buffs */}
      {hasBuff && <div className="stat-buff-glow-overlay" />}

      {/* Shake overlay for debuffs */}
      {hasDebuff && <div className="stat-debuff-shake-overlay" />}

      {/* prefers-reduced-motion static flash */}
      <div className="stat-change-static-flash" />
    </div>
  );
};

export default StatChangeAnimation;
export { StatChangeAnimation };
