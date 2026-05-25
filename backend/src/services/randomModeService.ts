/**
 * Servicio para generar equipos aleatorios en el modo Random
 */

import axios from 'axios';
import { getPokemonCollection, getMovesCollection } from '../db/mongodb';

interface TeamMember {
  pokeapi_id: number;
  selected_moves: number[];
}

interface PokemonData {
  pokeapi_id: number;
  name: string;
  name_es?: string;
  types: string[];
  is_legendary: boolean;
  move_ids: number[];
}

/**
 * Genera un equipo aleatorio de 6 Pokémon con hasta 4 movimientos cada uno
 */
export async function generateRandomTeam(): Promise<TeamMember[]> {
  const team: TeamMember[] = [];
  const usedPokemonIds = new Set<number>();
  let legendaryUsed = false;

  const pokemonCollection = getPokemonCollection();

  // Intentar generar 6 pokemones únicos
  while (team.length < 6) {
    // Generar ID aleatorio entre 1 y 649
    const randomId = Math.floor(Math.random() * 649) + 1;
    
    // Verificar que no se haya usado
    if (usedPokemonIds.has(randomId)) continue;

    // Obtener el pokémon de la base de datos
    const pokemon = await pokemonCollection.findOne({ pokeapi_id: randomId }) as PokemonData | null;
    
    if (!pokemon || !pokemon.move_ids || pokemon.move_ids.length === 0) {
      // Si no tiene movimientos, intentar otro
      continue;
    }

    // Verificar límite de legendarios (máximo 1)
    if (pokemon.is_legendary || pokemon.is_mythical) {
      if (legendaryUsed) continue;
      legendaryUsed = true;
    }

    // Seleccionar hasta 4 movimientos aleatorios
    const availableMoves = pokemon.move_ids;
    const numMoves = Math.min(4, availableMoves.length);
    const shuffledMoves = [...availableMoves].sort(() => Math.random() - 0.5);
    const selectedMoves = shuffledMoves.slice(0, numMoves);

    team.push({
      pokeapi_id: randomId,
      selected_moves: selectedMoves
    });

    usedPokemonIds.add(randomId);
  }

  return team;
}

/**
 * Obtiene los datos completos de un equipo para mostrar en el frontend
 */
export async function getTeamDetails(team: TeamMember[]): Promise<any[]> {
  const pokemonCollection = getPokemonCollection();
  const movesCollection = getMovesCollection();
  
  const teamDetails = [];

  for (const member of team) {
    // Obtener datos del pokémon
    const pokemon = await pokemonCollection.findOne({ pokeapi_id: member.pokeapi_id });
    
    if (!pokemon) continue;

    // Obtener detalles de los movimientos
    const moves = await movesCollection.find({ 
      move_id: { $in: member.selected_moves } 
    }).toArray();

    teamDetails.push({
      pokeapi_id: pokemon.pokeapi_id,
      name: pokemon.name,
      name_es: pokemon.name_es,
      types: pokemon.types,
      is_legendary: pokemon.is_legendary,
      sprites: pokemon.sprites,
      stats: pokemon.stats,
      selected_moves: moves.map(m => ({
        move_id: m.move_id,
        name: m.name,
        names: m.names,
        type: m.type,
        power: m.power,
        damage_class: m.damage_class
      }))
    });
  }

  return teamDetails;
}