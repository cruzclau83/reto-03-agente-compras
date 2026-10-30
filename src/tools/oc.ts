
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const base = path.join(process.cwd(), "fixtures/reto-03");

const Solicitud = z.object({
  solicitud_id: z.string(),
  proveedor_nombre: z.string(),
  proveedor_nit: z.string().optional(),
  centro_costo: z.string(),
  subarea: z.string(),
  cantidad: z.number(),
  valor_unitario: z.number(),
  valor_total: z.number(),
  moneda: z.string(),
  indicador_iva: z.string().optional(),
  condiciones_pago: z.string().optional()
});

function leerJSON(archivo: string): any {
  return JSON.parse(fs.readFileSync(archivo, "utf8"));
}

function normalizarNit(nit: string): string {
  return nit.replace(/\D/g, "");
}

function validarCaso(carpeta: string) {
  const dir = path.join(base, "solicitudes", carpeta);

  const s = Solicitud.parse(
    leerJSON(path.join(dir, "solicitud.json"))
  );

  const aprobacion = leerJSON(
    path.join(dir, "aprobacion.json")
  );

  const cotizacion = fs.readFileSync(
    path.join(dir, "cotizacion.txt"),
    "utf8"
  );

  const proveedores = leerJSON(
    path.join(base, "maestros/proveedores.json")
  );

  const centros = leerJSON(
    path.join(base, "maestros/centros-costo.json")
  );

  const ivas = leerJSON(
    path.join(base, "maestros/indicadores-iva.json")
  );

  const pagos = leerJSON(
    path.join(base, "maestros/condiciones-pago.json")
  );

  const facturaPath = path.join(dir, "factura.txt");
  const facturaExiste = fs.existsSync(facturaPath);

  const factura = facturaExiste
    ? fs.readFileSync(facturaPath, "utf8")
    : "";

  const errores: string[] = [];
  const advertencias: string[] = [];

  // 1. Validar proveedor
  const proveedor = proveedores.find(
    (p: any) =>
      p.nombre.toLowerCase() ===
      s.proveedor_nombre.toLowerCase()
  );

  if (!proveedor) {
    errores.push("Proveedor no registrado en el maestro");
  } else if (!proveedor.activo) {
    errores.push("Proveedor inactivo");
  }

  if (
    proveedor &&
    s.proveedor_nit &&
    normalizarNit(proveedor.nit) !==
      normalizarNit(s.proveedor_nit)
  ) {
    errores.push("El NIT no coincide con el maestro");
  }

  if (!s.proveedor_nit) {
    advertencias.push(
      "La solicitud no contiene NIT del proveedor. Verificar antes de crear la OC"
    );
  }

  // 2. Validar centro de costos y aprobador
  const centro = centros.find(
    (c: any) => c.centro_costo === s.centro_costo
  );

  if (!centro) {
    errores.push("Centro de costos inexistente");
  } else {
    if (!centro.subareas.includes(s.subarea)) {
      errores.push(
        "Subárea no válida para el centro de costos"
      );
    }

    const aprobador = centro.aprobadores.find(
      (a: any) =>
        a.email.toLowerCase() ===
        aprobacion.de.toLowerCase()
    );

    if (!aprobador) {
      errores.push(
        "El aprobador no está autorizado para este centro de costos"
      );
    } else if (s.valor_total > aprobador.tope) {
      errores.push(
        "El valor supera el límite autorizado del aprobador"
      );
    }
  }

  // 3. Validar cotización
  const totalCotizacion = cotizacion.match(
    /TOTAL \(IVA incluido\): COP ([\d.]+)/
  );

  if (!totalCotizacion) {
    errores.push(
      "No se pudo identificar el total de la cotización"
    );
  } else {
    const valor = Number(
      totalCotizacion[1].replace(/\./g, "")
    );

    if (valor !== s.valor_total) {
      advertencias.push(
        `Diferencia entre solicitud ($${s.valor_total.toLocaleString("es-CO")}) y cotización ($${valor.toLocaleString("es-CO")}). Requiere aprobación humana`
      );
    }
  }

  if (s.valor_unitario * s.cantidad !== s.valor_total) {
    errores.push(
      "El cálculo cantidad por valor unitario no coincide con el total"
    );
  }

  // 4. Validar IVA y condiciones de pago
  // Si faltan datos, se sugieren los valores del maestro.
  const codigoIva =
  s.indicador_iva || proveedor?.indicador_iva_default;

const codigoPago =
  s.condiciones_pago ||
  proveedor?.condiciones_pago_default;

  if (!s.indicador_iva) {
    advertencias.push(
      `Falta indicador de IVA. Valor sugerido por maestro: ${codigoIva || "No disponible"}`
    );
  }

  if (!s.condiciones_pago) {
    advertencias.push(
      `Faltan condiciones de pago. Valor sugerido por maestro: ${codigoPago || "No disponible"}`
    );
  }

  if (
    codigoIva &&
    !ivas.find((i: any) => i.codigo === codigoIva)
  ) {
    errores.push("Indicador de IVA no válido");
  }

  if (
    codigoPago &&
    !pagos.find((p: any) => p.codigo === codigoPago)
  ) {
    errores.push("Condiciones de pago no válidas");
  }

  // 5. Detectar compras retroactivas
  if (facturaExiste) {
    advertencias.push(
      "ALERTA CRÍTICA: existe factura previa a la orden de compra. Requiere revisión humana"
    );

    const facturaTotal = factura.match(
      /TOTAL: COP ([\d.]+)/
    );

    if (
      facturaTotal &&
      Number(facturaTotal[1].replace(/\./g, "")) !==
        s.valor_total
    ) {
      advertencias.push(
        "El valor de la factura no coincide con la solicitud"
      );
    }
  }

  // 6. Estado final
  const aprobacionValida =
    centro?.aprobadores.some(
      (a: any) =>
        a.email.toLowerCase() ===
        aprobacion.de.toLowerCase()
    ) ?? false;

  const estado =
    errores.length > 0
      ? "BLOQUEADA"
      : "PENDIENTE_CONFIRMACION_HUMANA";

  return {
    caso: carpeta,
    solicitud: s.solicitud_id,
    proveedor: s.proveedor_nombre,
    valor: s.valor_total,
    aprobador: aprobacion.de,
    aprobacionValida,
    estado,
    errores,
    advertencias,
    puedeCrearOrden: false
  };
}

export { validarCaso };