# Operacion de Fisqui

Fisqui es un chatbot flexible respaldado por Gemini Developer API por defecto. El endpoint publico de la aplicacion sigue siendo `POST /api/chat`, requiere el JWT administrativo vigente y conserva la respuesta exitosa `{ "answer": "..." }`. OpenAI queda disponible únicamente mediante selección explícita.

## Limite de privacidad

La Function puede enviar al proveedor seleccionado exclusivamente:

- la pregunta escrita por el administrador, recortada y con longitud maxima de 1000 caracteres;
- filtros acotados de año, tipo de hoja y oficina;
- metricas agregadas allowlisted: total y promedio de resmas, oficina superior dentro del alcance filtrado, mes pico e impacto en agua calculado con la conversion ya definida por el repositorio.

No se deben enviar filas CSV, credenciales, JWT, secretos, valores de entorno, cuerpos de errores del proveedor ni contexto arbitrario del navegador. El servidor descarta campos desconocidos y valores fuera de limites antes de construir el prompt. Gemini recibe la clave solo mediante `x-goog-api-key`, nunca en URL o cuerpo. El nivel Free de Google tiene cuotas limitadas y puede usar el contenido para mejorar productos; no introducir informacion sensible.

## Configuracion

Configurar las variables solo en la interfaz privada de Netlify, con alcance para Functions:

- `AI_PROVIDER`: `gemini` por defecto; usar `openai` solo como selección explícita.
- `GEMINI_API_KEY`: clave creada en [Google AI Studio](https://aistudio.google.com/). No registrar, imprimir ni comprobar su valor desde comandos compartidos.
- `GEMINI_MODEL`: opcional; usa `gemini-2.5-flash-lite`. El modelo debe estar habilitado para la clave; la disponibilidad y cuotas dependen de Google y pueden cambiar.
- `GEMINI_TIMEOUT_MS`: opcional; timeout total en milisegundos, máximo seguro de `25000`.
- `OPENAI_API_KEY`: requerida solo si `AI_PROVIDER=openai`.
- `OPENAI_MODEL`: opcional para el camino OpenAI; usa `gpt-4o-mini` si no se define.
- `OPENAI_TIMEOUT_MS`: opcional para el camino OpenAI; máximo seguro de `25000` ms.

La validez de la clave solo queda demostrada por una solicitud funcional. Una variable presente no garantiza que la clave sea valida, tenga cuota o pueda usar el modelo configurado.

## Control de costo y uso

1. Revisar las cuotas Free de Google AI Studio y configurar alertas operativas antes de habilitar trafico sostenido.
2. Configurar alertas de errores y volumen de invocaciones para la Function en Netlify.
3. Revisar uso, precio, latencia y limites despues de modificar `GEMINI_MODEL` o `OPENAI_MODEL`.
4. Investigar aumentos inesperados de solicitudes sin registrar preguntas, contexto ni tokens.

El backend limita cada salida a 300 tokens y realiza como maximo un reintento ante `429`, `408`, errores de red o respuestas `5xx`, solamente si queda tiempo dentro del timeout total de 25 segundos. El timeout incluye la espera antes del reintento y nunca supera el maximo configurado.

## Smoke test de produccion

Realizar la prueba desde la interfaz publicada para no copiar JWT ni secretos a terminales o historiales:

1. Abrir `https://estadisticafiscalia.netlify.app` e iniciar sesion como administrador.
2. Aplicar filtros conocidos y abrir Fisqui desde el boton flotante.
3. Preguntar por el total de resmas y confirmar que la respuesta coincide con el KPI visible y se refiere al alcance filtrado.
4. Preguntar por la oficina con mayor consumo y confirmar que usa su nombre visible, sin llamarla global.
5. Preguntar por una conversion no incluida en el contexto y confirmar que declara que el dato no esta disponible en lugar de inventarlo.
6. Confirmar en DevTools que `POST /api/chat` responde `200` con `{ "answer": "..." }` y no contiene detalles internos.
7. Revisar logs de Netlify: pueden contener codigo y estado de una falla, pero no preguntas, contexto, claves, JWT ni cuerpos de OpenAI.

## Diagnostico de errores

| Codigo | HTTP | Significado | Accion operativa |
| --- | ---: | --- | --- |
| `CHAT_INVALID_QUESTION` | 400 | Pregunta ausente o vacia | Corregir la entrada. |
| `CHAT_QUESTION_TOO_LONG` | 400 | Supera 1000 caracteres | Reducir la pregunta. |
| `CHAT_NOT_CONFIGURED` | 503 | Falta configuracion del proveedor seleccionado | Verificar `AI_PROVIDER` y la presencia de la clave correspondiente en Netlify sin exponer su valor. |
| `CHAT_RATE_LIMITED` | 429 | El proveedor mantuvo el limite aun despues del reintento acotado | Revisar cuotas, limites y alertas; esperar antes de repetir. |
| `CHAT_TIMEOUT` | 504 | Se agoto el timeout total | Revisar latencia del proveedor y del modelo configurado. |
| `CHAT_PROVIDER_FAILURE` | 502 | Error de red, proveedor, autenticacion o solicitud rechazada | Revisar estado del proveedor, acceso al modelo y configuracion privada. |
| `CHAT_INVALID_RESPONSE` | 502 | Salida vacia, incompleta, malformada o rechazo del modelo | Repetir una vez con una pregunta de dominio; si persiste, revisar modelo y logs seguros. |

Una respuesta `401` sigue indicando sesion ausente o vencida. No cambiar autenticacion ni desactivar JWT para diagnosticar el chat.

## Verificacion local y rollback

Verificacion fresca recomendada:

```bash
npm run lint
npm test
npm run build
./scripts/validate-skills.sh
```

No se necesita desplegar para ejecutar estas comprobaciones. Para revertir esta migración basta retirar `server/gemini.js` y la selección de proveedor en `server/app.js`, y volver a configurar explícitamente `AI_PROVIDER=openai` con su clave. No requiere revertir JWT, routing de Netlify, storage ni contratos CSV.
