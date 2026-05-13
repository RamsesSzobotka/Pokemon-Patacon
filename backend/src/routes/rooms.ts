import { Hono } from 'hono';
import { getDb } from '../db/mongo';
import { ObjectId } from 'mongodb';
import { generateRoomCode } from '../services/roomManager';

const rooms = new Hono();

rooms.post('/', async (c) => {
  const db = getDb();
  const code = generateRoomCode();

  const room = {
    code,
    player_1: null as string | null,
    player_2: null as string | null,
    team_1: [] as number[],
    team_2: [] as number[],
    status: 'waiting',
    winner: null as string | null,
    created_at: new Date(),
    started_at: null as Date | null,
    finished_at: null as Date | null,
  };

  await db.collection('rooms').insertOne(room);
  return c.json({ code });
});

rooms.get('/:code', async (c) => {
  const code = c.req.param('code');
  const db = getDb();
  const room = await db.collection('rooms').findOne({ code });

  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  return c.json(room);
});

rooms.post('/:code/join', async (c) => {
  const code = c.req.param('code');
  const { player_id } = await c.req.json();
  const db = getDb();

  const room = await db.collection('rooms').findOne({ code });
  if (!room) return c.json({ error: 'Room not found' }, 404);
  if (room.player_2) return c.json({ error: 'Room full' }, 400);

  await db.collection('rooms').updateOne(
    { code },
    { $set: { player_2: player_id, status: 'in_draft' } }
  );

  return c.json({ success: true });
});

rooms.delete('/:code', async (c) => {
  const code = c.req.param('code');
  const db = getDb();
  await db.collection('rooms').deleteOne({ code });
  return c.json({ success: true });
});

export default rooms;