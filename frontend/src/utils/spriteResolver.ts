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

export function resolveBackSprite(sprites: any | undefined | null, shinyPack: boolean, pokeapiId?: number): string {
  if (shinyPack && sprites) {
    if (sprites.back_shiny) return sprites.back_shiny;
  }

  if (sprites && sprites.back_default) return sprites.back_default;

  if (pokeapiId) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${pokeapiId}.png`;

  return '';
}
