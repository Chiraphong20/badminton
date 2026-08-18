import { Member, Court, Rank } from '../types';

export const mkMember = (id: string, name: string, rank: Rank, gamesPlayed: number, offset: number): Member => ({
  id, name, rank, gamesPlayed,
  checkInTime: Date.now() - offset,
  status: 'waiting',
  balance: 0, courtBalance: 0, shuttleBalance: 0, shuttleCount: 0, snackBalance: 0,
  snackHistory: [],
  paidCourtFee: false,
  totalCourt: 0, totalShuttle: 0, totalSnack: 0,
});

export const INITIAL_MEMBERS: Member[] = [];

export const INITIAL_COURTS: Court[] = [
  { id: 'c1', name: 'คอร์ด 1', players: [null, null, null, null], status: 'empty', shuttlecocks: 1 },
  { id: 'c2', name: 'คอร์ด 2', players: [null, null, null, null], status: 'empty', shuttlecocks: 1 },
  { id: 'c3', name: 'คอร์ด 3', players: [null, null, null, null], status: 'empty', shuttlecocks: 1 },
  { id: 'c4', name: 'คอร์ด 4', players: [null, null, null, null], status: 'empty', shuttlecocks: 1 },
  { id: 'c5', name: 'คอร์ด 5', players: [null, null, null, null], status: 'empty', shuttlecocks: 1 },
];
