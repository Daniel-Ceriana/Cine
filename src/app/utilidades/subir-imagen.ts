import { SupabaseService } from '../services/supabase-service';

// Sube una imagen al bucket "imagenes", dentro de una carpeta ('peliculas', 'productos'), y devuelve su URL pública.
export async function subirImagen(supabase: SupabaseService, carpeta: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop();
  const ruta = `${carpeta}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.client.storage.from('imagenes').upload(ruta, file, { upsert: false });
  if (error) throw error;

  const { data } = supabase.client.storage.from('imagenes').getPublicUrl(ruta);
  return data.publicUrl;
}
