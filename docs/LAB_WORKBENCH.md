# Estación de pruebas de Urano Guard

La consola 06 incorpora un recorrido completo: **Overview → Labs → Evaluaciones → Live → Reportes**. Experimentos sigue destinado al protocolo de ejecuciones del agente; Evaluaciones comprueba el contrato de las integraciones del SDK. No se cambia el SDK ni sus inspectores.

## Recorrido

1. Comprueba el prevuelo del webhook en Overview, Settings, Experimentos o Evaluaciones. Solo hace GET de descubrimiento, con caché de cinco segundos; no prueba el modelo, las credenciales ni consume inferencia. Un core anterior indica que debes compilar y reiniciar Urano por completo.
2. En Labs elige una integración y sigue su recorrido guiado. El registro compartido sigue siendo la fuente de puertos y endpoints; health no demuestra que el agente ni un nginx opcional funcionen.
3. En Evaluaciones selecciona Contrato básico, Falsos positivos o Cobertura. Marca los labs, revisa el número de peticiones y pulsa Ejecutar. No se envían casos al abrir páginas.
4. La suite es secuencial, admite una ejecución activa y hasta 24 casos. Usa tres controles benignos y tres fixtures de detección ya presentes en el proyecto. Las suites pueden consumir tokens del proveedor configurado.
5. Elige una ejecución completa como línea base de la misma suite. Solo se comparan pares lab/caso presentes. Una regresión es pasar de pass a fail; pasar a error/unknown se indica como falta de disponibilidad/evidencia. No se atribuye causalidad al modelo ni a una configuración sin pruebas.
6. Usa Live para filtrar eventos, congelar la vista sin cortar recepción, inspeccionar decisiones y exportar sus metadatos. Los filtros de decisiones no congelan el estado del servidor.
7. Reportes permite buscar, filtrar por origen/severidad y exportar un reporte completo. El export completo incluye análisis; el export de Live y Evaluaciones solo incluye metadatos, sin cuerpos, argumentos de tools ni credenciales.

## Lectura honesta

- Un HTTP 200 no implica ALLOW. Los honeypots pueden devolver éxito HTTP con una señal de protección.
- ERROR cubre fallos de entrega/servidor/autenticación; no aumenta el contador de bloqueos como si el detector hubiera acertado.
- UNKNOWN indica que la respuesta no expone una decisión suficiente. Las demos 01/03/04/05 añaden un campo guard con action, allowed, riskScore y source, sin modificar sus campos previos.
- OBSERVE, usado para los fixtures de detección de la demo 03, acepta MONITOR o protección explícita. No equivale a detener un pago. Los ejemplos solo modifican el ledger sintético local.
- P50/P95 usan las duraciones de las respuestas de la suite, incluidos errores HTTP; los errores de conexión sin duración no se incluyen. El tiempo no mide únicamente inferencia.
- Las suites no limpian ThreatRegistry, no desbloquean IPs, no cambian políticas y no modifican variables de entorno. Las mutaciones de estado de un caso pueden afectar al siguiente. Reinicia cada lab manualmente si necesitas un estado inicial limpio.
- Detener suite aborta la entrega y los casos pendientes. No revierte efectos ni cancela automáticamente un turno que el agente haya aceptado.
- El contexto capturado describe la configuración del hub, no los procesos hermanos. Cada lab conserva su entorno. Usa la misma suite y destinos para comparaciones relevantes.

## Límites y operación

Las evaluaciones guardan un máximo de 20 ejecuciones **en RAM**. Se pierden al reiniciar el hub. Las comparaciones ya exportadas son snapshots; la línea base puede dejar de estar disponible cuando se vacía el ring. Los reportes existentes continúan en data/reports.json. No hay scheduler, aislamiento de operadores, autenticación ni persistencia del journal de evaluación. Mantén el demo en un entorno de desarrollo confiable y usa datos sintéticos.

El stack usa :3006 para 00 y :3001 para 01, evitando Docker en :3000. `npm start` compila Vue y arranca 00–06. Después de cambiar el backend hay que reiniciar. `npm run test:lab` verifica clasificación, límites, comparación, cancelación, aislamiento de metadatos y diagnóstico del protocolo sin usar un LLM. `npm run test:protocol` conserva las pruebas de transportes existentes.
