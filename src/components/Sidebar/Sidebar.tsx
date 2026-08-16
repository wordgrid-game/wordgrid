import React, { useMemo } from 'react';
import {
  IconArrowLeft,
  IconBrain,
  IconBug,
  IconClock,
  IconHash,
  IconHistory,
  IconInfoCircle,
  IconLock,
  IconPlus,
  IconQuestionMark,
  IconShare,
  IconStarFilled,
  IconUser,
} from '@tabler/icons-react';
import { Board } from 'common/game/board';
import { formatSecondsAsCountdown } from 'common/utils';
import type { GameMode } from 'common/game/constants';
import type { PublicUser } from 'src/lib/httpClient';
import 'components/Sidebar/Sidebar.css';

export interface SidebarProps {
  board?: Board | null;
  mode?: GameMode;
  seedHidden?: boolean;
  analysisMode?: boolean;
  secondsRemaining?: number;
  dailyCountdown?: string;
  puzzleFinished?: boolean;
  user?: PublicUser | null;
  openAccountPage?: () => void;
  openGamePage?: () => void;
  hideGameInfo?: boolean;
  setMode?: (mode: GameMode) => void;
  setSeedHidden?: (hidden: boolean) => void;
  enterNormalMode?: () => void;
  enterAnalysisMode?: () => void;
  copyShareLink?: () => Promise<void>;
  rerollInfiniteBoard?: () => void;
  openResetConfirmModal?: () => void;
  openDebugModal?: () => void;
  openInfoModal?: () => void;
}

interface InfoRowProps {
  icon: React.ReactNode;
  children: React.ReactNode;
}

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, children }) => (
  <div className="info-row">
    <span className="info-icon" aria-hidden="true">
      {icon}
    </span>
    <span className="info-value">{children}</span>
  </div>
);

const IconButton: React.FC<IconButtonProps> = ({ icon, label, onClick }) => (
  <button type="button" className="dock-action" title={label} aria-label={label} onClick={onClick}>
    {icon}
    <span className="sr-only">{label}</span>
  </button>
);

const GameStats: React.FC<{
  guessCount: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
}> = ({ guessCount, totalScore, maxScore, percentage }) => {
  const guessText = guessCount === 1 ? 'guess' : 'guesses';
  return (
    <>
      <InfoRow icon={<IconQuestionMark width={20} />}>{`${guessCount} ${guessText}`}</InfoRow>
      <InfoRow icon={<IconStarFilled width={20} />}>
        {`${totalScore} / ${maxScore} (${percentage}%)`}
      </InfoRow>
    </>
  );
};

function useBoardStats(board?: Board | null) {
  return useMemo(() => {
    if (!board) {
      return {
        guessCount: 0,
        totalScore: 0,
        maxScore: 0,
        percentage: 0,
        isUnlimited: false,
      };
    }
    const guessCount = board.guessedWords.length;
    const totalScore = board.totalScore;
    const maxScore = board.puzzle.maxScore;
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const isUnlimited = board.timeConfig.unlimited;

    return { guessCount, totalScore, maxScore, percentage, isUnlimited };
  }, [board]);
}

export const Sidebar: React.FC<SidebarProps> = ({
  board,
  mode,
  seedHidden,
  analysisMode,
  secondsRemaining = 0,
  dailyCountdown = '',
  puzzleFinished,
  user,
  openAccountPage,
  openGamePage,
  hideGameInfo,
  setMode,
  setSeedHidden,
  enterNormalMode,
  enterAnalysisMode,
  copyShareLink,
  rerollInfiniteBoard,
  openResetConfirmModal,
  openDebugModal,
  openInfoModal,
}) => {
  const stats = useBoardStats(board);

  const renderNavigationOnly = () => (
    <>
      {openGamePage && (
        <button type="button" className="analysis-back" onClick={openGamePage}>
          <span className="info-icon" aria-hidden="true">
            <IconArrowLeft width={20} />
          </span>
          <span className="info-value">Back to Game</span>
        </button>
      )}
      <div className="dock">
        {openInfoModal && (
          <IconButton icon={<IconInfoCircle width={15} />} label="Info" onClick={openInfoModal} />
        )}
      </div>
    </>
  );

  const renderAnalysisMode = () => (
    <>
      <button type="button" className="analysis-back" onClick={enterNormalMode}>
        <span className="info-icon" aria-hidden="true">
          <IconArrowLeft width={20} />
        </span>
        <span className="info-value">Leave analysis</span>
      </button>

      <InfoRow icon={<IconBrain width={20} />}>Analysis Mode</InfoRow>

      {mode !== 'daily' && !stats.isUnlimited && (
        <InfoRow icon={<IconClock width={20} />}>
          {formatSecondsAsCountdown(secondsRemaining)}
        </InfoRow>
      )}

      <GameStats {...stats} />
    </>
  );

  const renderStandardMode = () => {
    const isDaily = mode === 'daily';
    const isSeedMasked = !board || (!isDaily && seedHidden);
    const displaySeed = isSeedMasked ? '--------' : board.seedString;

    return (
      <>
        <div className="info-row">
          <button
            type="button"
            className="info-icon-btn"
            aria-label={seedHidden ? 'Show seed' : 'Hide seed'}
            onClick={() => setSeedHidden?.(isDaily ? false : !seedHidden)}
            disabled={isDaily}
          >
            {seedHidden && !isDaily ? <IconLock width={20} /> : <IconHash width={20} />}
          </button>
          <span className="info-value">{displaySeed}</span>
        </div>

        <div className="info-row mode-row">
          <div className="mode-toggle" role="tablist" aria-label="Game mode">
            <button
              type="button"
              className={`mode-btn ${isDaily ? 'active' : ''}`}
              role="tab"
              aria-selected={isDaily}
              onClick={() => setMode?.('daily')}
            >
              Daily
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'infinite' ? 'active' : ''}`}
              role="tab"
              aria-selected={mode === 'infinite'}
              onClick={() => setMode?.('infinite')}
            >
              Infinite
            </button>
          </div>
        </div>

        {(isDaily || !stats.isUnlimited) && (
          <InfoRow icon={<IconClock width={20} />}>
            {isDaily ? dailyCountdown : formatSecondsAsCountdown(secondsRemaining)}
          </InfoRow>
        )}

        <GameStats {...stats} />

        <div className="dock">
          {mode === 'infinite' && (
            <>
              <IconButton
                icon={<IconShare width={15} />}
                label="Share infinite puzzle"
                onClick={() => {
                  if (copyShareLink) void copyShareLink();
                }}
              />
              <IconButton
                icon={<IconPlus width={15} />}
                label="Reroll puzzle"
                onClick={rerollInfiniteBoard}
              />
            </>
          )}

          <IconButton
            icon={<IconHistory width={15} />}
            label="Reset board"
            onClick={openResetConfirmModal}
          />

          {puzzleFinished && (
            <IconButton
              icon={<IconBrain width={15} />}
              label="Analysis mode"
              onClick={enterAnalysisMode}
            />
          )}

          <IconButton icon={<IconBug width={15} />} label="Debug stats" onClick={openDebugModal} />
          <IconButton icon={<IconInfoCircle width={15} />} label="Info" onClick={openInfoModal} />
          <IconButton icon={<IconUser width={15} />} label="Account" onClick={openAccountPage} />
        </div>
      </>
    );
  };

  return (
    <aside className="sidebar">
      {user && !hideGameInfo && (
        <button
          type="button"
          className="sidebar-account-bar"
          onClick={openAccountPage}
          title="Account Details"
        >
          <IconUser width={18} />
          <span className="sidebar-username">{user.username}</span>
        </button>
      )}

      <div className="board-info">
        {(() => {
          if (hideGameInfo) {
            return renderNavigationOnly();
          } else if (analysisMode) {
            return renderAnalysisMode();
          } else {
            return renderStandardMode();
          }
        })()}
      </div>
    </aside>
  );
};
