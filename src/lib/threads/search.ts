/**
 * How the Threads engine (M3) chooses a move: it scores boards with the classic heuristic for
 * this puzzle and searches every combination of placements for the next K pieces.
 *
 * - Scores are integers (the weights below, times 100), so comparisons are exact and ties are
 *   broken by order alone. The same input always gives the same answer, on any machine.
 * - A transposition table (`memo`) can remember the best result for a board at a given depth,
 *   so a board reached by two orders of moves is searched once. It never changes the answer
 *   (tests/unit/threads.test.ts checks that), but it's off by default: measured on the
 *   benchmark board (tests/bench), it found no repeated boards at depth 3 and building its keys
 *   made the search about twice as slow. It stays as an option for deeper searches.
 * - The work is already split for parallelism: `rootTasks` lists one task per placement of the
 *   first piece, `solveTask` searches one, and `pickBest` combines them. Searching every task
 *   and picking the best gives exactly what `search` gives; the Workers in M3.2 rely on that.
 */
import { columnHeights, placements, type Board, type Placement } from './board';
import type { PieceName } from './pieces';

/**
 * A widely used set of weights for this heuristic, scaled to integers: lines cleared help;
 * aggregate height, holes and bumpiness hurt.
 */
export const WEIGHTS = { lines: 76, aggregateHeight: -51, holes: -36, bumpiness: -18 } as const;

/** Losing (no legal placement) scores below anything a real board can reach. */
const GAME_OVER = -1_000_000_000;

export interface Features {
  aggregateHeight: number;
  holes: number;
  bumpiness: number;
}

export function features(board: Board): Features {
  const heights = columnHeights(board);
  let holes = 0;
  for (let x = 0; x < board.width; x++)
    for (let y = 0; y < heights[x]! - 1; y++) if (!(board.rows[y]! & (1 << x))) holes++;
  let bumpiness = 0;
  for (let x = 1; x < board.width; x++) bumpiness += Math.abs(heights[x]! - heights[x - 1]!);
  return { aggregateHeight: heights.reduce((a, b) => a + b, 0), holes, bumpiness };
}

export function boardScore(board: Board): number {
  const f = features(board);
  return (
    WEIGHTS.aggregateHeight * f.aggregateHeight + WEIGHTS.holes * f.holes + WEIGHTS.bumpiness * f.bumpiness
  );
}

/** A chosen placement, without the resulting board (small enough to send between Workers). */
export interface Move {
  piece: PieceName;
  rotation: number;
  x: number;
  y: number;
  lines: number;
}

export interface SearchResult {
  /** Score of the best line of play: lines cleared along it, plus the final board's score. */
  score: number;
  /** The best moves, first piece first. Empty if the first piece can't be placed. */
  moves: Move[];
  /** Placements tried, a measure of work. */
  nodes: number;
}

export interface SearchOptions {
  /** Remember boards already searched at the same depth. Exact, off by default (see above). */
  memo?: boolean;
}

const toMove = ({ piece, rotation, x, y, lines }: Placement): Move => ({ piece, rotation, x, y, lines });

interface Best {
  score: number;
  moves: Move[];
}

/** The search itself: the best future score from `board` with pieces[depth..end). */
function searcher(pieces: readonly PieceName[], end: number, options: SearchOptions) {
  const memo = options.memo === true ? new Map<string, Best>() : null;
  let nodes = 0;
  const best = (board: Board, depth: number): Best => {
    if (depth === end) return { score: boardScore(board), moves: [] };
    const key = memo ? `${depth}|${board.rows.join(',')}` : '';
    const cached = memo?.get(key);
    if (cached) return cached;
    let found: Best = { score: GAME_OVER + depth, moves: [] };
    for (const p of placements(board, pieces[depth]!)) {
      nodes++;
      const rest = best(p.board, depth + 1);
      const score = WEIGHTS.lines * p.lines + rest.score;
      if (score > found.score || found.moves.length === 0)
        found = { score, moves: [toMove(p), ...rest.moves] };
    }
    memo?.set(key, found);
    return found;
  };
  return { best, nodes: () => nodes };
}

/** The best line of play for the next `depth` pieces (fewer if the list is shorter). */
export function search(
  board: Board,
  pieces: readonly PieceName[],
  depth: number,
  options: SearchOptions = {},
): SearchResult {
  const end = Math.min(depth, pieces.length);
  const s = searcher(pieces, end, options);
  const found = s.best(board, 0);
  return { score: found.score, moves: found.moves, nodes: s.nodes() };
}

/** One unit of parallel work: the subtree under one placement of the first piece. */
export interface Task {
  index: number;
  move: Move;
  board: Board;
}

export function rootTasks(board: Board, pieces: readonly PieceName[]): Task[] {
  const [first] = pieces;
  if (!first) return [];
  return placements(board, first).map((p, index) => ({ index, move: toMove(p), board: p.board }));
}

export interface TaskResult {
  index: number;
  score: number;
  moves: Move[];
  nodes: number;
}

/** Searches one task's subtree; `depth` counts the first piece, as in `search`. */
export function solveTask(
  task: Task,
  pieces: readonly PieceName[],
  depth: number,
  options: SearchOptions = {},
): TaskResult {
  const end = Math.min(depth, pieces.length);
  const s = searcher(pieces, end, options);
  const rest = s.best(task.board, 1);
  return {
    index: task.index,
    score: WEIGHTS.lines * task.move.lines + rest.score,
    moves: [task.move, ...rest.moves],
    nodes: s.nodes() + 1,
  };
}

/** The best of several task results; ties go to the lowest task index, as in `search`. */
export function pickBest(results: readonly TaskResult[]): SearchResult {
  const nodes = results.reduce((n, r) => n + r.nodes, 0);
  const winner = [...results].sort((a, b) => b.score - a.score || a.index - b.index)[0];
  return winner
    ? { score: winner.score, moves: winner.moves, nodes }
    : { score: GAME_OVER, moves: [], nodes };
}

export interface GameResult {
  moves: Move[];
  board: Board;
  lines: number;
  nodes: number;
  /** True when a piece couldn't be placed and the game ended early. */
  toppedOut: boolean;
}

/**
 * Plays a whole sequence: before each piece, searches `lookahead` pieces ahead and commits only
 * the first move, as the 2022 assignment asked, but over every combination instead of one
 * piece at a time.
 */
export function play(
  board: Board,
  pieces: readonly PieceName[],
  lookahead: number,
  options: SearchOptions = {},
): GameResult {
  let current = board;
  const moves: Move[] = [];
  let lines = 0;
  let nodes = 0;
  for (let i = 0; i < pieces.length; i++) {
    const found = search(current, pieces.slice(i), lookahead, options);
    nodes += found.nodes;
    const next = found.moves[0];
    if (!next) return { moves, board: current, lines, nodes, toppedOut: true };
    const placed = placements(current, next.piece).find(
      (p) => p.rotation === next.rotation && p.x === next.x,
    )!;
    current = placed.board;
    lines += placed.lines;
    moves.push(next);
  }
  return { moves, board: current, lines, nodes, toppedOut: false };
}
