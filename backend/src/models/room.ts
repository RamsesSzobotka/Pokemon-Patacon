export interface Room {
  _id?: any;
  code: string;
  player_1: string | null;
  player_2: string | null;
  team_1: number[];
  team_2: number[];
  status: 'waiting' | 'in_draft' | 'in_battle' | 'finished';
  winner: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
}