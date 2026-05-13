import { Hono } from 'hono';
import { fetchMoveFromPokeAPI } from '../services/pokeapiClient';
import { getDb } from '../db/mongo';

const moves = new Hono();

moves.get('/:moveId', async (c) => {
  const moveId = c.req.param('moveId');
  const db = getDb();

  let move = await db.collection('moves').findOne({
    $or: [{ pokeapi_id: parseInt(moveId) }, { name: moveId.toLowerCase() }]
  });

  if (!move) {
    move = await fetchMoveFromPokeAPI(moveId);
    if (move) {
      await db.collection('moves').insertOne(move);
    }
  }

  if (!move) {
    return c.json({ error: 'Move not found' }, 404);
  }

  return c.json(move);
});

export default moves;