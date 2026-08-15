import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import type { GameMode } from 'common/game/constants';
import { type DebugStats } from 'common/game/puzzle';
import { ModalsContainer } from 'components/Modal/ModalsContainer';
import { Game } from 'pages/Game';
import { Account } from 'pages/Account';
import { Sidebar } from 'components/Sidebar/Sidebar';
import { httpClient, type PublicUser } from 'src/lib/httpClient';
import 'src/App.css';
import type {
  GuessModalState,
  MessageModalState,
  ConfirmModalState,
} from 'components/Modal/modalTypes';

function getInitialMode(): GameMode {
  if (globalThis.window === undefined) return 'daily';
  const searchParams = new URL(globalThis.window.location.href).searchParams;
  return searchParams.get('mode') === 'infinite' || searchParams.has('seed') ? 'infinite' : 'daily';
}

function App() {
  const [page, setPage] = useState<'game' | 'account'>('game');
  const [user, setUser] = useState<PublicUser | null>(() => httpClient.getStoredUser());

  const [mode, setMode] = useState<GameMode>(getInitialMode);

  const [guessModal, setGuessModal] = useState<GuessModalState | null>(null);
  const [messageModal, setMessageModal] = useState<MessageModalState | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [debugModal, setDebugModal] = useState(false);
  const [debugStats, setDebugStats] = useState<DebugStats | null>(null);
  const [infoModal, setInfoModal] = useState(false);

  const guessInputRef = useRef<HTMLInputElement | null>(null);
  const wasGuessModalOpen = useRef(false);

  const gameSubmitRef = useRef<(() => void) | null>(null);
  const gameHintRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    httpClient.getMe().then(res => {
      if (res.success && res.user) {
        setUser(res.user);
      } else if (!res.success && httpClient.getToken()) {
        setUser(null);
      }
    });
  }, []);

  useEffect(() => {
    setGuessModal(null);
    setMessageModal(null);
    setConfirmModal(null);
  }, [mode]);

  useEffect(() => {
    const isOpen = guessModal !== null;
    if (isOpen && !wasGuessModalOpen.current) {
      guessInputRef.current?.focus();
      guessInputRef.current?.select();
    }
    wasGuessModalOpen.current = isOpen;
  }, [guessModal]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (messageModal) setMessageModal(null);
        if (guessModal) setGuessModal(null);
        if (confirmModal) setConfirmModal(null);
        if (debugModal) setDebugModal(false);
        return;
      }
      if (event.key === 'Enter' && messageModal) {
        setMessageModal(null);
        event.preventDefault();
        return;
      }
      if (event.key === 'Enter' && confirmModal) {
        confirmModal.onConfirm();
        event.preventDefault();
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [confirmModal, guessModal, messageModal, debugModal]);

  const handleGuessSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (gameSubmitRef.current) {
      gameSubmitRef.current();
    }
  };

  const handleGetHint = () => {
    if (gameHintRef.current) {
      gameHintRef.current();
    }
  };

  return (
    <>
      <div className="app">
        {page === 'account' ? (
          <main>
            <Account user={user} setUser={setUser} />
            <Sidebar
              user={user}
              openAccountPage={() => setPage('account')}
              openGamePage={() => setPage('game')}
              hideGameInfo={true}
              openInfoModal={() => setInfoModal(true)}
            />
          </main>
        ) : (
          <Game
            mode={mode}
            setMode={setMode}
            guessModal={guessModal}
            setGuessModal={setGuessModal}
            setMessageModal={setMessageModal}
            setConfirmModal={setConfirmModal}
            setDebugModal={setDebugModal}
            setDebugStats={setDebugStats}
            setInfoModal={setInfoModal}
            gameSubmitRef={gameSubmitRef}
            gameHintRef={gameHintRef}
            user={user}
            openAccountPage={() => setPage('account')}
          />
        )}
      </div>

      <ModalsContainer
        guessModal={guessModal}
        messageModal={messageModal}
        confirmModal={confirmModal}
        debugModal={debugModal}
        debugStats={debugStats}
        infoModal={infoModal}
        guessInputRef={guessInputRef}
        setGuessModal={setGuessModal}
        closeGuessModal={() => setGuessModal(null)}
        getHintForGuessModal={handleGetHint}
        handleGuessSubmit={handleGuessSubmit}
        closeMessageModal={() => setMessageModal(null)}
        closeConfirmModal={() => setConfirmModal(null)}
        closeDebugModal={() => setDebugModal(false)}
        handleClearDebugStats={() => {
          setDebugStats(null);
        }}
        closeInfoModal={() => setInfoModal(false)}
      />
    </>
  );
}

export default App;
