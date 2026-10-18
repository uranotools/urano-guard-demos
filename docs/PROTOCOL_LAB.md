# Laboratorio de ejecuciones recuperables

Abre la consola SOC y entra en **Experimentos**. Se integra con el core Urano v1 sobre la URL ya configurada en Settings. No modifica el SDK `urano-guard`, sus inspectores ni el contrato schema 1.0 de las demos 00–05.

## Ocho pruebas para explorar

1. **Triage en vivo**: observa texto y llamadas de herramientas, si el agente decide usarlas. La ausencia de tools no es un fallo del transporte.
2. **Una conversación, dos turnos**: conserva `sessionId` y cambia `turnId`. La comprobación del identificador Polaris-27 evalúa la respuesta del modelo, no garantiza su memoria.
3. **Doble entrega, un turno**: envía dos peticiones iguales simultáneamente con la misma `Idempotency-Key`; comprueba el mismo `turnId`.
4. **Cortar y recuperar**: desconecta SSE después de un evento y retoma con `Last-Event-ID`, sin repetir la inferencia.
5. **Cancelación cooperativa**: crea un turno asíncrono y solicita cancelarlo. Si ya terminó, muestra ese estado en lugar de fingir que lo canceló. Este caso usa HTTP/SSE para controlar y seguir el resultado.
6. **Revisión de una entrega**: riesgos, pruebas y rollback de una propuesta ficticia, sin despliegue.
7. **Plan de soporte**: preguntas y siguientes pasos para un operador, sin pagos ni mensajes a terceros.
8. **Comparar tres opciones**: análisis de costos/latencias sintéticos incluidos en el prompt; no requiere datos externos.

Todos los casos siguen pasando por CyberGateway y el agente configurado. No se desactivan inspectores para ejecutar ejemplos no relacionados con seguridad. Las respuestas semánticas y la selección de herramientas dependen del modelo y de sus permisos.

## Controles de una ejecución

- **Consultar** obtiene estado, resultado y métricas del core, sin invocar al agente.
- **Desconectar entrega** aborta el transporte local; no equivale a cancelar el trabajo.
- **Retomar eventos** consulta `webhookAction: events` con el último cursor recibido.
- **Reintentar misma clave** vuelve a usar exactamente el payload y clave del turno actual. En el ejemplo de continuidad, corresponde al segundo turno después de crearlo.
- **Solicitar cancelación** envía `webhookAction: cancel`; su aceptación es cooperativa, no revierte efectos externos.
- El botón del `sessionId` prepara la siguiente ejecución con esa conversación.
- **Auditoría JSON** exporta solo metadatos y comprobaciones, sin respuesta del modelo ni payloads.

El journal del core tiene sus propios límites y retención (24 horas para claves/resultados y una ventana acotada de eventos). La consola no los amplía. Un cursor expirado requiere consultar el resultado; crear otro turno con una clave nueva puede repetir operaciones externas. El ring de la consola se pierde al reiniciar el hub, pero la recuperación del core permanece disponible mientras retenga el turno. Este cliente no es un planificador de workflows ni ejecuta automáticamente tareas tras un reinicio.

## Auditoría y privacidad

El cliente procesa SSE incremental y WS, pero el ring registra únicamente tipo, secuencia, IDs, nombre de herramienta, cantidad de caracteres y estado/error. Omite texto de tokens, argumentos/resultados de tools, cuerpos, cookies y headers de autenticación. La respuesta final tiene su propio panel acotado, solo en RAM. Usa exclusivamente datos sintéticos en este laboratorio.

El endpoint nuevo está limitado al origen del hub y a los orígenes locales de Vite :5173; no agrega autenticación al producto. Usa el hub en una máquina de desarrollo confiable, no como servicio público. No hay persistencia de auditoría, firma de exportaciones ni aislamiento de operadores.

## Cliente reutilizable

`packages/shared/webhookLabClient.ts` contiene `WebhookLabClient` (HTTP/SSE/WS) y el parser SSE. La clave HMAC firma el JSON serializado exacto; para WS el envelope transporta ese mismo JSON como string y sus headers. No se altera el payload entre un intento y su reintento.

```typescript
const client = new WebhookLabClient({ url: process.env.AGENT_URL!, hmac: process.env.AGENT_HMAC });
const payload = client.envelope({ kind: 'workflow-lab', message: 'Resume los datos ficticios incluidos.' });
const result = await client.invoke(payload, {
    mode: 'sse', key: 'stable-operation-key',
    onMeta: ids => { /* conservar IDs para recuperación */ },
    onEvent: event => { /* proyectar solo metadatos autorizados */ }
});
const status = await client.control(result.turnId!, 'status');
```

El servidor de la consola llama a ese cliente. El navegador no contacta directamente con Desktop ni recibe los secretos del plugin mediante estas rutas nuevas. No se añadió una dependencia WebSocket: el modo WS usa el cliente global de Node 22+. HTTP/SSE mantienen compatibilidad con Node 18+.

## Configuración del plugin

`cyber-gateway` habilita WS explícitamente y limita este experimento a dos turnos concurrentes, hasta tres minutos de ejecución y un minuto en cola, sujeto a los límites del host. Mantiene `waitForAgent` y el veredicto schema 1.0, con metadata `execution` adicional.

Configura `INCOMING_WEBHOOK_SECRET` y el mismo `AGENT_HMAC` o `AGENT_TOKEN` en la consola. `REQUIRE_WEBHOOK_AUTH` fuerza el rechazo si falta el secreto. Su default conserva el laboratorio local sin secreto; fuera de un entorno local confiable debes exigir credenciales. Los controles se reconocen antes del flujo NEED, pero siempre después de autenticar la petición.

## Pruebas

`npm run test:protocol` utiliza un webhook HTTP de fixture, parser fragmentado, controles autenticados y el adaptador real del plugin, sin claves ni LLM externo. Comprueba firma, doble entrega, continuidad, desconexión/replay, consulta/cancelación y la proyección de auditoría. `npm run build -w @urano/demo-06-soc-console` construye Vue. WS requiere el smoke test contra un core que lo anuncie; si no está habilitado o el runtime no lo ofrece, se informa la limitación sin simular éxito.
