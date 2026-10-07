// Una barra de un ranking: el nombre y cuánto se vendió (funciones SQL ranking_peliculas, ranking_productos y ranking_combos)
export interface FilaRanking {
  nombre: string;
  cantidad: number;
}

export type TipoRanking = 'peliculas' | 'productos' | 'combos';
