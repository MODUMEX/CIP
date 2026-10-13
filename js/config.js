/**
 * A qué Supabase se conecta el CIP.
 *
 * La llave PUBLICABLE (anon) es pública a propósito: va en el navegador y no
 * da acceso a nada por sí sola, porque quien manda es la RLS de la base. La
 * secreta (service_role) NO va acá ni en ningún archivo del repo.
 *
 * Si `LLAVE` queda vacía, el CIP sigue funcionando igual pero sin nube: no
 * aparece el botón de Proyectos. Así la copia que se comparte por OneDrive no
 * se rompe.
 */
window.CIP_SUPABASE = {
  URL: 'https://xvqpwddrxrglrsaetzle.supabase.co',
  LLAVE: '',
}
