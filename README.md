# CIP · Cálculo de Materiales

La app de producción de Grupo Modumex: toma la OC del Constructor de Planos y
calcula el despiece, el dibujo de corte y la lista de materiales.

Era un solo HTML que se repartía por OneDrive —y había que actualizarlo PC por
PC—. Ahora vive acá y se publica sola en GitHub Pages con cada push a `main`.

## Cómo está armado

| | |
|---|---|
| `index.html` | la app entera, con sus librerías adentro (jsPDF, pdf.js, fuentes) |
| `js/config.js` | a qué Supabase se conecta; la llave publicable va acá |
| `js/nube.js` | la entrada y la pestaña 04 Proyectos |
| `supabase/01_schema.sql` | la tabla `proyecto` y su RLS |

El HTML sigue siendo **uno solo y autónomo**: si se abre suelto, sin servidor,
funciona igual que siempre. Lo único que pierde es la nube, porque sin llave
configurada `nube.js` no se activa.

## Entrar

Publicado en la web, cualquiera con el link llegaría a la aplicación, así que
la pantalla de entrar **tapa todo** hasta iniciar sesión. Hay **un solo rol**:
el que tiene cuenta entra y ve todos los proyectos.

## Los proyectos

El CIP arma todo el trabajo en un objeto en memoria (`STATE`). Guardar un
proyecto es mandar ese objeto a una columna `jsonb`; abrirlo es volver a
ponerlo donde estaba. Por eso no hay que desarmar el cálculo en tablas que
después habría que mantener a la par.

Para que funcione hace falta correr `supabase/01_schema.sql` en el proyecto de
Supabase y poner la llave publicable en `js/config.js`.
