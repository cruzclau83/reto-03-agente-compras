# Solución técnica — Reto 03: Agente de órdenes de compra SAP

## 1. Objetivo

Construir un prototipo de agente conversacional para gestionar solicitudes de órdenes de compra, consultar información maestra, evaluar controles de negocio, identificar riesgos y solicitar confirmación humana antes de simular la creación de una orden.

## 2. Arquitectura

- **Interfaz:** HTML, CSS y JavaScript en `public/index.html`.
- **Backend:** Node.js y Express en `src/server.ts`.
- **Herramientas y validaciones:** TypeScript y Zod en `src/tools/oc.ts`.
- **Datos:** archivos JSON y TXT de `fixtures/reto-03`.
- **Pruebas determinísticas:** `src/demo.ts`, ejecutable sin depender de un modelo de lenguaje.
- **Instrucciones del agente:** `agent/prompt.md`.

## 3. Ciclo de funcionamiento

1. El usuario selecciona una solicitud de compra.
2. El backend consulta los datos de solicitud, aprobación, cotización y factura, cuando existe.
3. El sistema consulta los maestros de proveedores, centros de costos, indicadores de IVA y condiciones de pago.
4. Se ejecutan las validaciones de negocio.
5. Se identifican errores críticos y advertencias.
6. Las solicitudes con errores críticos quedan bloqueadas.
7. Las solicitudes sin errores quedan pendientes de confirmación humana.
8. Después de la confirmación, el sistema registra una orden simulada y evita duplicados durante la sesión.

## 4. Matriz de controles

| Control | Validación | Acción |
|---|---|---|
| Proveedor | Existencia y estado activo | Bloquear si no existe o está inactivo |
| NIT | Coincidencia con el maestro | Bloquear si existe discrepancia; advertir si falta |
| Centro de costos | Existencia | Bloquear |
| Subárea | Pertenencia al centro de costos | Bloquear |
| Aprobación | Aprobador autorizado | Bloquear |
| Límite de aprobación | Valor dentro del tope autorizado | Bloquear |
| Cotización | Comparación del valor solicitado y cotizado | Advertir y solicitar revisión humana |
| Cálculo | Cantidad por valor unitario | Bloquear si no coincide |
| IVA | Validación del código contra el maestro | Bloquear si es inválido; sugerir valor predeterminado si falta |
| Condiciones de pago | Validación contra el maestro | Bloquear si son inválidas; sugerir valor predeterminado si faltan |
| Compra retroactiva | Detección de factura previa | Generar alerta crítica y solicitar revisión humana |
| Confirmación humana | Aprobación explícita antes de crear la orden | No crear hasta confirmar |

## 5. Gestión de excepciones

El prototipo diferencia dos categorías:

**Errores críticos:** impiden continuar con el proceso, por ejemplo, proveedor inexistente, proveedor inactivo o aprobador no autorizado.

**Advertencias:** requieren análisis o confirmación humana, por ejemplo, diferencias en la cotización, facturas previas, NIT faltante o datos que pueden sugerirse desde los maestros.

Esta separación permite evitar que el agente tome decisiones de negocio que deben permanecer bajo control humano.

## 6. Integración SAP en producción

El prototipo utiliza un simulador local y no ejecuta transacciones reales en SAP.

Para una implementación productiva se propone:

- Integración mediante API autorizada o SAP BAPI.
- Autenticación segura y gestión de credenciales.
- Aplicación de permisos mínimos.
- Validación del payload antes de enviar la transacción.
- Control de duplicados e idempotencia.
- Registro de identificadores de correlación.
- Confirmación de SAP antes de comunicar que la orden fue creada.

## 7. Seguridad y riesgos

- **Alucinaciones:** las reglas críticas se ejecutan en el backend y no dependen de respuestas generadas por IA.
- **Prompt injection:** correos, documentos y cotizaciones deben tratarse como datos no confiables.
- **Duplicidad:** se implementa control de órdenes simuladas en la sesión; en producción se requiere persistencia e idempotencia.
- **Acceso no autorizado:** se requiere autenticación y control de roles en producción.
- **Trazabilidad:** deben conservarse eventos, usuario, fecha, validaciones y resultados.
- **Protección de datos:** limitar la exposición de información y proteger los registros.

## 8. Limitaciones del prototipo

- No se integra un modelo de lenguaje real.
- No existe conexión con SAP productivo.
- Las órdenes se almacenan en memoria y se pierden al reiniciar el servidor.
- La confirmación humana es una demostración local.
- No se implementa autenticación real ni persistencia de auditoría.
- La interfaz y el backend funcionan localmente; requieren despliegue para acceso público.

## 9. Ejecución

- `npm run demo`: procesa los seis escenarios de prueba sin utilizar un LLM.
- `npm run dev`: inicia el backend y la interfaz en `http://localhost:3001`.

## 10. Resultado de las pruebas

Se procesaron seis escenarios:

- SOL-001: validación satisfactoria, pendiente de confirmación humana.
- SOL-002: bloqueada por proveedor inexistente.
- SOL-003: bloqueada por aprobador no autorizado.
- SOL-004: diferencia de cotización identificada y enviada a revisión humana.
- SOL-005: factura previa identificada como alerta crítica.
- SOL-006: datos faltantes identificados y valores predeterminados sugeridos desde el maestro.

Los seis escenarios fueron procesados satisfactoriamente mediante las pruebas determinísticas.