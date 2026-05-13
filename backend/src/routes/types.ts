import { Hono } from 'hono';
import { getDb } from '../db/mongo';

const types = new Hono();

types.get('/', async (c) => {
  const db = getDb();
  const allTypes = await db.collection('types').find({}).toArray();

  if (allTypes.length === 0) {
    return c.json({ error: 'No types cached' }, 404);
  }

  return c.json(allTypes);
});

types.get('/:type', async (c) => {
  const typeName = c.req.param('type').toLowerCase();
  const db = getDb();
  const typeData = await db.collection('types').findOne({ name: typeName });

  if (!typeData) {
    return c.json({ error: 'Type not found' }, 404);
  }

  return c.json(typeData);
});

export default types;