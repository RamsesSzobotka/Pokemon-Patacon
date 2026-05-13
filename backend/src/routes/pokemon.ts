import { Hono } from 'hono';
import { getDb } from '../db/mongo';
import { fetchPokemonFromPokeAPI, cachePokemon } from '../services/pokeapiClient';

const pokemon = new Hono();

pokemon.get('/search', async (c) => {
  const query = c.req.query('query') || '';
  const db = getDb();
  const pokemon = await db.collection('pokemon')
    .find({ name: { $regex: query, $options: 'i' } })
    .limit(20)
    .toArray();
  return c.json(pokemon);
});

pokemon.get('/:idOrName', async (c) => {
  const idOrName = c.req.param('idOrName');
  const db = getDb();

  let pokemon = await db.collection('pokemon').findOne({
    $or: [{ pokeapi_id: parseInt(idOrName) }, { name: idOrName.toLowerCase() }]
  });

  if (!pokemon) {
    pokemon = await fetchPokemonFromPokeAPI(idOrName);
    if (pokemon) {
      await cachePokemon(pokemon);
    }
  }

  if (!pokemon) {
    return c.json({ error: 'Pokemon not found' }, 404);
  }

  return c.json(pokemon);
});

pokemon.get('/list/gen5', async (c) => {
  const db = getDb();
  const gen5 = await db.collection('pokemon')
    .find({ pokeapi_id: { $lte: 649 } })
    .project({ name: 1, pokeapi_id: 1, type: 1, sprites: 1 })
    .toArray();
  return c.json(gen5);
});

export default pokemon;