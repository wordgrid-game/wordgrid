import { Puzzle } from './puzzle';
import { Board, type TimeConfig } from './board';
import type { EloHolder } from '../elo/elo';

export class Match {
  uuid: string;
  puzzle: Puzzle;
  timeConfig: TimeConfig;

  playerA: EloHolder;
  playerB: EloHolder;

  boardA: Board;
  boardB: Board;

  constructor(uuid: string, playerA: EloHolder, playerB: EloHolder, seed: number, timeConfig: TimeConfig) {
    this.uuid = uuid;
    this.puzzle = new Puzzle(seed);
    this.timeConfig = timeConfig;

    this.playerA = playerA;
    this.playerB = playerB;

    this.boardA = new Board(seed, 'online', timeConfig, this.puzzle);
    this.boardB = new Board(seed, 'online', timeConfig, this.puzzle);
  }
}
