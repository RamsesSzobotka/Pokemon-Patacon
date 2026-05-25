/**
 * Resolves the best front sprite URL given the sprites object, shiny permission, and pokeapi id fallback.
 */
export function resolveFrontSprite(sprites: any | undefined | null, shinyPack: boolean, pokeapiId?: number): string {
  if (shinyPack && sprites) {
    if (sprites.front_shiny) return sprites.front_shiny;
  }

  if (sprites && sprites.front_default) return sprites.front_default;

  if (sprites && sprites.static_front_default) return sprites.static_front_default;

  if (pokeapiId) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeapiId}.png`;

  return '';
}

/**
 * Resolves the small static icon (96x96 PNG) for a Pokemon.
 * Prefers sprites.icon from the database, falls back to the PokeAPI URL.
 */
export function resolveIconSprite(sprites: any | undefined | null, pokeapiId: number): string {
  if (sprites && sprites.icon) return sprites.icon;

  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeapiId}.png`;
}

export function resolveBackSprite(sprites: any | undefined | null, shinyPack: boolean, pokeapiId?: number): string {
  if (shinyPack && sprites) {
    if (sprites.back_shiny) return sprites.back_shiny;
  }

  if (sprites && sprites.back_default) return sprites.back_default;

  if (pokeapiId) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${pokeapiId}.png`;

  return '';
}
